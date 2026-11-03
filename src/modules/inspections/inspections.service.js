const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { inspectionStatuses } = require("./inspections.validation");

const inspectionInclude = {
  property: {
    select: {
      id: true,
      code: true,
      name: true,
      scheduledAt: true,
      checklistsAvailable247: true,
      compensationTier: { select: { id: true, name: true, payoutAmount: true } },
    },
  },
  template: { select: { id: true, name: true } },
  specialist: {
    include: { user: { select: { id: true, fullName: true, email: true } } },
  },
  report: true,
  payout: true,
  _count: { select: { answers: true } },
};

function money(value) {
  return value == null ? null : value.toString();
}

function isAdmin(actor) {
  return actor.role === "SUPER_ADMIN" || actor.role === "TEAM_MEMBER";
}

function isOverdue(inspection) {
  return (
    (inspection.status === "PENDING" || inspection.status === "IN_PROGRESS") &&
    inspection.scheduledAt.getTime() < Date.now()
  );
}

function toAnswer(answer) {
  if (!answer) return null;
  return {
    id: answer.id,
    result: answer.result,
    note: answer.note,
    photoUrl: answer.photoUrl,
    latitude: answer.latitude == null ? null : answer.latitude.toString(),
    longitude: answer.longitude == null ? null : answer.longitude.toString(),
    capturedAt: answer.capturedAt,
  };
}

function toPayout(payout) {
  if (!payout) return null;
  return {
    id: payout.id,
    specialistId: payout.specialistId,
    inspectionId: payout.inspectionId,
    amount: money(payout.amount),
    status: payout.status,
    paidAt: payout.paidAt,
    createdAt: payout.createdAt,
  };
}

function toReport(report) {
  if (!report) return null;
  return {
    id: report.id,
    inspectionId: report.inspectionId,
    summary: report.summary,
    pdfUrl: report.pdfUrl,
    emailedAt: report.emailedAt,
    createdAt: report.createdAt,
  };
}

function toInspection(inspection, items) {
  const body = {
    id: inspection.id,
    propertyId: inspection.propertyId,
    propertyCode: inspection.property.code,
    propertyName: inspection.property.name,
    templateId: inspection.templateId,
    templateName: inspection.template.name,
    specialistId: inspection.specialistId,
    specialistName: inspection.specialist ? inspection.specialist.user.fullName : null,
    scheduledAt: inspection.scheduledAt,
    startedAt: inspection.startedAt,
    completedAt: inspection.completedAt,
    status: inspection.status,
    overdue: isOverdue(inspection),
    answerCount: inspection._count.answers,
    report: toReport(inspection.report),
    payout: toPayout(inspection.payout),
    createdAt: inspection.createdAt,
  };
  if (items) body.items = items;
  return body;
}

async function specialistProfile(actor) {
  if (actor.role !== "SPECIALIST") return null;
  return prisma.specialistProfile.findUnique({ where: { userId: actor.id } });
}

async function assertSpecialist(specialistId) {
  const specialist = await prisma.specialistProfile.findUnique({ where: { id: specialistId } });
  if (!specialist) throw new HttpError(400, "Specialist not found");
  return specialist;
}

async function findInspection(id) {
  const inspection = await prisma.inspection.findUnique({
    where: { id },
    include: inspectionInclude,
  });
  if (!inspection) throw new HttpError(404, "Inspection not found");
  return inspection;
}

async function assertCanView(inspection, actor) {
  if (isAdmin(actor)) return;
  const profile = await specialistProfile(actor);
  if (!profile || inspection.specialistId !== profile.id) {
    throw new HttpError(403, "You do not have access to this");
  }
}

function assertSpecialistCanWork(inspection, actor) {
  if (isAdmin(actor)) return;
  if (inspection.scheduledAt.getTime() > Date.now()) {
    throw new HttpError(400, "The specialist can't start before the scheduled time");
  }
}

function assertOpen(inspection) {
  if (inspection.status === "CANCELLED") {
    throw new HttpError(400, "This inspection is cancelled");
  }
  if (inspection.status === "RESOLVED_CLOSED") {
    throw new HttpError(400, "This inspection is already resolved");
  }
}

async function itemsFor(inspection) {
  const items = await prisma.checklistItem.findMany({
    where: { templateId: inspection.templateId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      answers: { where: { inspectionId: inspection.id } },
    },
  });
  return items.map((item) => ({
    id: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    sortOrder: item.sortOrder,
    required: item.required,
    answer: toAnswer(item.answers[0] || null),
  }));
}

