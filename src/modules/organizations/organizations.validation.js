const { z } = require("zod");

const provisionTenantSchema = z.object({
  name: z.string().trim().min(1).max(160),
  priceBandId: z.uuid(),
  propertyLimit: z.coerce.number().int().positive().optional(),
  subscriptionStatus: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  checklistTemplateIds: z.array(z.uuid()).optional().default([]),
  admin: z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.email(),
    phone: z.string().trim().min(7).max(30).optional(),
    password: z.string().min(8).max(72),
  }),
});

module.exports = { provisionTenantSchema };
