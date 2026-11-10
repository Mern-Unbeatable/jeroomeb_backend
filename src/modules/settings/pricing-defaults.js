const fullServicePrices = [
  ["LUXURY_CONDOMINIUM", "Luxury Condominium", 1, "1995.00"],
  ["LUXURY_CONDOMINIUM", "Luxury Condominium", 2, "2395.00"],
  ["LUXURY_CONDOMINIUM", "Luxury Condominium", 3, "2895.00"],
  ["ACTIVE_ADULT_55", "55+ Active Adult Community", 1, "1795.00"],
  ["ACTIVE_ADULT_55", "55+ Active Adult Community", 2, "2295.00"],
  ["ACTIVE_ADULT_55", "55+ Active Adult Community", 3, "2795.00"],
  ["COMMERCIAL", "Commercial Multi-Tenant", 1, "2095.00"],
  ["COMMERCIAL", "Commercial Multi-Tenant", 2, "2595.00"],
  ["COMMERCIAL", "Commercial Multi-Tenant", 3, "3195.00"],
];

const propertyTypeLabels = new Map([
  ["LUXURY_CONDOMINIUM", "Luxury Condominium"],
  ["ACTIVE_ADULT_55", "55+ Active Adult Community"],
  ["COMMERCIAL", "Commercial Multi-Tenant"],
]);

const propertyTypeByInput = new Map(
  [...propertyTypeLabels.entries()].flatMap(([value, label]) => [
    [value, value],
    [label, value],
  ])
);

const softwarePlans = [
  {
    tier: 1,
    name: "Tier 1 — Baseline",
    description: "Single-property entry tier",
    monthlyPrice: "299.00",
    propertyCapacity: 1,
    billingFrequency: "MONTHLY",
    active: true,
  },
  {
    tier: 2,
    name: "Tier 2 — Premier",
    description: "Portfolio operations tier",
    monthlyPrice: "749.00",
    propertyCapacity: 1,
    billingFrequency: "MONTHLY",
    active: true,
  },
  {
    tier: 3,
    name: "Tier 3 — Sovereign",
    description: "Configured enterprise tier",
    monthlyPrice: "1499.00",
    propertyCapacity: 1,
    billingFrequency: "MONTHLY",
    active: true,
  },
];

const fullServiceNote = "Configurable demo values—not confirmed production pricing.";
const softwareNote =
  "Standard / Pro / Enterprise tenant provisioning labels remain separate from these software pricing plan names.";

module.exports = {
  fullServicePrices,
  propertyTypeLabels,
  propertyTypeByInput,
  softwarePlans,
  fullServiceNote,
  softwareNote,
};
