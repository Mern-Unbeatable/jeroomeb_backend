const { z } = require("zod");

const createMemberSchema = z.object({
  organizationId: z.uuid(),
  fullName: z.string().trim().min(1).max(120),
  email: z.email(),
  password: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.string().min(8).max(72).optional()
  ),
  role: z.enum(["SPECIALIST", "TENANT_ADMIN"]),
});

module.exports = { createMemberSchema };
