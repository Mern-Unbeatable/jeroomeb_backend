const { z } = require("zod");

const updatePriceBandSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    monthlyPrice: z.coerce.number().min(0).max(1000000).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined || input.monthlyPrice !== undefined || input.active !== undefined,
    { message: "Send a name, price, or active flag" }
  );

module.exports = { updatePriceBandSchema };
