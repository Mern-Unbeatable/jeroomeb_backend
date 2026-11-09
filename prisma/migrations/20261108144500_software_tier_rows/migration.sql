WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY kind, name ORDER BY "createdAt") AS n
  FROM "ServicePriceBand"
  WHERE kind = 'SOFTWARE' AND name = 'Tier 2 (Premier)' AND active = true
)
UPDATE "ServicePriceBand"
SET active = false
WHERE id IN (SELECT id FROM ranked WHERE n > 1);

INSERT INTO "ServicePriceBand" (
  "id",
  "kind",
  "name",
  "minUnits",
  "maxUnits",
  "maxSquareFootage",
  "monthlyPrice",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'SOFTWARE',
  'Tier 1 (Baseline)',
  1,
  200,
  250000,
  299.00,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1
  FROM "ServicePriceBand"
  WHERE kind = 'SOFTWARE' AND name = 'Tier 1 (Baseline)' AND active = true
);
