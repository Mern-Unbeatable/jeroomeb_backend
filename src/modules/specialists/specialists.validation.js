const { z } = require("zod");

const travelRanges = ["Within 10 miles", "10-25 miles", "25-50 miles", "50+ miles"];

const shiftOptions = ["Evening", "Overnight", "Both"];

const propertyTypes = [
  "Luxury High-Rises",
  "Premium Residential",
  "Commercial Multi-Tenant",
  "Mixed-Use Developments",
  "55+ Active Adult",
];

const comfortRatings = [
  { value: 1, label: "Not Comfortable" },
  { value: 2, label: "Somewhat Comfortable" },
  { value: 3, label: "Comfortable" },
  { value: 4, label: "Very Comfortable" },
  { value: 5, label: "Extremely Comfortable" },
];

function choices(options) {
  return z
    .array(z.enum(options))
    .min(1)
    .refine((items) => new Set(items).size === items.length, {
      message: "Choose each option once",
    });
}

const applySchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(7).max(30),
    email: z.email(),
    location: z.string().trim().min(1).max(120),
    travelRange: z.enum(travelRanges),
    shiftAvailability: choices(shiftOptions),
    premiumPropertyExperience: z.boolean(),
    propertyTypes: choices(propertyTypes),
    assetProtectionExperience: z.string().trim().min(1).max(800),
    complianceExperience: z.string().trim().max(800).optional(),
    comfortRating: z.coerce.number().int().min(1).max(5),
    multiPointInspection: z.string().trim().min(1).max(800),
    handOffBrief: z.string().trim().min(1).max(800),
    riskReduction: z.string().trim().min(1).max(800),
    hasTransportation: z.boolean(),
    canDoMultiPointInspection: z.boolean(),
    backgroundCheckConsent: z.boolean(),
    informationConfirmed: z.literal(true),
    password: z.string().min(8).max(72).optional(),
  })
  .refine(
    (input) =>
      !(input.shiftAvailability.includes("Both") && input.shiftAvailability.length > 1),
    { message: "Choose Both on its own", path: ["shiftAvailability"] }
  );

const applicationOptions = {
  travelRanges,
  shiftOptions,
  propertyTypes,
  comfortRatings,
};

const travelMiles = {
  "Within 10 miles": 10,
  "10-25 miles": 25,
  "25-50 miles": 50,
  "50+ miles": 100,
};

module.exports = {
  applySchema,
  applicationOptions,
  travelMiles,
  comfortRatings,
};
