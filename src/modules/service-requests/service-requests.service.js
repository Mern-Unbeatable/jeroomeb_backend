const prisma = require("../../shared/prisma");
const stripe = require("../../shared/stripe");
const { HttpError } = require("../../shared/http");
const { createCode, isUniqueConflict } = require("../../shared/codes");
const {
  propertyTypes,
  propertyTypeByInput,
  statusActions,
  statusFilters,
} = require("./service-requests.validation");

const statusLabels = {
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const requestInclude = {
  items: { include: { addOnService: true } },
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function propertyTypeLabel(value) {
  const match = propertyTypes.find((option) => option.value === value);
  return match ? match.label : value;
}

function serviceType(addOn) {
  return addOn.sortOrder === 0 ? "Main Service" : "Add-on";
}

function sortedItems(request) {
  return [...request.items].sort(
    (left, right) => left.addOnService.sortOrder - right.addOnService.sortOrder
  );
}

function toServiceChoice(addOn) {
  return {
    id: addOn.id,
    name: addOn.name,
    description: addOn.description,
    type: serviceType(addOn),
  };
}

function primaryService(request) {
  const items = sortedItems(request);
  const addOn = items.find((item) => item.addOnService.sortOrder !== 0);
  const chosen = addOn || items[0];
  if (!chosen) return null;
  return toServiceChoice(chosen.addOnService);
}

function toListItem(request) {
  return {
    id: request.id,
    code: request.code,
    customerName: request.contactName,
    propertyType: propertyTypeLabel(request.propertyType),
    companyName: request.companyName,
    propertyInformation: request.notes,
    requestedService: primaryService(request),
    requestedAt: request.createdAt,
    status: request.status,
    statusLabel: statusLabels[request.status] || request.status,
  };
}

function toDetail(request) {
  return {
    ...toListItem(request),
    unitCount: request.unitCount,
    buildingCount: request.buildingCount,
    email: request.email,
    phone: request.phone,
    services: sortedItems(request).map((item) => toServiceChoice(item.addOnService)),
  };
}

function countsFrom(groups) {
  const totals = Object.fromEntries(groups.map((row) => [row.status, row._count._all]));
  const count = (status) => totals[status] || 0;
  return {
    total: Object.values(totals).reduce((sum, value) => sum + value, 0),
    pendingReview: count("PENDING_REVIEW"),
    inProgress: count("IN_PROGRESS"),
    approved: count("APPROVED"),
    completed: count("COMPLETED"),
  };
}

async function listOptions() {
  const services = await prisma.addOnService.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  return {
    propertyTypes,
    services: services.map(toServiceChoice),
  };
}

async function clientOwner(user, email) {
  if (user && user.organizationId) {
    return { organizationId: user.organizationId, submittedById: user.id };
  }
  const existing = await prisma.user.findFirst({
    where: {
      email,
      organizationId: { not: null },
      role: { in: ["CLIENT", "TENANT_ADMIN"] },
    },
  });
  if (!existing) return { organizationId: null, submittedById: user ? user.id : null };
  return { organizationId: existing.organizationId, submittedById: existing.id };
}

async function create(input, user) {
  const serviceIds = [...new Set(input.serviceIds)];
  const services = await prisma.addOnService.findMany({
    where: { id: { in: serviceIds }, active: true },
  });

  if (services.length !== serviceIds.length) {
    throw new HttpError(400, "One or more services are not available");
  }

  const owner = await clientOwner(user, normalizeEmail(input.email));

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const request = await prisma.serviceRequest.create({
        data: {
          code: createCode("SR"),
          organizationId: owner.organizationId,
          submittedById: owner.submittedById,
          kind: "FULL_SERVICE",
          propertyType: propertyTypeByInput.get(input.propertyType),
          unitCount: input.unitCount,
          buildingCount: input.buildingCount,
          contactName: input.name,
          companyName: input.company,
          email: normalizeEmail(input.email),
          phone: input.phone,
          notes: input.propertyInformation,
          status: "PENDING_REVIEW",
          items: {
            create: serviceIds.map((addOnServiceId) => ({ addOnServiceId })),
          },
        },
        include: requestInclude,
      });

      return { serviceRequest: toDetail(request) };
    } catch (error) {
      if (isUniqueConflict(error, "code") && attempt < 4) continue;
      throw error;
    }
  }

  throw new HttpError(500, "Could not save the quote");
}

