const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

const assignmentRank = { PRIMARY: 0, BACKUP: 1, IN_HOUSE: 2 };

function location(profile) {
  return [profile.city, profile.state].filter(Boolean).join(", ");
}

function placeLine(organizationName, profile) {
  const area = location(profile);
  return area ? `${organizationName} — ${area}` : organizationName;
}

async function assignedSpecialists(organizationId) {
  const entries = await prisma.propertyRoster.findMany({
    where: { property: { organizationId } },
    include: {
      specialist: {
        include: { user: { select: { fullName: true } } },
      },
      property: { select: { organization: { select: { name: true } } } },
    },
    orderBy: { id: "asc" },
  });

  const bySpecialist = new Map();
  for (const entry of entries) {
    const current = bySpecialist.get(entry.specialistId);
    if (current && assignmentRank[current.assignment] <= assignmentRank[entry.assignment]) continue;
    bySpecialist.set(entry.specialistId, entry);
  }

  return [...bySpecialist.values()].map((entry) => ({
    specialistId: entry.specialistId,
    code: entry.specialist.code,
    fullName: entry.specialist.user.fullName,
    roleLabel: "Operations Continuity Specialist",
    organizationName: entry.property.organization.name,
    location: location(entry.specialist) || null,
    place: placeLine(entry.property.organization.name, entry.specialist),
    assignment: entry.assignment,
    status: "ASSIGNED",
  }));
}

function toFeedback(row) {
  return {
    id: row.id,
    specialistId: row.specialistId,
    specialistName: row.specialist.user.fullName,
    code: row.specialist.code,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };
}

async function list(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const [specialists, feedback] = await Promise.all([
    assignedSpecialists(user.organizationId),
    prisma.specialistFeedback.findMany({
      where: { organizationId: user.organizationId },
      include: { specialist: { include: { user: { select: { fullName: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { specialists, feedback: feedback.map(toFeedback) };
}

async function create(user, input) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const assigned = await prisma.propertyRoster.findFirst({
    where: {
      specialistId: input.specialistId,
      property: { organizationId: user.organizationId },
    },
  });
  if (!assigned) throw new HttpError(400, "This specialist is not assigned to your property");

  const row = await prisma.specialistFeedback.create({
    data: {
      organizationId: user.organizationId,
      authorId: user.id,
      specialistId: input.specialistId,
      rating: input.rating,
      comment: input.comment,
    },
    include: { specialist: { include: { user: { select: { fullName: true } } } } },
  });

  await prisma.activityEvent.create({
    data: {
      actorId: user.id,
      type: "SPECIALIST_FEEDBACK",
      summary: `${user.fullName} rated ${row.specialist.user.fullName}`,
      entityType: "SpecialistFeedback",
      entityId: row.id,
    },
  });

  return { feedback: toFeedback(row) };
}

module.exports = { list, create };
