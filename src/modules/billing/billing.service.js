const env = require("../../config/env");
const prisma = require("../../shared/prisma");
const stripe = require("../../shared/stripe");
const { HttpError } = require("../../shared/http");
const { propertyTypes, propertyTypeByInput } = require("./billing.validation");

const kindLabels = {
  SOFTWARE: "Software Only",
  FULL_SERVICE: "Service + Software",
};

const kindDescriptions = {
  SOFTWARE: "You provide the staff. Amenity Ops provides the platform.",
  FULL_SERVICE: "Amenity Ops provides the service team and the platform.",
};

function money(value) {
  return value == null ? null : value.toString();
}

function toCents(amount) {
  const cents = Math.round(Number(amount.toString()) * 100);
  if (!Number.isInteger(cents) || cents < 50) {
    throw new HttpError(400, "This plan cannot be checked out");
  }
  return cents;
}

function allowedOrigins() {
  return new Set(
    env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
}

function returnUrl(value, field) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, `Invalid ${field}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new HttpError(400, `Invalid ${field}`);
  }
  if (!allowedOrigins().has(url.origin)) {
    throw new HttpError(400, `${field} is not allowed`);
  }
  if (field === "successUrl" && !value.includes("{CHECKOUT_SESSION_ID}")) {
    return `${value}${value.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
  }
  return value;
}

function toPlan(band) {
  return {
    id: band.id,
    kind: band.kind,
    kindLabel: kindLabels[band.kind],
    name: band.name,
    monthlyPrice: money(band.monthlyPrice),
    minUnits: band.minUnits,
    maxUnits: band.maxUnits,
  };
}

async function plans(kind) {
  if (kind && kind !== "SOFTWARE" && kind !== "FULL_SERVICE") {
    throw new HttpError(400, "Unknown plan kind");
  }
  const bands = await prisma.servicePriceBand.findMany({
    where: { active: true, ...(kind ? { kind } : {}) },
    orderBy: [{ kind: "asc" }, { monthlyPrice: "asc" }],
  });
  return {
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    options: [
      {
        kind: "SOFTWARE",
        label: kindLabels.SOFTWARE,
        description: kindDescriptions.SOFTWARE,
      },
      {
        kind: "FULL_SERVICE",
        label: kindLabels.FULL_SERVICE,
        description: kindDescriptions.FULL_SERVICE,
      },
    ],
    propertyTypes: propertyTypes.map(([value, label]) => ({ value, label })),
    plans: bands.map(toPlan),
  };
}

async function account(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (!organization) throw new HttpError(404, "Company not found");
  return organization;
}

async function checkout(user, input) {
  const organization = await account(user);
  if (organization.subscriptionStatus === "ACTIVE") {
    throw new HttpError(409, "This account already has an active subscription");
  }

  const band = await prisma.servicePriceBand.findFirst({
    where: { id: input.priceBandId, active: true },
  });
  if (!band) throw new HttpError(400, "Plan not found");

  if (input.propertyType) {
    const property = await prisma.property.findFirst({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
    });
    if (property) {
      await prisma.property.update({
        where: { id: property.id },
        data: { propertyType: propertyTypeByInput.get(input.propertyType) },
      });
    }
  }

  const successUrl = returnUrl(
    input.successUrl || "https://jeroomeb.maktechgroup.tech/billing/success",
    "successUrl"
  );
  const cancelUrl = returnUrl(
    input.cancelUrl || "https://jeroomeb.maktechgroup.tech/billing/cancel",
    "cancelUrl"
  );

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: organization.id,
      metadata: {
        organizationId: organization.id,
        priceBandId: band.id,
        userId: user.id,
      },
      subscription_data: {
        metadata: {
          organizationId: organization.id,
          priceBandId: band.id,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: toCents(band.monthlyPrice),
            recurring: { interval: "month" },
            product_data: {
              name: `${kindLabels[band.kind]} — ${band.name}`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Payment could not be started");
  }

  return { sessionId: session.id, url: session.url };
}

async function confirm(user, input) {
  const organization = await account(user);
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(input.sessionId);
  } catch (error) {
    console.error(error);
    throw new HttpError(400, "Payment session not found");
  }

  if (session.metadata.organizationId !== organization.id) {
    throw new HttpError(403, "You do not have access to this payment");
  }
  if (session.payment_status !== "paid") {
    throw new HttpError(400, "Payment is not complete");
  }

  const band = await prisma.servicePriceBand.findUnique({
    where: { id: session.metadata.priceBandId },
  });
  if (!band) throw new HttpError(400, "Plan not found");

  const saved = await prisma.organization.update({
    where: { id: organization.id },
    data: {
      subscriptionStatus: "ACTIVE",
      planKind: band.kind,
      servicePriceBandId: band.id,
      stripeCustomerId: typeof session.customer === "string" ? session.customer : null,
      stripeSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
      paidAt: new Date(),
    },
    include: { servicePriceBand: true },
  });

  await prisma.activityEvent.create({
    data: {
      actorId: user.id,
      type: "SUBSCRIPTION_ACTIVATED",
      summary: `${organization.name} subscribed to ${band.name}`,
      entityType: "Organization",
      entityId: organization.id,
    },
  });

  return {
    subscriptionStatus: saved.subscriptionStatus,
    paidAt: saved.paidAt,
    plan: saved.servicePriceBand ? toPlan(saved.servicePriceBand) : null,
  };
}

module.exports = { plans, checkout, confirm };
