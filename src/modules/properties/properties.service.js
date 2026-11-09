const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { createCode, isUniqueConflict } = require("../../shared/codes");

const propertyInclude = {
  organization: { select: { id: true, name: true } },
  compensationTier: { select: { id: true, name: true, payoutAmount: true } },
  inspectionDays: true,
  checklists: { include: { template: { select: { id: true, name: true } } } },
  roster: {
    include: {
      specialist: {
        include: { user: { select: { id: true, fullName: true, email: true } } },
      },
    },
  },
};

function money(value) {
  return value == null ? null : value.toString();
}

function toProperty(property) {
  return {
    id: property.id,
    code: property.code,
    name: property.name,
    propertyType: property.propertyType,
    status: property.status,
    contactName: property.contactName,
    email: property.email,
    phone: property.phone,
    street: property.street,
    city: property.city,
    state: property.state,
    zip: property.zip,
    county: property.county,
    notes: property.notes,
    unitCount: property.unitCount,
    buildingCount: property.buildingCount,
    squareFootage: property.squareFootage,
    latitude: property.latitude == null ? null : property.latitude.toString(),
    longitude: property.longitude == null ? null : property.longitude.toString(),
    geofenceEnabled: property.geofenceEnabled,
    geofenceRadiusMeters: property.geofenceRadiusMeters,
    timezone: property.timezone,
    photoIdRequired: property.photoIdRequired,
    checklistsAvailable247: property.checklistsAvailable247,
    scheduledAt: property.scheduledAt,
    organization: property.organization,
    compensationTier: property.compensationTier
      ? {
          id: property.compensationTier.id,
          name: property.compensationTier.name,
          payoutAmount: money(property.compensationTier.payoutAmount),
        }
      : null,
    inspectionDays: property.inspectionDays.map((day) => day.weekday),
    checklists: property.checklists.map((link) => link.template),
    roster: property.roster.map((entry) => ({
      id: entry.id,
      assignment: entry.assignment,
      specialistId: entry.specialistId,
      specialistName: entry.specialist.user.fullName,
      specialistEmail: entry.specialist.user.email,
    })),
    createdAt: property.createdAt,
  };
}

function propertyData(input) {
  const data = {};
  const fields = [
    "name",
    "propertyType",
    "contactName",
    "email",
    "phone",
    "street",
    "city",
    "state",
    "zip",
    "county",
    "notes",
    "status",
    "unitCount",
    "buildingCount",
    "squareFootage",
    "latitude",
    "longitude",
    "geofenceEnabled",
    "geofenceRadiusMeters",
    "timezone",
    "photoIdRequired",
    "checklistsAvailable247",
    "scheduledAt",
    "compensationTierId",
  ];
  for (const field of fields) {
    if (input[field] !== undefined) data[field] = input[field];
  }
  return data;
}

async function checklistIds(input) {
  if (!input.checklistTemplateIds) return null;
  const ids = [...new Set(input.checklistTemplateIds)];
  if (!ids.length) return [];
  const templates = await prisma.checklistTemplate.findMany({
    where: { id: { in: ids }, active: true },
  });
  if (templates.length !== ids.length) {
    throw new HttpError(400, "One or more checklist templates are not available");
  }
  return ids;
}

async function assertWithinLimit(organizationId) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { licensePlan: { select: { propertyLimit: true } } },
  });
  if (!organization) throw new HttpError(404, "Tenant not found");

  const limit = organization.propertyLimit ?? organization.licensePlan?.propertyLimit ?? null;
  if (limit == null) return organization;

  const count = await prisma.property.count({ where: { organizationId } });
  if (count >= limit) {
    throw new HttpError(409, "This tenant has reached its property limit");
  }
  return organization;
}

async function list() {
  const properties = await prisma.property.findMany({
    include: propertyInclude,
    orderBy: { createdAt: "desc" },
  });
  return { properties: properties.map(toProperty) };
}

async function getById(id) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: propertyInclude,
  });
  if (!property) throw new HttpError(404, "Property not found");
  return { property: toProperty(property) };
}

async function create(input, actor) {
  await assertWithinLimit(input.organizationId);
  if (input.compensationTierId) {
    const tier = await prisma.compensationTier.findUnique({
      where: { id: input.compensationTierId },
    });
    if (!tier) throw new HttpError(400, "Compensation tier not found");
  }

  const days = [...new Set(input.inspectionDays || [])];
  const templates = (await checklistIds(input)) || [];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const property = await prisma.property.create({
        data: {
          ...propertyData(input),
          code: createCode("PROP"),
          organizationId: input.organizationId,
          inspectionDays: {
            create: days.map((weekday) => ({ weekday })),
          },
          checklists: {
            create: templates.map((templateId) => ({ templateId })),
          },
        },
        include: propertyInclude,
      });
      return { property: toProperty(property) };
    } catch (error) {
      if (isUniqueConflict(error, "code") && attempt < 4) continue;
      throw error;
    }
  }

  throw new HttpError(500, "Could not create the property");
}

