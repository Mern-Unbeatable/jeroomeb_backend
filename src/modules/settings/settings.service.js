const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const {
  fullServicePrices,
  propertyTypeLabels,
  softwarePlans,
  fullServiceNote,
  softwareNote,
} = require("./pricing-defaults");

const propertyOrder = ["LUXURY_CONDOMINIUM", "ACTIVE_ADULT_55", "COMMERCIAL"];

function money(value) {
  return Number(value.toString()).toFixed(2);
}

function duplicate(items, key) {
  const seen = new Set();
  return items.some((item) => {
    const id = key(item);
    if (seen.has(id)) return true;
    seen.add(id);
    return false;
  });
}

async function ensurePricing() {
  const [fullCount, softwareCount] = await Promise.all([
    prisma.fullServiceMatrixPrice.count(),
    prisma.softwarePlatformPlan.count(),
  ]);
  if (!fullCount) {
    await prisma.fullServiceMatrixPrice.createMany({
      data: fullServicePrices.map(([propertyType, , tier, amount]) => ({
        propertyType,
        tier,
        amount,
      })),
    });
  }
  if (!softwareCount) {
    await prisma.softwarePlatformPlan.createMany({ data: softwarePlans });
  }
}

function presentFullService(rows) {
  return {
    note: fullServiceNote,
    propertyTypes: propertyOrder.map((propertyType) => ({
      propertyType,
      label: propertyTypeLabels.get(propertyType),
      tiers: [1, 2, 3].map((tier) => {
        const row = rows.find((item) => item.propertyType === propertyType && item.tier === tier);
        return { tier, amount: row ? money(row.amount) : null };
      }),
    })),
  };
}

function presentSoftware(plans) {
  return {
    note: softwareNote,
    plans: [1, 2, 3].map((tier) => {
      const plan = plans.find((item) => item.tier === tier);
      return {
        tier,
        name: plan.name,
        description: plan.description,
        monthlyPrice: money(plan.monthlyPrice),
        propertyCapacity: plan.propertyCapacity,
        billingFrequency: plan.billingFrequency,
        active: plan.active,
      };
    }),
  };
}

async function pricing() {
  await ensurePricing();
  const [rows, plans] = await Promise.all([
    prisma.fullServiceMatrixPrice.findMany(),
    prisma.softwarePlatformPlan.findMany({ orderBy: { tier: "asc" } }),
  ]);
  return {
    fullService: presentFullService(rows),
    software: presentSoftware(plans),
  };
}

async function saveFullService(input, actor) {
  if (duplicate(input.prices, (price) => `${price.propertyType}:${price.tier}`)) {
    throw new HttpError(400, "Each property type and tier can be saved once");
  }
  await ensurePricing();
  try {
    await prisma.$transaction(
      input.prices.map((price) =>
        prisma.fullServiceMatrixPrice.update({
          where: { propertyType_tier: { propertyType: price.propertyType, tier: price.tier } },
          data: { amount: price.amount.toFixed(2) },
        })
      )
    );
  } catch (error) {
    if (error && error.code === "P2025") throw new HttpError(400, "Price cell not found");
    throw error;
  }
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "PLATFORM_PRICING_SAVED",
      summary: "Saved the Full-Service pricing matrix",
      entityType: "FullServiceMatrixPrice",
    },
  });
  return pricing();
}

async function restoreFullService(actor) {
  await ensurePricing();
  await prisma.$transaction(
    fullServicePrices.map(([propertyType, , tier, amount]) =>
      prisma.fullServiceMatrixPrice.update({
        where: { propertyType_tier: { propertyType, tier } },
        data: { amount },
      })
    )
  );
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "PLATFORM_PRICING_RESTORED",
      summary: "Restored the Full-Service pricing matrix",
      entityType: "FullServiceMatrixPrice",
    },
  });
  return pricing();
}

function monthly(value) {
  if (value.trim().toLowerCase() === "monthly") return "MONTHLY";
  throw new HttpError(400, "Billing frequency must be monthly");
}

async function saveSoftware(input, actor) {
  if (duplicate(input.plans, (plan) => String(plan.tier))) {
    throw new HttpError(400, "Each tier can be saved once");
  }
  const plans = input.plans.map((plan) => ({
    ...plan,
    billingFrequency: monthly(plan.billingFrequency),
  }));
  await ensurePricing();
  try {
    await prisma.$transaction(
      plans.map((plan) =>
        prisma.softwarePlatformPlan.update({
          where: { tier: plan.tier },
          data: {
            monthlyPrice: plan.monthlyPrice.toFixed(2),
            propertyCapacity: plan.propertyCapacity,
            billingFrequency: plan.billingFrequency,
            active: plan.active,
          },
        })
      )
    );
  } catch (error) {
    if (error && error.code === "P2025") throw new HttpError(400, "Software plan not found");
    throw error;
  }
  await prisma.activityEvent.create({
    data: {
      actorId: actor.id,
      type: "SOFTWARE_PRICING_SAVED",
      summary: "Saved the Software Only pricing plans",
      entityType: "SoftwarePlatformPlan",
    },
  });
  return pricing();
}

module.exports = { pricing, saveFullService, restoreFullService, saveSoftware };
