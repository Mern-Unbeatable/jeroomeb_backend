const prisma = require("../../shared/prisma");
const analyticsService = require("../analytics/analytics.service");
const activityService = require("../activity/activity.service");

const inspectionLabels = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  RESOLVED_CLOSED: "Completed",
  CANCELLED: "Cancelled",
};

const requestLabels = {
  PENDING_REVIEW: "Pending Review",
  APPROVED: "Approved",
  IN_PROGRESS: "In Progress",
  ONGOING: "Ongoing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const workflowLabels = {
  FULL_SERVICE: "Full Service",
  SOFTWARE: "Software Only",
};

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function requestedService(request) {
  const items = [...request.items].sort(
    (left, right) => left.addOnService.sortOrder - right.addOnService.sortOrder
  );
  const addOn = items.find((item) => item.addOnService.sortOrder !== 0);
  const chosen = addOn || items[0];
  return chosen ? chosen.addOnService.name : null;
}

async function upcomingInspections(now) {
  const until = addDays(now, 7);
  const inspections = await prisma.inspection.findMany({
    where: {
      scheduledAt: { gte: now, lt: until },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
    include: {
      property: {
        select: {
          id: true,
          code: true,
          name: true,
          organization: { select: { planKind: true } },
        },
      },
      specialist: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 8,
  });

  return inspections.map((inspection) => ({
    id: inspection.id,
    propertyId: inspection.property.id,
    propertyName: inspection.property.name,
    propertyCode: inspection.property.code,
    inspectorName: inspection.specialist ? inspection.specialist.user.fullName : null,
    scheduledAt: inspection.scheduledAt,
    workflow: workflowLabels[inspection.property.organization.planKind] || null,
    status: inspection.status,
    statusLabel: inspectionLabels[inspection.status] || inspection.status,
  }));
}

async function recentRequests() {
  const requests = await prisma.serviceRequest.findMany({
    include: {
      items: { include: { addOnService: true } },
      property: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  return requests.map((request) => ({
    id: request.id,
    code: request.code,
    name: requestedService(request),
    companyName: request.companyName,
    propertyId: request.property ? request.property.id : null,
    propertyName: request.property ? request.property.name : null,
    propertyCode: request.property ? request.property.code : null,
    requestedAt: request.createdAt,
    status: request.status,
    statusLabel: requestLabels[request.status] || request.status,
  }));
}

async function overview() {
  const now = new Date();
  const [report, recentActivity, inspections, serviceRequests] = await Promise.all([
    analyticsService.report(),
    activityService.list(8),
    upcomingInspections(now),
    recentRequests(),
  ]);

  return {
    cards: report.cards,
    revenue: report.revenue,
    recentActivity,
    upcomingInspections: inspections,
    serviceRequests,
  };
}

module.exports = { overview };
