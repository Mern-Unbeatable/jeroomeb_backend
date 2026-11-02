const prisma = require("../../shared/prisma");

async function list() {
  const templates = await prisma.checklistTemplate.findMany({
    where: { active: true },
    select: { id: true, name: true, propertyType: true },
    orderBy: { name: "asc" },
  });
  return { templates };
}

module.exports = { list };
