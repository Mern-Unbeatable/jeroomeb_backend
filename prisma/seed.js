const bcrypt = require("bcryptjs");
const prisma = require("../src/shared/prisma");

const licensePlans = [
  { name: "Essential", kind: "SOFTWARE", monthlyPrice: "299.00", propertyLimit: 5 },
  { name: "Growth", kind: "SOFTWARE", monthlyPrice: "749.00", propertyLimit: 15 },
  { name: "Enterprise", kind: "SOFTWARE", monthlyPrice: "1499.00", propertyLimit: 40 },
];

async function seedLicensePlans() {
  for (const plan of licensePlans) {
    const existing = await prisma.licensePlan.findFirst({
      where: { name: plan.name, kind: plan.kind },
    });

    if (existing) {
      await prisma.licensePlan.update({
        where: { id: existing.id },
        data: {
          monthlyPrice: plan.monthlyPrice,
          propertyLimit: plan.propertyLimit,
          active: true,
        },
      });
      continue;
    }

    await prisma.licensePlan.create({ data: plan });
  }
}

async function seedSuperAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME || "Super Admin";

  if (!email || !password) {
    throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    console.log(`Super admin already present: ${normalizedEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      fullName,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Seeded super admin: ${normalizedEmail}`);
}

const priceBandRenames = [
  ["FULL_SERVICE", "1-49 units", "Tier 1 (Baseline)"],
  ["FULL_SERVICE", "50-149 units", "Tier 2 (Premier)"],
  ["FULL_SERVICE", "150+ units", "Tier 3 (Sovereign)"],
];

const priceBands = [
  { kind: "FULL_SERVICE", name: "Tier 1 (Baseline)", minUnits: 1, maxUnits: 49, monthlyPrice: "115.00" },
  { kind: "FULL_SERVICE", name: "Tier 2 (Premier)", minUnits: 50, maxUnits: 149, monthlyPrice: "170.00" },
  { kind: "FULL_SERVICE", name: "Tier 3 (Sovereign)", minUnits: 150, maxUnits: null, monthlyPrice: "225.00" },
  { kind: "SOFTWARE", name: "1-49 units", minUnits: 1, maxUnits: 49, monthlyPrice: "299.00" },
  { kind: "SOFTWARE", name: "50-149 units", minUnits: 50, maxUnits: 149, monthlyPrice: "449.00" },
  { kind: "SOFTWARE", name: "150+ units", minUnits: 150, maxUnits: null, monthlyPrice: "0.00" },
];

const addOnServices = [
  {
    name: "Premium After-Hours Auditing & Compliance Logistics",
    description: "Our core overnight operational oversight service",
    price: "0.00",
    sortOrder: 0,
  },
  {
    name: "7-Day Weekend Extension",
    description: "Extends the overnight audit through Saturday and Sunday.",
    price: "45.00",
    sortOrder: 1,
  },
  {
    name: "Event Amenity Reset Audits",
    description: "Extra audits around a resident or tenant event.",
    price: "75.00",
    sortOrder: 2,
  },
  {
    name: "Vacant Space Transitions",
    description: "Checks vacant units and shared space during turnover.",
    price: "60.00",
    sortOrder: 3,
  },
  {
    name: "Janitorial & TI Quality QA",
    description: "Reviews janitorial finish and tenant-improvement work in common areas.",
    price: "55.00",
    sortOrder: 4,
  },
  {
    name: "Eviction & Legal Notices",
    description: "Supports notices that need an on-site operational check.",
    price: "50.00",
    sortOrder: 5,
  },
  {
    name: "Trash & Recycling Valet",
    description: "Inspects the trash and recycling area on the audit night.",
    price: "40.00",
    sortOrder: 6,
  },
];

const addOnRenames = [
  ["After-Hours Amenity Audit", "Premium After-Hours Auditing & Compliance Logistics"],
  ["Event Amenity Boost Audits", "Event Amenity Reset Audits"],
  ["Trash & Recycling Yard", "Trash & Recycling Valet"],
];

