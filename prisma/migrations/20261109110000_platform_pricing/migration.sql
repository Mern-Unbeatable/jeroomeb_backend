CREATE TABLE "FullServiceMatrixPrice" (
    "id" TEXT NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "tier" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FullServiceMatrixPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FullServiceMatrixPrice_propertyType_tier_key" ON "FullServiceMatrixPrice"("propertyType", "tier");

CREATE TABLE "SoftwarePlatformPlan" (
    "id" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "monthlyPrice" DECIMAL(12,2) NOT NULL,
    "propertyCapacity" INTEGER NOT NULL,
    "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwarePlatformPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SoftwarePlatformPlan_tier_key" ON "SoftwarePlatformPlan"("tier");

INSERT INTO "FullServiceMatrixPrice" ("id", "propertyType", "tier", "amount", "updatedAt") VALUES
  (gen_random_uuid()::text, 'LUXURY_CONDOMINIUM', 1, 1995.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LUXURY_CONDOMINIUM', 2, 2395.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'LUXURY_CONDOMINIUM', 3, 2895.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ACTIVE_ADULT_55', 1, 1795.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ACTIVE_ADULT_55', 2, 2295.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ACTIVE_ADULT_55', 3, 2795.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'COMMERCIAL', 1, 2095.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'COMMERCIAL', 2, 2595.00, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'COMMERCIAL', 3, 3195.00, CURRENT_TIMESTAMP);

INSERT INTO "SoftwarePlatformPlan" ("id", "tier", "name", "description", "monthlyPrice", "propertyCapacity", "billingFrequency", "active", "updatedAt") VALUES
  (gen_random_uuid()::text, 1, 'Tier 1 — Baseline', 'Single-property entry tier', 299.00, 1, 'MONTHLY', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 2, 'Tier 2 — Premier', 'Portfolio operations tier', 749.00, 1, 'MONTHLY', true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 3, 'Tier 3 — Sovereign', 'Configured enterprise tier', 1499.00, 1, 'MONTHLY', true, CURRENT_TIMESTAMP);
