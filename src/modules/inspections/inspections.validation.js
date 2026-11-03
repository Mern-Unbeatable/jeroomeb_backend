const { z } = require("zod");

const inspectionStatuses = ["PENDING", "IN_PROGRESS", "RESOLVED_CLOSED", "CANCELLED"];

const createInspectionSchema = z.object({
  propertyId: z.uuid(),
  scheduledAt: z.coerce.date().optional(),
  specialistId: z.uuid().nullable().optional(),
});

const updateInspectionSchema = z.object({
  scheduledAt: z.coerce.date().optional(),
  specialistId: z.uuid().nullable().optional(),
});

const answersSchema = z.object({
  answers: z
    .array(
      z.object({
        checklistItemId: z.uuid(),
        result: z.enum(["PASS", "FAIL", "NA"]),
        note: z.string().trim().max(2000).nullable().optional(),
        photoUrl: z.string().trim().max(2000).nullable().optional(),
        latitude: z.coerce.number().nullable().optional(),
        longitude: z.coerce.number().nullable().optional(),
      })
    )
    .min(1),
});

const resolveSchema = z.object({
  summary: z.string().trim().max(4000).optional(),
});

module.exports = {
  inspectionStatuses,
  createInspectionSchema,
  updateInspectionSchema,
  answersSchema,
  resolveSchema,
};
