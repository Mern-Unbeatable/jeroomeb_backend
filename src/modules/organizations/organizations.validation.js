const { z } = require("zod");

const provisionTenantSchema = z.object({
  name: z.string().trim().min(1).max(160),
  licensePlanId: z.uuid().optional(),
  propertyLimit: z.coerce.number().int().positive().optional(),
  checklistTemplateIds: z.array(z.uuid()).optional().default([]),
  admin: z.object({
    fullName: z.string().trim().min(1).max(120),
    email: z.email(),
    phone: z.string().trim().min(7).max(30).optional(),
  }),
});

module.exports = { provisionTenantSchema };
