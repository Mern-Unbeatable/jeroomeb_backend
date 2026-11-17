const { z } = require("zod");

const itemSchema = z.object({
  category: z.string().trim().min(1).max(160),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});

const createChecklistSchema = z.object({
  name: z.string().trim().min(1).max(160),
  items: z.array(itemSchema).min(1).max(200),
});

module.exports = { createChecklistSchema };
