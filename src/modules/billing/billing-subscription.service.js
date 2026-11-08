const prisma = require("../../shared/prisma");
const stripe = require("../../shared/stripe");
const { HttpError } = require("../../shared/http");
const { propertyTypes, propertyTypeByInput } = require("./billing.validation");

const propertyTypeLabels = new Map(propertyTypes);

function dollars(value) {
  if (value == null) return null;
  return Number(value.toString()).toFixed(2);
}

function stripeTime(seconds) {
  if (!seconds) return null;
  return new Date(seconds * 1000).toISOString();
}

function periodEnd(subscription) {
  if (subscription.current_period_end) return subscription.current_period_end;
  const item = subscription.items && subscription.items.data && subscription.items.data[0];
  return item && item.current_period_end;
}

async function account(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { servicePriceBand: true },
  });
  if (!organization || organization.planKind !== "FULL_SERVICE") {
    throw new HttpError(403, "This page is available on a Service + Software plan");
  }
  return organization;
}

async function latestProperty(organizationId) {
  return prisma.property.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
  });
}

async function loadSubscription(organization) {
  if (!organization.stripeSubscriptionId) return null;
  try {
    return await stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Subscription could not be loaded");
  }
}

async function syncEnded(organization, subscription) {
  if (!subscription) return organization;
  if (subscription.status !== "canceled" && subscription.status !== "incomplete_expired") {
    return organization;
  }
  if (organization.subscriptionStatus === "CANCELLED") return organization;
  return prisma.organization.update({
    where: { id: organization.id },
    data: { subscriptionStatus: "CANCELLED" },
    include: { servicePriceBand: true },
  });
}

async function availablePlans(currentBandId) {
  const bands = await prisma.servicePriceBand.findMany({
    where: { active: true, kind: "FULL_SERVICE" },
    orderBy: { monthlyPrice: "asc" },
  });
  return bands.map((band) => ({
    id: band.id,
    name: band.name,
    monthlyPrice: dollars(band.monthlyPrice),
    current: band.id === currentBandId,
  }));
}

async function present(user) {
  let organization = await account(user);
  const subscription = await loadSubscription(organization);
  organization = await syncEnded(organization, subscription);
  const property = await latestProperty(organization.id);
  const band = organization.servicePriceBand;
  const ends = subscription ? periodEnd(subscription) : null;
  const cancelAtPeriodEnd = Boolean(subscription && subscription.cancel_at_period_end);
  const active = organization.subscriptionStatus === "ACTIVE";

  return {
    currentPlan: band
      ? {
          propertyType: property ? property.propertyType : null,
          propertyTypeLabel: property ? propertyTypeLabels.get(property.propertyType) : null,
          id: band.id,
          name: band.name,
          status: active ? "Active" : "Cancelled",
          nextBilling: active ? stripeTime(ends) : null,
          amount: dollars(band.monthlyPrice),
          cancelAtPeriodEnd: active && cancelAtPeriodEnd,
          cancelsOn: active && cancelAtPeriodEnd ? stripeTime(ends) : null,
        }
      : null,
    propertyTypes: propertyTypes.map(([value, label]) => ({ value, label })),
    availablePlans: await availablePlans(band ? band.id : null),
  };
}

async function applyPropertyType(organizationId, propertyType) {
  if (!propertyType) return;
  const property = await latestProperty(organizationId);
  if (!property) return;
  await prisma.property.update({
    where: { id: property.id },
    data: { propertyType: propertyTypeByInput.get(propertyType) },
  });
}

async function fullServiceBand(priceBandId) {
  const band = await prisma.servicePriceBand.findFirst({
    where: { id: priceBandId, active: true, kind: "FULL_SERVICE" },
  });
  if (!band) throw new HttpError(400, "Plan not found");
  return band;
}

function toCents(amount) {
  const cents = Math.round(Number(amount.toString()) * 100);
  if (!Number.isInteger(cents) || cents < 50) {
    throw new HttpError(400, "This plan cannot be checked out");
  }
  return cents;
}

async function replaceStripePrice(organization, band) {
  const subscription = await loadSubscription(organization);
  if (!subscription) throw new HttpError(400, "This subscription is not billed through Stripe");
  const item = subscription.items && subscription.items.data && subscription.items.data[0];
  if (!item) throw new HttpError(502, "Subscription could not be updated");
  try {
    const product = await stripe.products.create({
      name: `Service + Software — ${band.name}`,
    });
    const price = await stripe.prices.create({
      currency: "usd",
      unit_amount: toCents(band.monthlyPrice),
      recurring: { interval: "month" },
      product: product.id,
    });
    await stripe.subscriptions.update(organization.stripeSubscriptionId, {
      items: [{ id: item.id, price: price.id }],
      proration_behavior: "none",
      cancel_at_period_end: false,
      metadata: {
        organizationId: organization.id,
        priceBandId: band.id,
      },
    });
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Subscription could not be updated");
  }
}

async function changePlan(user, input) {
  const organization = await account(user);
  if (organization.subscriptionStatus !== "ACTIVE") {
    throw new HttpError(403, "Choose a plan and complete payment before changing it");
  }
  const band = await fullServiceBand(input.priceBandId);
  await applyPropertyType(organization.id, input.propertyType);
  if (organization.servicePriceBandId === band.id) {
    if (!input.propertyType) throw new HttpError(409, "This plan is already active");
    return present(user);
  }
  if (organization.stripeSubscriptionId) await replaceStripePrice(organization, band);
  await prisma.organization.update({
    where: { id: organization.id },
    data: { servicePriceBandId: band.id, planKind: "FULL_SERVICE" },
  });
  await prisma.activityEvent.create({
    data: {
      actorId: user.id,
      type: "PLAN_CHANGED",
      summary: `${organization.name} moved to ${band.name}`,
      entityType: "Organization",
      entityId: organization.id,
    },
  });
  return present(user);
}

async function cancelPlan(user) {
  const organization = await account(user);
  if (organization.subscriptionStatus !== "ACTIVE") {
    throw new HttpError(409, "This plan is already cancelled");
  }
  if (!organization.stripeSubscriptionId) {
    await prisma.organization.update({
      where: { id: organization.id },
      data: { subscriptionStatus: "CANCELLED" },
    });
  } else {
    try {
      await stripe.subscriptions.update(organization.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    } catch (error) {
      console.error(error);
      throw new HttpError(502, "Subscription could not be cancelled");
    }
  }
  await prisma.activityEvent.create({
    data: {
      actorId: user.id,
      type: "SUBSCRIPTION_CANCEL_SCHEDULED",
      summary: `${organization.name} scheduled the plan to cancel`,
      entityType: "Organization",
      entityId: organization.id,
    },
  });
  return present(user);
}

module.exports = { present, changePlan, cancelPlan };
