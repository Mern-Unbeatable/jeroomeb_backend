const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

function money(value) {
  return value == null ? null : value.toString();
}

function toBand(band) {
  return {
    id: band.id,
    kind: band.kind,
    name: band.name,
    minUnits: band.minUnits,
    maxUnits: band.maxUnits,
    maxSquareFootage: band.maxSquareFootage,
    monthlyPrice: money(band.monthlyPrice),
    active: band.active,
  };
}

async function list() {
  const bands = await prisma.servicePriceBand.findMany({
    orderBy: [{ kind: "asc" }, { monthlyPrice: "asc" }],
  });
  return { priceBands: bands.map(toBand) };
}

async function update(id, input, actor) {
  const existing = await prisma.servicePriceBand.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, "Price band not found");

  const data = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.monthlyPrice !== undefined) data.monthlyPrice = input.monthlyPrice;
  if (input.active !== undefined) data.active = input.active;

  const saved = await prisma.servicePriceBand.update({ where: { id }, data });
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "PRICE_UPDATED",
      summary: `${saved.kind} ${saved.name} price updated`,
      entityType: "ServicePriceBand",
      entityId: saved.id,
    },
  });
  return { priceBand: toBand(saved) };
}

module.exports = { list, update };
