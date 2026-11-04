const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

function money(value) {
  return value == null ? null : value.toString();
}

function toAddOn(addOn) {
  return {
    id: addOn.id,
    name: addOn.name,
    description: addOn.description,
    price: money(addOn.price),
    active: addOn.active,
    createdAt: addOn.createdAt,
  };
}

async function list(actor) {
  const admin = actor.role === "SUPER_ADMIN" || actor.role === "TEAM_MEMBER";
  const addOns = await prisma.addOnService.findMany({
    where: { sortOrder: { gt: 0 }, ...(admin ? {} : { active: true }) },
    orderBy: [{ active: "desc" }, { sortOrder: "asc" }],
  });
  return { addOns: addOns.map(toAddOn) };
}

async function create(input, actor) {
  const existing = await prisma.addOnService.findFirst({
    where: { name: input.name, sortOrder: { gt: 0 } },
  });
  if (existing) throw new HttpError(409, "An add-on with this name already exists");

  const last = await prisma.addOnService.findFirst({
    orderBy: { sortOrder: "desc" },
  });
  const addOn = await prisma.addOnService.create({
    data: {
      name: input.name,
      description: input.description || null,
      price: input.price,
      sortOrder: (last ? last.sortOrder : 0) + 1,
      active: true,
    },
  });
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "ADD_ON_CREATED",
      summary: `${addOn.name} add-on created`,
      entityType: "AddOnService",
      entityId: addOn.id,
    },
  });
  return { addOn: toAddOn(addOn) };
}

async function update(id, input, actor) {
  const existing = await prisma.addOnService.findFirst({
    where: { id, sortOrder: { gt: 0 } },
  });
  if (!existing) throw new HttpError(404, "Add-on not found");
  if (input.name && input.name !== existing.name) {
    const taken = await prisma.addOnService.findFirst({
      where: { name: input.name, sortOrder: { gt: 0 }, id: { not: id } },
    });
    if (taken) throw new HttpError(409, "An add-on with this name already exists");
  }

  const data = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.price !== undefined) data.price = input.price;
  if (input.active !== undefined) data.active = input.active;

  const addOn = await prisma.addOnService.update({ where: { id }, data });
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "ADD_ON_UPDATED",
      summary: `${addOn.name} add-on updated`,
      entityType: "AddOnService",
      entityId: addOn.id,
    },
  });
  return { addOn: toAddOn(addOn) };
}

async function remove(id, actor) {
  const existing = await prisma.addOnService.findFirst({
    where: { id, sortOrder: { gt: 0 } },
  });
  if (!existing) throw new HttpError(404, "Add-on not found");
  try {
    await prisma.addOnService.delete({ where: { id } });
  } catch (error) {
    if (error && error.code === "P2003") {
      throw new HttpError(409, "This add-on is in use");
    }
    throw error;
  }
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "ADD_ON_DELETED",
      summary: `${existing.name} add-on deleted`,
      entityType: "AddOnService",
      entityId: id,
    },
  });
  return { message: "Add-on deleted" };
}

module.exports = { list, create, update, remove };
