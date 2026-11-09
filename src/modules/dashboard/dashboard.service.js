const prisma = require("../../shared/prisma");
const stripe = require("../../shared/stripe");
const { HttpError } = require("../../shared/http");
const { SOFTWARE_PRODUCT, loadBands, presentPlans, tierProgress } = require("../billing/plan-tiers");

const openRequestStatuses = ["PENDING_REVIEW", "IN_PROGRESS", "ONGOING"];
const activeRequestStatuses = ["APPROVED", "ONGOING", "IN_PROGRESS"];
const paidSubscriptionStatuses = new Set(["active", "trialing"]);

function address(property) {
  const region = [property.state, property.zip].filter(Boolean).join(" ");
  return [property.street, property.city, region].filter(Boolean).join(", ");
}

async function refreshSubscription(organization) {
  if (!organization.stripeSubscriptionId) return organization;
  let subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
  } catch (error) {
    console.error(error);
    return organization;
  }
  if (paidSubscriptionStatuses.has(subscription.status)) return organization;
  return prisma.organization.update({
    where: { id: organization.id },
    data: { subscriptionStatus: "SUSPENDED" },
    include: { servicePriceBand: true },
  });
}

async function overview(user) {
  if (!user.organizationId) {
    throw new HttpError(403, "This dashboard is for a client account");
  }

  let organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { servicePriceBand: true },
  });
  if (!organization) throw new HttpError(404, "Company not found");

  organization = await refreshSubscription(organization);
  if (organization.subscriptionStatus !== "ACTIVE") {
    throw new HttpError(403, "Choose a plan and complete payment to open the dashboard");
  }

  const property = await prisma.property.findFirst({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });
  const owned = {
    OR: [
      { organizationId: organization.id },
      { submittedById: user.id },
      { email: user.email },
    ],
  };
  const [requests, approved, pendingRequests, catalog] = await Promise.all([
    prisma.serviceRequest.count({
      where: { organizationId: organization.id, status: { in: openRequestStatuses } },
    }),
    prisma.serviceRequest.findMany({
      where: { status: { in: activeRequestStatuses }, ...owned },
      include: { items: { include: { addOnService: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.serviceRequest.findMany({
      where: { status: "PENDING_REVIEW", ...owned },
      include: { items: { include: { addOnService: true } } },
      orderBy: { createdAt: "desc" },
    }),
    organization.planKind === "FULL_SERVICE"
      ? prisma.addOnService.findMany({
          where: { active: true, sortOrder: { gt: 0 } },
          orderBy: { sortOrder: "asc" },
        })
      : [],
  ]);

  const unlinked = approved.filter((request) => request.organizationId !== organization.id);
  if (unlinked.length) {
    await prisma.serviceRequest.updateMany({
      where: { id: { in: unlinked.map((request) => request.id) } },
      data: { organizationId: organization.id, submittedById: user.id },
    });
  }

  const seen = new Set();
  const services = [];
  for (const request of approved) {
    const items = [...request.items].sort(
      (left, right) => left.addOnService.sortOrder - right.addOnService.sortOrder
    );
    for (const item of items) {
      if (seen.has(item.addOnServiceId)) continue;
      seen.add(item.addOnServiceId);
      services.push({
        id: item.addOnService.id,
        name: item.addOnService.name,
        description: item.addOnService.description,
        type: item.addOnService.sortOrder === 0 ? "Main Service" : "Add-on",
        price: item.addOnService.price.toString(),
        status: "Active",
        requestId: request.id,
        requestCode: request.code,
        requestStatus: request.status,
      });
    }
  }

  const pendingIds = new Set();
  const pendingAddOns = [];
  for (const request of pendingRequests) {
    for (const item of request.items) {
      if (seen.has(item.addOnServiceId) || pendingIds.has(item.addOnServiceId)) continue;
      if (item.addOnService.sortOrder === 0) continue;
      pendingIds.add(item.addOnServiceId);
      pendingAddOns.push({
        id: item.addOnService.id,
        name: item.addOnService.name,
        description: item.addOnService.description,
        price: item.addOnService.price.toString(),
        status: "Pending Review",
        requestId: request.id,
        requestCode: request.code,
      });
    }
  }
  const availableAddOns =
    organization.planKind === "FULL_SERVICE"
      ? catalog
          .filter((addOn) => !seen.has(addOn.id) && !pendingIds.has(addOn.id))
          .map((addOn) => ({
            id: addOn.id,
            name: addOn.name,
            description: addOn.description,
            price: addOn.price.toString(),
            status: "Available",
          }))
      : [];

  const plan = organization.servicePriceBand;
  const software = organization.planKind === "SOFTWARE";
  const softwareBands = software ? await loadBands("SOFTWARE") : [];
  return {
    user: { fullName: user.fullName, email: user.email },
    company: { id: organization.id, name: organization.name },
    property: property
      ? {
          id: property.id,
          code: property.code,
          name: property.name,
          propertyType: property.propertyType,
          address: address(property),
          street: property.street,
          city: property.city,
          state: property.state,
          zip: property.zip,
          unitCount: property.unitCount,
          squareFootage: property.squareFootage,
          status: property.status,
        }
      : null,
    cards: {
      activeServices: services.length,
      ongoingOrPendingRequests: requests,
    },
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          kind: plan.kind,
          productName: software ? SOFTWARE_PRODUCT : null,
          monthlyPrice: software
            ? Number(plan.monthlyPrice.toString()).toFixed(2)
            : plan.monthlyPrice.toString(),
          billingCycle: "Monthly Recurring",
          status: "Active",
          paidAt: organization.paidAt,
        }
      : null,
    tierStatus: software ? tierProgress(plan, softwareBands, property) : null,
    softwareTiers: software ? presentPlans(softwareBands, plan ? plan.id : null) : null,
    services,
    pendingAddOns,
    availableAddOns,
  };
}

module.exports = { overview };
