const { z } = require("zod");
const { propertyTypeByInput } = require("./pricing-defaults");

const propertyType = z
  .string()
  .trim()
  .refine((value) => propertyTypeByInput.has(value), { message: "Unknown property type" })
  .transform((value) => propertyTypeByInput.get(value));

const fullServiceSchema = z.object({
  prices: z
    .array(
      z.object({
        propertyType,
        tier: z.coerce.number().int().min(1).max(3),
        amount: z.coerce.number().min(0).max(1000000),
      })
    )
    .min(1)
    .max(9),
});

const softwareSchema = z.object({
  plans: z
    .array(
      z.object({
        tier: z.coerce.number().int().min(1).max(3),
        monthlyPrice: z.coerce.number().min(0).max(1000000),
        propertyCapacity: z.coerce.number().int().positive(),
        billingFrequency: z.string().trim().min(1),
        active: z.boolean(),
      })
    )
    .min(1)
    .max(3),
});

module.exports = { fullServiceSchema, softwareSchema };