const compensationTiers = [
  { name: "Tier 1 Standard", payoutAmount: "85.00" },
  { name: "Tier 2 Premier", payoutAmount: "125.00" },
  { name: "Tier 3 Elite", payoutAmount: "175.00" },
];

const checklistTemplates = [
  {
    name: "55+ Active Adult Operational Audit",
    propertyType: "ACTIVE_ADULT_55",
    items: [
      ["Life Safety", "Emergency lighting operates", "Test that emergency fixtures come on along night routes."],
      ["Life Safety", "Exit signs illuminated", "Exit signs are lit and visible from the common path."],
      ["Life Safety", "Fire extinguishers present and tagged", "Extinguishers are in place and the inspection tag is current."],
      ["Life Safety", "AED cabinet accessible", "The AED is visible and the cabinet is not blocked."],
      ["Pool & Spa", "Pool gate self-closes and latches", "The gate closes fully and the latch holds without help."],
      ["Pool & Spa", "Water clear and deck free of slip hazards", "Water is clear and the night deck has no standing water or loose mats."],
      ["Pool & Spa", "Equipment room locked", "The equipment room door is closed and locked."],
      ["Fitness & Clubhouse", "Fitness equipment safe to use", "Cables, benches, and machines have no broken or loose parts."],
      ["Fitness & Clubhouse", "Sanitizer and towels stocked", "Sanitizer and towels are available for the next resident."],
      ["Fitness & Clubhouse", "Restrooms clean and supplied", "Fixtures work and soap, paper, and trash are in order."],
      ["Grounds & After Hours", "Walkway and parking lights on", "Path and parking lights are working for the overnight route."],
      ["Grounds & After Hours", "Amenity doors lock after hours", "Amenity entries are secured for the closed period."],
      ["Grounds & After Hours", "Night route free of trip hazards", "Walkways have no cords, debris, or raised edges."],
    ],
  },
  {
    name: "Luxury Condominium Operational Audit",
    propertyType: "LUXURY_CONDOMINIUM",
    items: [
      ["Arrival & Lobby", "Lobby presentable overnight", "Furniture, floors, and lighting are in guest-ready condition."],
      ["Arrival & Lobby", "Elevator lobbies lit and clear", "Lobbies are lit and free of deliveries or obstacles."],
      ["Arrival & Lobby", "Package room secured", "The package room door locks and packages are not left in the open lobby."],
      ["Amenities", "Pool deck gates and lighting", "Gates latch and deck lighting covers the walk to the water."],
      ["Amenities", "Resident lounge closed and secured", "The lounge is closed, lights are set for overnight, and the door locks."],
      ["Amenities", "Fitness center floors and equipment", "Floors are dry and equipment is intact and powered down as required."],
      ["Parking & Access", "Garage lighting works", "Drive lanes and pedestrian paths in the garage are lit."],
      ["Parking & Access", "Amenity access control functions", "Amenity readers or locks respond and reject an unsecured door."],
      ["Parking & Access", "Stairwells lit and clear", "Stairs are lit and handrails and landings are unobstructed."],
      ["Life Safety", "Extinguishers and exit signs", "Extinguishers are tagged and exit signs are illuminated."],
      ["Life Safety", "Emergency lighting", "Emergency lights operate on the lobby, amenity, and stair routes."],
    ],
  },
  {
    name: "Commercial Multi-Tenant Operational Audit",
    propertyType: "COMMERCIAL",
    items: [
      ["Lobby & Corridors", "Lobby presentation", "The lobby is clean, lit, and free of overnight clutter."],
      ["Lobby & Corridors", "Corridor lighting", "Common corridors are evenly lit with no dark sections."],
      ["Lobby & Corridors", "Restrooms clean and supplied", "Fixtures work and supplies and trash are in order."],
      ["Operations", "Trash and recycling yard contained", "Containers are closed, not overflowing, and the yard gate is secured."],
      ["Operations", "Loading and service areas clear", "The dock and service corridor are clear of loose debris and spills."],
      ["Operations", "Janitorial finish in common areas", "Floors, glass, and touch points show a completed clean."],
      ["Life Safety & Exterior", "Exit signs and emergency lighting", "Exit signs are lit and emergency fixtures work."],
      ["Life Safety & Exterior", "Parking lot lighting", "Lot and walkway lights cover the path from the door to the cars."],
      ["Life Safety & Exterior", "Exterior walkways free of hazards", "Curbs, mats, and walkways have no trip points."],
      ["Life Safety & Exterior", "After-hours access points secured", "Public entries that should be closed are locked."],
    ],
  },
];

