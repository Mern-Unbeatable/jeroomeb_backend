const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

function toItem(item) {
  return {
    id: item.id,
    category: item.category,
    name: item.name,
    description: item.description,
    sortOrder: item.sortOrder,
  };
}

function toTemplate(template) {
  return {
    id: template.id,
    name: template.name,
    propertyType: template.propertyType,
    itemCount: template._count ? template._count.items : template.items.length,
    ...(template.items ? { items: template.items.map(toItem) } : {}),
  };
}

async function list() {
  const templates = await prisma.checklistTemplate.findMany({
    where: { active: true },
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });
  return { templates: templates.map(toTemplate) };
}

async function create(input, actor) {
  const existing = await prisma.checklistTemplate.findFirst({
    where: { active: true, name: { equals: input.name, mode: "insensitive" } },
  });
  if (existing) throw new HttpError(409, "A checklist with this name already exists");

  const template = await prisma.checklistTemplate.create({
    data: {
      name: input.name,
      items: {
        create: input.items.map((item, index) => ({
          category: item.category,
          name: item.name,
          description: item.description || null,
          sortOrder: index,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  await prisma.activityEvent.create({
    data: {
      actorId: actor ? actor.id : null,
      type: "CHECKLIST_CREATED",
      summary: `${template.name} checklist created`,
      entityType: "ChecklistTemplate",
      entityId: template.id,
    },
  });

  return { checklist: toTemplate(template) };
}

module.exports = { list, create };
