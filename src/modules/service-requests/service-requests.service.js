const prisma = require("../../shared/prisma");
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

async function list(status) {
  const where = {};
  if (status && status !== "all") {
    const mapped = statusFilters[status];
    if (!mapped) throw new HttpError(400, "Unknown status");
    where.status = mapped;
  }

  const [groups, requests] = await Promise.all([
    prisma.serviceRequest.groupBy({
      by: ["status"],
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

async function getById(id) {
  const request = await prisma.serviceRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
  if (!request) throw new HttpError(404, "Service request not found");
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

module.exports = { listOptions, create, list, getById, updateStatus, remove };