async function upsertBy(model, where, data) {
  const existing = await prisma[model].findFirst({ where });
  if (existing) {
    return prisma[model].update({ where: { id: existing.id }, data });
  }
  return prisma[model].create({ data: { ...where, ...data } });
}

async function seedPriceBands() {
  for (const [kind, from, to] of priceBandRenames) {
    const existing = await prisma.servicePriceBand.findFirst({ where: { kind, name: from } });
    if (!existing) continue;
    const taken = await prisma.servicePriceBand.findFirst({ where: { kind, name: to } });
    if (!taken) {
      await prisma.servicePriceBand.update({ where: { id: existing.id }, data: { name: to } });
    } else if (taken.id !== existing.id) {
      await prisma.servicePriceBand.update({ where: { id: existing.id }, data: { active: false } });
    }
  }

  for (const band of priceBands) {
    const existing = await prisma.servicePriceBand.findFirst({
      where: { kind: band.kind, name: band.name },
    });
    if (existing) {
      await prisma.servicePriceBand.update({
        where: { id: existing.id },
        data: { minUnits: band.minUnits, maxUnits: band.maxUnits, active: true },
      });
      continue;
    }
    await prisma.servicePriceBand.create({ data: band });
  }
}

async function seedAddOnServices() {
  for (const [from, to] of addOnRenames) {
    const existing = await prisma.addOnService.findFirst({ where: { name: from } });
    if (!existing) continue;
    const taken = await prisma.addOnService.findFirst({ where: { name: to } });
    if (!taken) {
      await prisma.addOnService.update({ where: { id: existing.id }, data: { name: to } });
    } else if (taken.id !== existing.id) {
      await prisma.addOnService.update({ where: { id: existing.id }, data: { active: false } });
    }
  }

  for (const addOn of addOnServices) {
    await upsertBy(
      "addOnService",
      { name: addOn.name },
      {
        description: addOn.description,
        price: addOn.price,
        sortOrder: addOn.sortOrder,
        active: true,
      }
    );
  }
}

async function seedCompensationTiers() {
  for (const tier of compensationTiers) {
    await upsertBy(
      "compensationTier",
      { name: tier.name },
      { payoutAmount: tier.payoutAmount, active: true }
    );
  }
}

async function seedChecklistTemplates() {
  for (const template of checklistTemplates) {
    const saved = await upsertBy(
      "checklistTemplate",
      { name: template.name },
      { propertyType: template.propertyType, active: true }
    );

    for (let index = 0; index < template.items.length; index += 1) {
      const [category, name, description] = template.items[index];
      const existing = await prisma.checklistItem.findFirst({
        where: { templateId: saved.id, name },
      });
      const data = {
        category,
        description,
        sortOrder: index,
        required: true,
      };

      if (existing) {
        await prisma.checklistItem.update({ where: { id: existing.id }, data });
      } else {
        await prisma.checklistItem.create({
          data: { templateId: saved.id, name, ...data },
        });
      }
    }
  }
}

async function main() {
  await seedLicensePlans();
  console.log("Seeded license plans: Essential, Growth, Enterprise");
  await seedSuperAdmin();
  await seedPriceBands();
  await seedAddOnServices();
  await seedCompensationTiers();
  await seedChecklistTemplates();

  const [bands, addOns, tiers, templates, items] = await Promise.all([
    prisma.servicePriceBand.count(),
    prisma.addOnService.count(),
    prisma.compensationTier.count(),
    prisma.checklistTemplate.count(),
    prisma.checklistItem.count(),
  ]);

  console.log(
    `Seeded catalog: ${bands} price bands, ${addOns} add-ons, ${tiers} compensation tiers, ${templates} checklist templates, ${items} checklist items`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
