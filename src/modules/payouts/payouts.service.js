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

function money(value) {
  return Number(value == null ? 0 : value.toString()).toFixed(2);
}

function toPayout(payout) {
  return {
    id: payout.id,
    specialistId: payout.specialistId,
    specialistName: payout.specialist.user.fullName,
    specialistCode: payout.specialist.code,
    inspectionId: payout.inspectionId,
    propertyId: payout.inspection ? payout.inspection.property.id : null,
    propertyCode: payout.inspection ? payout.inspection.property.code : null,
    propertyName: payout.inspection ? payout.inspection.property.name : null,
    templateName: payout.inspection ? payout.inspection.template.name : null,
    completedAt: payout.inspection ? payout.inspection.completedAt : null,
    amount: money(payout.amount),
    status: payout.status,
    paymentAt: payout.status === "PAID" ? payout.paidAt : payout.status === "APPROVED" ? payout.updatedAt : null,
    paidAt: payout.paidAt,
    createdAt: payout.createdAt,
  };
}

function cardsFrom(groups) {
  const card = (status) => {
    const row = groups.find((item) => item.status === status);
    return {
      amount: money(row && row._sum.amount),
      count: row ? row._count._all : 0,
    };
  };
  return {
    pendingApproval: card("PENDING"),
    readyToPay: card("APPROVED"),
    totalPaidOut: card("PAID"),
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
  const [payouts, groups] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: payoutInclude,
      orderBy: { createdAt: "desc" },
    }),
    prisma.payout.groupBy({
      by: ["status"],
      where: ownId ? { specialistId: ownId } : {},
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  return { cards: cardsFrom(groups), payouts: payouts.map(toPayout) };
}

async function requestPayout(actor, input) {
  const profile = await prisma.specialistProfile.findUnique({ where: { userId: actor.id } });
  if (!profile) throw new HttpError(403, "You do not have access to this");

  const inspection = await prisma.inspection.findUnique({
    where: { id: input.inspectionId },
    include: {
      property: { include: { compensationTier: true } },
      payout: true,
    },
  });
  if (!inspection || inspection.specialistId !== profile.id) {
    throw new HttpError(404, "Inspection not found");
  }
  if (inspection.status !== "RESOLVED_CLOSED") {
    throw new HttpError(400, "Resolve the inspection before requesting payment");
  }
  if (inspection.payout) throw new HttpError(409, "Payment was already requested");
  if (!inspection.property.compensationTier) {
    throw new HttpError(400, "This property has no compensation tier");
  }

  const payout = await prisma.payout.create({
    data: {
      specialistId: profile.id,
      inspectionId: inspection.id,
      amount: inspection.property.compensationTier.payoutAmount,
      status: "PENDING",
    },
    include: payoutInclude,
  });
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "PAYOUT_REQUESTED",
      summary: `${actor.fullName} requested payment for ${inspection.property.code}`,
      entityType: "Payout",
      entityId: payout.id,
    },
  });
  return { payout: toPayout(payout) };
}

async function findPayout(id) {
  const payout = await prisma.payout.findUnique({ where: { id }, include: payoutInclude });
  if (!payout) throw new HttpError(404, "Payout not found");
  return payout;
}

async function approve(id, actor) {
  const payout = await findPayout(id);
  if (payout.status !== "PENDING") throw new HttpError(409, "This payout is not awaiting approval");
  const saved = await prisma.payout.update({
    where: { id },
    data: { status: "APPROVED" },
    include: payoutInclude,
  });
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "PAYOUT_APPROVED",
      summary: `Approved payment for ${payout.specialist.user.fullName}`,
      entityType: "Payout",
      entityId: id,
    },
  });
  return { payout: toPayout(saved) };
}

async function markPaid(id, actor) {
  const payout = await findPayout(id);
  if (payout.status === "PAID") throw new HttpError(409, "This payout is already paid");
  if (payout.status !== "APPROVED") throw new HttpError(400, "Approve this payout before paying");
  const saved = await prisma.payout.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date() },
    include: payoutInclude,
  });
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "PAYOUT_PAID",
      summary: `Marked payment paid for ${payout.specialist.user.fullName}`,
      entityType: "Payout",
      entityId: id,
    },
  });
  return { payout: toPayout(saved) };
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

module.exports = { list, getById, requestPayout, approve, markPaid };
