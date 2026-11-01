const { z } = require("zod");

const createContactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
  phone: z.string().trim().min(7).max(30).optional(),
  message: z.string().trim().min(1).max(5000),
});

module.exports = { createContactSchema };