function toCents(amount) {
  const cents = Math.round(Number(amount.toString()) * 100);
  if (!Number.isInteger(cents) || cents < 50) {
    throw new HttpError(400, "This add-on cannot be checked out");
  }
  return cents;
}

function checkoutReturnUrl(value) {
  const fallback = "https://jeroomeb.maktechgroup.tech/billing/success";
  const target = value || fallback;
  if (target.includes("{CHECKOUT_SESSION_ID}")) return target;
  return `${target}${target.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}

async function fullServiceAccount(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: { properties: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (
    !organization ||
    organization.subscriptionStatus !== "ACTIVE" ||
    organization.planKind !== "FULL_SERVICE"
  ) {
    throw new HttpError(403, "Add-ons are available on an active Service + Software plan");
  }
  return organization;
}

async function requestAddOn(user, addOnServiceId) {
  const organization = await fullServiceAccount(user);
  const addOn = await prisma.addOnService.findFirst({
    where: { id: addOnServiceId, active: true, sortOrder: { gt: 0 } },
  });
  if (!addOn) throw new HttpError(404, "Add-on not found");

  const existing = await prisma.serviceRequest.findFirst({
    where: {
      organizationId: organization.id,
      status: { in: ["PENDING_REVIEW", "APPROVED", "ONGOING", "IN_PROGRESS"] },
      items: { some: { addOnServiceId } },
    },
  });
  if (existing && existing.status === "PENDING_REVIEW") {
    throw new HttpError(409, "This add-on is already requested");
  }
  if (existing) throw new HttpError(409, "This add-on is already active");

  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: organization.id,
      metadata: {
        purpose: "ADD_ON",
        organizationId: organization.id,
        addOnServiceId: addOn.id,
        userId: user.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: toCents(addOn.price),
            product_data: { name: addOn.name },
          },
        },
      ],
      success_url: checkoutReturnUrl(),
      cancel_url: "https://jeroomeb.maktechgroup.tech/billing/cancel",
    });
  } catch (error) {
    console.error(error);
    throw new HttpError(502, "Payment could not be started");
  }

  return { sessionId: session.id, url: session.url };
}

async function confirmAddOn(user, sessionId) {
  const organization = await fullServiceAccount(user);
  const saved = await prisma.serviceRequest.findUnique({
    where: { stripeCheckoutSessionId: sessionId },
    include: requestInclude,
  });
  if (saved) {
    if (saved.organizationId !== organization.id) {
      throw new HttpError(403, "You do not have access to this payment");
    }
    return { serviceRequest: toDetail(saved) };
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    console.error(error);
    throw new HttpError(400, "Payment session not found");
  }
  if (session.metadata.purpose !== "ADD_ON" || session.metadata.organizationId !== organization.id) {
    throw new HttpError(403, "You do not have access to this payment");
  }
  if (session.payment_status !== "paid") {
    throw new HttpError(400, "Payment is not complete");
  }

  const addOn = await prisma.addOnService.findFirst({
    where: { id: session.metadata.addOnServiceId, sortOrder: { gt: 0 } },
  });
  if (!addOn) throw new HttpError(404, "Add-on not found");

  const property = organization.properties[0];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const request = await prisma.serviceRequest.create({
        data: {
          code: createCode("SR"),
          organizationId: organization.id,
          submittedById: user.id,
          propertyId: property ? property.id : null,
          kind: "FULL_SERVICE",
          propertyType: property ? property.propertyType : "RESIDENTIAL_MULTI_TENANT",
          unitCount: property && property.unitCount ? property.unitCount : 1,
          buildingCount: property ? property.buildingCount : null,
          contactName: user.fullName,
          companyName: organization.name,
          email: normalizeEmail(user.email),
          phone: user.phone,
          notes: `Paid add-on ${addOn.name}`,
          stripeCheckoutSessionId: session.id,
          status: "PENDING_REVIEW",
          items: { create: [{ addOnServiceId: addOn.id }] },
        },
        include: requestInclude,
      });
      return { serviceRequest: toDetail(request) };
    } catch (error) {
      if (isUniqueConflict(error, "stripeCheckoutSessionId")) {
        const current = await prisma.serviceRequest.findUnique({
          where: { stripeCheckoutSessionId: sessionId },
          include: requestInclude,
        });
        if (current) return { serviceRequest: toDetail(current) };
      }
      if (isUniqueConflict(error, "code") && attempt < 4) continue;
      throw error;
    }
  }
  throw new HttpError(500, "Could not save the add-on request");
}

function ownedWhere(actor) {
  if (!actor || actor.role === "SUPER_ADMIN" || actor.role === "TEAM_MEMBER") return {};
  const or = [{ submittedById: actor.id }, { email: normalizeEmail(actor.email) }];
  if (actor.organizationId) or.unshift({ organizationId: actor.organizationId });
  return { OR: or };
}

async function list(status, actor) {
  const owned = ownedWhere(actor);
  const where = { ...owned };
  if (status && status !== "all") {
    const mapped = statusFilters[status];
    if (!mapped) throw new HttpError(400, "Unknown status");
    where.status = mapped;
  }

  const [groups, requests] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["status"],
      where: owned,
      _count: { _all: true },
    }),
    prisma.serviceRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    counts: countsFrom(groups),
    requests: requests.map(toListItem),
  };
}

function canViewRequest(request, actor) {
  if (!actor || actor.role === "SUPER_ADMIN" || actor.role === "TEAM_MEMBER") return true;
  return (
    (actor.organizationId && request.organizationId === actor.organizationId) ||
    request.submittedById === actor.id ||
    request.email === actor.email
  );
}

async function getById(id, actor) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
  if (!request) throw new HttpError(404, "Service request not found");
  if (!canViewRequest(request, actor)) {
    throw new HttpError(403, "You do not have access to this");
  }
  return { serviceRequest: toDetail(request) };
}

async function updateStatus(id, statusInput, actor) {
  const status = statusActions[statusInput];
  if (!status) throw new HttpError(400, "Unknown status");

  const request = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, "Service request not found");
  if (request.status === status) return getById(id);

  const owner = request.organizationId
    ? null
    : await clientOwner(null, normalizeEmail(request.email));

  await prisma.$transaction([
    prisma.serviceRequest.update({
      where: { id },
      data: {
        status,
        ...(owner && owner.organizationId
          ? { organizationId: owner.organizationId, submittedById: owner.submittedById }
          : {}),
      },
    }),
    prisma.activityEvent.create({
      data: {
        actorId: actor ? actor.id : null,
        type: "SERVICE_REQUEST_STATUS",
        summary: `${request.code} marked ${statusLabels[status]}`,
        entityType: "ServiceRequest",
        entityId: request.id,
      },
    }),
  ]);

  return getById(id);
}

async function remove(id, actor) {
  const request = await prisma.serviceRequest.findUnique({ where: { id } });
  if (!request) throw new HttpError(404, "Service request not found");

  await prisma.$transaction([
    prisma.activityEvent.create({
      data: {
        actorId: actor ? actor.id : null,
        type: "SERVICE_REQUEST_DELETED",
        summary: `${request.code} deleted`,
        entityType: "ServiceRequest",
        entityId: request.id,
      },
    }),
    prisma.serviceRequest.delete({ where: { id } }),
  ]);

  return { message: "Service request deleted" };
}

module.exports = {
  listOptions,
  create,
  requestAddOn,
  confirmAddOn,
  list,
  getById,
  updateStatus,
  remove,
};
