require("dotenv").config();
const prisma = require("./src/shared/prisma");

const base = "http://localhost:3000";
const email = `kamrul.maktech+tenant${Date.now()}@gmail.com`;
const password = "TenantPass#2026";
let userId = null;
let orgId = null;

function check(name, ok, extra) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " " + extra : ""}`);
  if (!ok) process.exitCode = 1;
}

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    method: options.method || "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: response.status, json };
}

async function main() {
  const login = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email: "admin@amenityops.com", password: "AmenityAdmin#2026" },
  });
  check("admin login", login.status === 200, String(login.status));
  const token = login.json.token;

  const plans = await request("/api/v1/billing/plans?kind=SOFTWARE");
  const software = plans.json.plans.find((plan) => plan.name === "Tier 1 (Baseline)");
  const full = await request("/api/v1/billing/plans?kind=FULL_SERVICE");
  const fullTier = full.json.plans[0];

  const missingPassword = await request("/api/v1/organizations/provision", {
    method: "POST",
    token,
    body: {
      name: "Password Missing LLC",
      priceBandId: software.id,
      subscriptionStatus: "ACTIVE",
      admin: { fullName: "No Pass", email: "nopass@example.com" },
    },
  });
  check("password required", missingPassword.status === 400, String(missingPassword.status));

  const wrongBand = await request("/api/v1/organizations/provision", {
    method: "POST",
    token,
    body: {
      name: "Wrong Band LLC",
      priceBandId: fullTier.id,
      subscriptionStatus: "ACTIVE",
      propertyLimit: 5,
      admin: { fullName: "Wrong Band", email: "wrong@example.com", password },
    },
  });
  check("full service rejected", wrongBand.status === 400 && wrongBand.json.message === "Software plan not found", wrongBand.json.message);

  const created = await request("/api/v1/organizations/provision", {
    method: "POST",
    token,
    body: {
      name: "Provision Mail Check",
      priceBandId: software.id,
      propertyLimit: 5,
      subscriptionStatus: "INACTIVE",
      admin: { fullName: "Mail Check", email, password },
    },
  });
  check(
    "created",
    created.status === 201 &&
      created.json.tenant.subscriptionStatus === "INACTIVE" &&
      created.json.tenant.planKind === "SOFTWARE" &&
      created.json.tenant.priceBand.name === "Tier 1 (Baseline)" &&
      created.json.temporaryPassword === undefined,
    created.json.message || created.json.tenant.subscriptionStatus
  );
  userId = created.json.user && created.json.user.id;
  orgId = created.json.tenant && created.json.tenant.id;

  const tenantLogin = await request("/api/v1/auth/login", {
    method: "POST",
    body: { email, password },
  });
  check("tenant login", tenantLogin.status === 200, String(tenantLogin.status));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (orgId) {
      await prisma.activityEvent.deleteMany({ where: { entityId: orgId } });
      await prisma.property.deleteMany({ where: { organizationId: orgId } });
    }
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    if (orgId) await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.$disconnect();
  });
