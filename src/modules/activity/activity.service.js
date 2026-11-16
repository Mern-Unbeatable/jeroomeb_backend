const prisma = require("../../shared/prisma");

const titles = {
  INSPECTION_RESOLVED: "Inspection report submitted",
  INSPECTION_CREATED: "Inspection scheduled",
  INSPECTION_UPDATED: "Inspection updated",
  INSPECTION_CANCELLED: "Inspection cancelled",
  INSPECTION_STARTED: "Inspection started",
  TENANT_PROVISIONED: "New tenant provisioned",
  ROSTER_ASSIGNED: "Property assignment updated",
  ROSTER_REMOVED: "Property assignment removed",
  PROPERTY_STATUS: "Property status updated",
  SUBSCRIPTION_ACTIVATED: "Subscription activated",
  PLAN_CHANGED: "Plan changed",
  SUBSCRIPTION_CANCEL_SCHEDULED: "Cancellation scheduled",
  SERVICE_REQUEST_STATUS: "Service request updated",
  SERVICE_REQUEST_DELETED: "Service request deleted",
  ACCESS_KEYS_SAVED: "Access keys saved",
  ACCESS_KEYS_UPDATED: "Access keys updated",
  CHAT_DELETED: "Chat deleted",
  ADD_ON_CREATED: "Add-on created",
  ADD_ON_UPDATED: "Add-on updated",
  ADD_ON_DELETED: "Add-on deleted",
  PLATFORM_PRICING_SAVED: "Pricing saved",
  PLATFORM_PRICING_RESTORED: "Pricing restored",
  SOFTWARE_PRICING_SAVED: "Software pricing saved",
  PRICE_UPDATED: "Price updated",
};

function toActivity(event) {
  return {
    id: event.id,
    type: event.type,
    title: titles[event.type] || event.summary,
    summary: event.summary,
    actorName: event.actor ? event.actor.fullName : null,
    entityType: event.entityType,
    entityId: event.entityId,
    createdAt: event.createdAt,
  };
}

async function list(limit) {
  const events = await prisma.activityEvent.findMany({
    include: { actor: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return events.map(toActivity);
}

module.exports = { list };
