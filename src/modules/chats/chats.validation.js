const { z } = require("zod");

const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

module.exports = { sendMessageSchema };
