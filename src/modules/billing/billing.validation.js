const { z } = require("zod");

const propertyTypes = [
  ["RESIDENTIAL_MULTI_TENANT", "Residential Multi-Tenant"],
  ["COMMERCIAL", "Commercial"],
  ["ACTIVE_ADULT_55", "55+ Active Adult Community"],
  ["LUXURY_CONDOMINIUM", "Luxury Condominium"],
];

const propertyTypeByInput = new Map(
  propertyTypes.flatMap(([value, label]) => [
    [value, value],
    [label, value],
  ])
);

const checkoutSchema = z.object({
  priceBandId: z.uuid(),
  propertyType: z
    .string()
    .trim()
    .refine((value) => propertyTypeByInput.has(value), { message: "Unknown property type" })
    .optional(),
  successUrl: z.string().trim().min(1).optional(),
  cancelUrl: z.string().trim().min(1).optional(),
});

const confirmSchema = z.object({
  sessionId: z.string().trim().min(1),
});

module.exports = { propertyTypes, propertyTypeByInput, checkoutSchema, confirmSchema };