async function present(inspection) {
  return { inspection: toInspection(inspection, await itemsFor(inspection)) };
}

async function options() {
  const tiers = await prisma.compensationTier.findMany({
    where: { active: true },
    orderBy: { payoutAmount: "asc" },
  });
  return {
    compensationTiers: tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      payoutAmount: money(tier.payoutAmount),
    })),
  };
}

async function list(actor, query) {
  const where = {};
  if (query.status) {
    if (!inspectionStatuses.includes(query.status)) {
      throw new HttpError(400, "Unknown inspection status");
    }
    where.status = query.status;
  }
  if (query.propertyId) where.propertyId = query.propertyId;

  const profile = await specialistProfile(actor);
  if (actor.role === "SPECIALIST") {
    where.specialistId = profile ? profile.id : "00000000-0000-0000-0000-000000000000";
  }

  const inspections = await prisma.inspection.findMany({
    where,
    include: inspectionInclude,
    orderBy: { scheduledAt: "asc" },
  });
  return { inspections: inspections.map((inspection) => toInspection(inspection)) };
}

async function getById(id, actor) {
  const inspection = await findInspection(id);
  await assertCanView(inspection, actor);
  return present(inspection);
}

async function create(input, actor) {
  const property = await prisma.property.findUnique({
    where: { id: input.propertyId },
    include: {
      checklists: { include: { template: true } },
      roster: { where: { assignment: "PRIMARY" }, orderBy: { id: "asc" }, take: 1 },
    },
  });
  if (!property) throw new HttpError(404, "Property not found");

  const templates = property.checklists.map((link) => link.template).filter((template) => template.active);
  if (!templates.length) {
    throw new HttpError(400, "This property has no checklists enabled");
  }

  const scheduledAt = input.scheduledAt || property.scheduledAt;
  if (!scheduledAt) throw new HttpError(400, "A scheduled time is required");

  let specialistId = null;
  if (input.specialistId) {
    await assertSpecialist(input.specialistId);
    specialistId = input.specialistId;
  } else if (input.specialistId === undefined && property.roster[0]) {
    specialistId = property.roster[0].specialistId;
  }

  const open = await prisma.inspection.findMany({
    where: {
      propertyId: property.id,
      templateId: { in: templates.map((template) => template.id) },
      status: { in: ["PENDING", "IN_PROGRESS"] },
    },
  });
  const openTemplateIds = new Set(open.map((row) => row.templateId));
  const pending = templates.filter((template) => !openTemplateIds.has(template.id));
  if (!pending.length) {
    throw new HttpError(409, "Open inspections already exist for these checklists");
  }

  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const template of pending) {
      const inspection = await tx.inspection.create({
        data: {
          propertyId: property.id,
          templateId: template.id,
          specialistId,
          scheduledAt,
        },
        include: inspectionInclude,
      });
      await tx.activityEvent.create({
        data: {
          actorId: actor.id,
          type: "INSPECTION_CREATED",
          summary: `${property.code} ${template.name} scheduled`,
          entityType: "Inspection",
          entityId: inspection.id,
        },
      });
      rows.push(inspection);
    }
    return rows;
  });

  return { inspections: created.map((inspection) => toInspection(inspection)) };
}

async function update(id, input, actor) {
  const existing = await findInspection(id);
  assertOpen(existing);
  if (input.specialistId) await assertSpecialist(input.specialistId);

  const data = {};
  if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
  if (input.specialistId !== undefined) data.specialistId = input.specialistId;
  if (!Object.keys(data).length) {
    throw new HttpError(400, "Send a scheduled time or a specialist");
  }

  const inspection = await prisma.$transaction(async (tx) => {
    const saved = await tx.inspection.update({
      where: { id },
      data,
      include: inspectionInclude,
    });
    await tx.activityEvent.create({
      data: {
        actorId: actor.id,
        type: "INSPECTION_UPDATED",
        summary: `${existing.property.code} inspection schedule updated`,
        entityType: "Inspection",
        entityId: id,
      },
    });
    return saved;
  });

  return present(inspection);
}

async function cancel(id, actor) {
  const existing = await findInspection(id);
  if (existing.status === "RESOLVED_CLOSED") {
    throw new HttpError(400, "This inspection is already resolved");
  }
  if (existing.status === "CANCELLED") return present(existing);

  const inspection = await prisma.$transaction(async (tx) => {
    const saved = await tx.inspection.update({
      where: { id },
      data: { status: "CANCELLED" },
      include: inspectionInclude,
    });
    await tx.activityEvent.create({
      data: {
        actorId: actor.id,
        type: "INSPECTION_CANCELLED",
        summary: `${existing.property.code} inspection cancelled`,
        entityType: "Inspection",
        entityId: id,
      },
    });
    return saved;
  });

  return present(inspection);
}

