const { z } = require("zod");

const feedbackSchema = z.object({
  specialistId: z.uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(4000),
});

module.exports = { feedbackSchema };
