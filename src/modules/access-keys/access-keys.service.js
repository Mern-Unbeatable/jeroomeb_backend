const { z } = require("zod");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { isUniqueConflict } = require("../../shared/codes");
const { hasContent } = require("./access-keys.validation");

const propertySelect = {
  id: true,
  code: true,
  name: true,
  street: true,
  city: true,
  state: true,
  zip: true,
  organization: { select: { id: true, name: true } },
};

function address(property) {
  const region = [property.state, property.zip].filter(Boolean).join(" ");
  return [property.street, property.city, region].filter(Boolean).join(", ");
}

function toAccessKey(record) {
  return {
    id: record.id,
    property: {
      id: record.property.id,
      code: record.property.code,
      name: record.property.name,
      address: address(record.property),
      company: {
        id: record.property.organization.id,
        name: record.property.organization.name,
      },
    },
    mainEntryInstructions: record.mainEntryInstructions,
    buildingAccessCode: record.buildingAccessCode,
    elevatorAccess: record.elevatorAccess,
    lockboxCode: record.lockboxCode,
    emergencyContact: {
      name: record.emergencyContactName,
      title: record.emergencyContactTitle,
      phone: record.emergencyContactPhone,
    },
    additionalNotes: record.additionalNotes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function fullServiceOrganization(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (
    !organization ||
    organization.subscriptionStatus !== "ACTIVE" ||
    organization.planKind !== "FULL_SERVICE"
  ) {
    throw new HttpError(403, "Access keys are available on an active Service + Software plan");
  }
  return organization;
}

async function clientProperty(organizationId) {
  const property = await prisma.property.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!property) throw new HttpError(404, "Property not found");
  return property;
}

function accessId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Access keys not found");
  return parsed.data;
}

async function findRecord(id) {
  const record = await prisma.propertyAccess.findUnique({
    where: { id: accessId(id) },
    include: { property: { select: propertySelect } },
  });
  if (!record) throw new HttpError(404, "Access keys not found");
  return record;
}

function canView(record, user) {
  if (user.role === "SUPER_ADMIN") return true;
  return record.property.organization.id === user.organizationId;
}

async function list(user) {
  const where = {};
  if (user.role !== "SUPER_ADMIN") {
    await fullServiceOrganization(user);
    where.property = { organizationId: user.organizationId };
  }

  const records = await prisma.propertyAccess.findMany({
    where,
    include: { property: { select: propertySelect } },
    orderBy: { updatedAt: "desc" },
  });
  return { accessKeys: records.map(toAccessKey) };
}

async function getById(id, user) {
  const record = await findRecord(id);
  if (!canView(record, user)) throw new HttpError(403, "You do not have access to this");
  if (user.role !== "SUPER_ADMIN") await fullServiceOrganization(user);
  return { accessKey: toAccessKey(record) };
}

async function create(user, input) {
  if (!hasContent(input)) throw new HttpError(400, "Add at least one access detail");
  const organization = await fullServiceOrganization(user);
  const property = await clientProperty(organization.id);

  try {
    const record = await prisma.propertyAccess.create({
      data: {
        propertyId: property.id,
        mainEntryInstructions: input.mainEntryInstructions || null,
        buildingAccessCode: input.buildingAccessCode || null,
        elevatorAccess: input.elevatorAccess || null,
        lockboxCode: input.lockboxCode || null,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactTitle: input.emergencyContactTitle || null,
        emergencyContactPhone: input.emergencyContactPhone || null,
        additionalNotes: input.additionalNotes || null,
      },
      include: { property: { select: propertySelect } },
    });
    await prisma.activityEvent.create({
      data: {
        actorId: user.id,
        type: "ACCESS_KEYS_SAVED",
        summary: `Access keys saved for ${record.property.name}`,
        entityType: "PropertyAccess",
        entityId: record.id,
      },
    });
    return { accessKey: toAccessKey(record) };
  } catch (error) {
    if (isUniqueConflict(error, "propertyId")) {
      throw new HttpError(409, "Access keys already exist");
    }
    throw error;
  }
}

async function update(id, user, input) {
  if (!hasContent(input) && !Object.values(input).some((value) => value === null)) {
    throw new HttpError(400, "Send a field to update");
  }
  const organization = await fullServiceOrganization(user);
  const current = await findRecord(id);
  if (current.property.organization.id !== organization.id) {
    throw new HttpError(403, "You do not have access to this");
  }

  const data = {};
  for (const key of [
    "mainEntryInstructions",
    "buildingAccessCode",
    "elevatorAccess",
    "lockboxCode",
    "emergencyContactName",
    "emergencyContactTitle",
    "emergencyContactPhone",
    "additionalNotes",
  ]) {
    if (input[key] !== undefined) data[key] = input[key];
  }

  const record = await prisma.propertyAccess.update({
    where: { id: current.id },
    data,
    include: { property: { select: propertySelect } },
  });
  await prisma.activityEvent.create({
    data: {
      actorId: user.id,
      type: "ACCESS_KEYS_UPDATED",
      summary: `Access keys updated for ${record.property.name}`,
      entityType: "PropertyAccess",
      entityId: record.id,
    },
  });
  return { accessKey: toAccessKey(record) };
}

module.exports = { list, getById, create, update };
