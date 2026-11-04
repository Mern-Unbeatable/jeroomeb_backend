const { z } = require("zod");

const createAddOnSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  price: z.coerce.number().min(0).max(1000000),
});

const updateAddOnSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    price: z.coerce.number().min(0).max(1000000).optional(),
    active: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.description !== undefined ||
      input.price !== undefined ||
      input.active !== undefined,
    { message: "Send a name, details, price, or active flag" }
  );

module.exports = { createAddOnSchema, updateAddOnSchema };
