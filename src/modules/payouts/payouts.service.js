const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

const payoutStatuses = ["PENDING", "APPROVED", "PAID"];

const payoutInclude = {
  specialist: { include: { user: { select: { fullName: true, email: true } } } },
  inspection: {
    include: {
      property: { select: { id: true, code: true, name: true } },
      template: { select: { name: true } },
    },
  },
};

function toPayout(payout) {
  return {
    id: payout.id,
    specialistId: payout.specialistId,
    specialistName: payout.specialist.user.fullName,
    inspectionId: payout.inspectionId,
    propertyId: payout.inspection ? payout.inspection.property.id : null,
    propertyCode: payout.inspection ? payout.inspection.property.code : null,
    propertyName: payout.inspection ? payout.inspection.property.name : null,
    templateName: payout.inspection ? payout.inspection.template.name : null,
    amount: payout.amount.toString(),
    status: payout.status,
    paidAt: payout.paidAt,
    createdAt: payout.createdAt,
  };
}

async function specialistId(actor) {
  if (actor.role !== "SPECIALIST") return null;
  const profile = await prisma.specialistProfile.findUnique({ where: { userId: actor.id } });
  return profile ? profile.id : "00000000-0000-0000-0000-000000000000";
}

async function list(actor, query) {
  const where = {};
  if (query.status) {
    if (!payoutStatuses.includes(query.status)) throw new HttpError(400, "Unknown payout status");
    where.status = query.status;
  }
  const ownId = await specialistId(actor);
  if (ownId) where.specialistId = ownId;
  const payouts = await prisma.payout.findMany({
    where,
    include: payoutInclude,
    orderBy: { createdAt: "desc" },
  });
  return { payouts: payouts.map(toPayout) };
}

async function getById(id, actor) {
  const payout = await prisma.payout.findUnique({ where: { id }, include: payoutInclude });
  if (!payout) throw new HttpError(404, "Payout not found");
  const ownId = await specialistId(actor);
  if (ownId && payout.specialistId !== ownId) {
    throw new HttpError(403, "You do not have access to this");
  }
  return { payout: toPayout(payout) };
}

module.exports = { list, getById };