async function saveAnswers(id, input, actor) {
  const existing = await findInspection(id);
  await assertCanView(existing, actor);
  assertSpecialistCanWork(existing, actor);
  assertOpen(existing);

  const byItem = new Map();
  for (const answer of input.answers) byItem.set(answer.checklistItemId, answer);
  const itemIds = [...byItem.keys()];
  const items = await prisma.checklistItem.findMany({
    where: { id: { in: itemIds }, templateId: existing.templateId },
  });
  if (items.length !== itemIds.length) {
    throw new HttpError(400, "One or more checklist items are not on this inspection");
  }

  const capturedAt = new Date();
  const inspection = await prisma.$transaction(async (tx) => {
    for (const answer of byItem.values()) {
      const data = {
        result: answer.result,
        note: answer.note || null,
        photoUrl: answer.photoUrl || null,
        latitude: answer.latitude == null ? null : answer.latitude,
        longitude: answer.longitude == null ? null : answer.longitude,
        capturedAt,
      };
      await tx.inspectionAnswer.upsert({
        where: {
          inspectionId_checklistItemId: {
            inspectionId: id,
            checklistItemId: answer.checklistItemId,
          },
        },
        create: { inspectionId: id, checklistItemId: answer.checklistItemId, ...data },
        update: data,
      });
    }

    const starting = existing.status === "PENDING";
    const saved = await tx.inspection.update({
      where: { id },
      data: starting ? { status: "IN_PROGRESS", startedAt: capturedAt } : {},
      include: inspectionInclude,
    });
    if (starting) {
      await tx.activityEvent.create({
        data: {
          actorId: actor.id,
          type: "INSPECTION_STARTED",
          summary: `${existing.property.code} inspection started`,
          entityType: "Inspection",
          entityId: id,
        },
      });
    }
    return saved;
  });

  return present(inspection);
}

async function resolve(id, input, actor) {
  const existing = await findInspection(id);
  await assertCanView(existing, actor);
  if (existing.status === "CANCELLED") {
    throw new HttpError(400, "This inspection is cancelled");
  }
  if (existing.status === "RESOLVED_CLOSED") {
    return { ...(await present(existing)), nextInspection: null };
  }

  assertSpecialistCanWork(existing, actor);
  if (!existing.specialistId) {
    throw new HttpError(400, "Assign a specialist before resolving this inspection");
  }
  if (!existing.property.compensationTier) {
    throw new HttpError(400, "This property has no compensation tier");
  }

  const required = await prisma.checklistItem.findMany({
    where: { templateId: existing.templateId, required: true },
    include: { answers: { where: { inspectionId: id, result: { not: null } } } },
  });
  const missing = required.some((item) => item.answers.length === 0);
  if (missing) {
    throw new HttpError(400, "Required checklist items are still unanswered");
  }

  const completedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    await tx.report.create({
      data: {
        inspectionId: id,
        summary: input.summary || null,
      },
    });
    await tx.payout.create({
      data: {
        specialistId: existing.specialistId,
        inspectionId: id,
        amount: existing.property.compensationTier.payoutAmount,
        status: "PENDING",
      },
    });
    let next = null;
    if (existing.property.checklistsAvailable247) {
      next = await tx.inspection.create({
        data: {
          propertyId: existing.propertyId,
          templateId: existing.templateId,
          specialistId: existing.specialistId,
          scheduledAt: completedAt,
        },
        include: inspectionInclude,
      });
      await tx.activityEvent.create({
        data: {
          actorId: actor.id,
          type: "INSPECTION_CREATED",
          summary: `${existing.property.code} ${existing.template.name} stays on the board`,
          entityType: "Inspection",
          entityId: next.id,
        },
      });
    }
    const saved = await tx.inspection.update({
      where: { id },
      data: { status: "RESOLVED_CLOSED", completedAt },
      include: inspectionInclude,
    });
    await tx.activityEvent.create({
      data: {
        actorId: actor.id,
        type: "INSPECTION_RESOLVED",
        summary: `${existing.property.code} inspection resolved`,
        entityType: "Inspection",
        entityId: id,
      },
    });
    return { saved, next };
  });

  return {
    ...(await present(result.saved)),
    nextInspection: result.next ? toInspection(result.next) : null,
  };
}

module.exports = {
  options,
  list,
  getById,
  create,
  update,
  cancel,
  saveAnswers,
  resolve,
};
