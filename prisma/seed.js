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

async function main() {
  await seedLicensePlans();
  console.log("Seeded license plans: Essential, Growth, Enterprise");
  await seedSuperAdmin();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
