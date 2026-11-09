ALTER TABLE "ServicePriceBand" ADD COLUMN "maxSquareFootage" INTEGER;

UPDATE "ServicePriceBand"
SET
  "name" = 'Tier 1 (Baseline)',
  "minUnits" = 1,
  "maxUnits" = 200,
  "maxSquareFootage" = 250000,
  "monthlyPrice" = 299.00
WHERE "kind" = 'SOFTWARE' AND "name" IN ('1-49 units', 'Tier 1 (Baseline)');

UPDATE "ServicePriceBand"
SET
  "name" = 'Tier 2 (Premier)',
  "minUnits" = 201,
  "maxUnits" = 500,
  "maxSquareFootage" = 600000,
  "monthlyPrice" = 449.00
WHERE "kind" = 'SOFTWARE' AND "name" IN ('50-149 units', 'Tier 2 (Premier)');

UPDATE "ServicePriceBand"
SET
  "name" = 'Tier 3 (Sovereign)',
  "minUnits" = 501,
  "maxUnits" = NULL,
  "maxSquareFootage" = NULL,
  "monthlyPrice" = 0.00
WHERE "kind" = 'SOFTWARE' AND "name" IN ('150+ units', 'Tier 3 (Sovereign)');