async function update(id, input, actor) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Property not found");
  if (input.compensationTierId) {
    const tier = await prisma.compensationTier.findUnique({
      where: { id: input.compensationTierId },
    });
    if (!tier) throw new HttpError(400, "Compensation tier not found");
  }

  const days = input.inspectionDays ? [...new Set(input.inspectionDays)] : null;
  const templates = await checklistIds(input);
  const statusChanged = input.status && input.status !== existing.status;

  await prisma.$transaction(async (tx) => {
    await tx.property.update({
      where: { id },
      data: propertyData(input),
    });
    if (templates) {
      await tx.propertyChecklist.deleteMany({ where: { propertyId: id } });
      if (templates.length) {
        await tx.propertyChecklist.createMany({
          data: templates.map((templateId) => ({ propertyId: id, templateId })),
        });
      }
    }
    if (days) {
      await tx.propertyInspectionDay.deleteMany({ where: { propertyId: id } });
      if (days.length) {
        await tx.propertyInspectionDay.createMany({
          data: days.map((weekday) => ({ propertyId: id, weekday })),
        });
      }
    }
    if (statusChanged) {
      await tx.activityEvent.create({
        data: {
          actorId: actor ? actor.id : null,
          type: "PROPERTY_STATUS",
          summary: `${existing.code} marked ${input.status}`,
          entityType: "Property",
          entityId: id,
        },
      });
    }
  });

  return getById(id);
}

async function remove(id) {
  const existing = await prisma.property.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Property not found");
  try {
    await prisma.property.delete({ where: { id } });
  } catch (error) {
    if (error && error.code === "P2003") {
      throw new HttpError(409, "This property is in use");
    }
    throw error;
  }
  return { message: "Property deleted" };
}

async function assignRoster(propertyId, input, actor) {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new HttpError(404, "Property not found");

  const specialist = await prisma.specialistProfile.findUnique({
    where: { id: input.specialistId },
    include: { user: { select: { fullName: true } } },
  });
  if (!specialist) throw new HttpError(404, "Specialist not found");

  const entry = await prisma.propertyRoster.upsert({
    where: {
      propertyId_specialistId: {
        propertyId,
        specialistId: input.specialistId,
      },
    },
    create: {
      propertyId,
      specialistId: input.specialistId,
      assignment: input.assignment,
    },
    update: { assignment: input.assignment },
  });

  await prisma.activityEvent.create({
    data: {
      actorId: actor ? actor.id : null,
      type: "ROSTER_ASSIGNED",
      summary: `Assigned ${specialist.user.fullName} as ${input.assignment} on ${property.code}`,
      entityType: "Property",
      entityId: propertyId,
    },
  });

  return {
    roster: {
      id: entry.id,
      assignment: entry.assignment,
      specialistId: entry.specialistId,
      specialistName: specialist.user.fullName,
    },
  };
}

async function removeRoster(propertyId, rosterId, actor) {
  const entry = await prisma.propertyRoster.findUnique({
    where: { id: rosterId },
    include: {
      property: { select: { code: true } },
      specialist: { include: { user: { select: { fullName: true } } } },
    },
  });
  if (!entry || entry.propertyId !== propertyId) {
    throw new HttpError(404, "Roster assignment not found");
  }

  await prisma.$transaction([
    prisma.propertyRoster.delete({ where: { id: rosterId } }),
    prisma.activityEvent.create({
      data: {
        actorId: actor ? actor.id : null,
        type: "ROSTER_REMOVED",
        summary: `Removed ${entry.specialist.user.fullName} from ${entry.property.code}`,
        entityType: "Property",
        entityId: propertyId,
      },
    }),
  ]);

  return { message: "Roster assignment removed" };
}

function clientProperty(property) {
  return {
    id: property.id,
    code: property.code,
    name: property.name,
    propertyType: property.propertyType,
    status: property.status,
    street: property.street,
    city: property.city,
    state: property.state,
    zip: property.zip,
    address: [property.street, property.city, [property.state, property.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    unitCount: property.unitCount,
    squareFootage: property.squareFootage,
  };
}

async function updateMine(user, input) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const existing = await prisma.property.findFirst({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "desc" },
  });
  if (!existing) throw new HttpError(404, "Property not found");

  const data = {};
  for (const field of ["name", "street", "unitCount", "squareFootage"]) {
    if (input[field] !== undefined) data[field] = input[field];
  }
  for (const field of ["city", "state", "zip"]) {
    if (input[field] !== undefined) data[field] = input[field] === "" ? null : input[field];
  }

  const saved = await prisma.property.update({
    where: { id: existing.id },
    data,
  });
  return { property: clientProperty(saved) };
}

module.exports = { list, getById, create, update, remove, assignRoster, removeRoster, updateMine };
