const { z } = require("zod");

const propertyTypes = [
  "RESIDENTIAL_MULTI_TENANT",
  "COMMERCIAL",
  "ACTIVE_ADULT_55",
  "LUXURY_CONDOMINIUM",
];

const propertyStatuses = ["DRAFT", "ACTIVE", "INACTIVE"];

const weekdays = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

const assignments = ["PRIMARY", "BACKUP", "IN_HOUSE"];

const propertyFields = {
  name: z.string().trim().min(1).max(160),
  propertyType: z.enum(propertyTypes),
  contactName: z.string().trim().max(120).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(7).max(30).optional(),
  street: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  zip: z.string().trim().max(20).optional(),
  county: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4000).optional(),
  status: z.enum(propertyStatuses).optional(),
  unitCount: z.coerce.number().int().positive().optional(),
  buildingCount: z.coerce.number().int().positive().optional(),
  squareFootage: z.coerce.number().int().positive().optional(),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  geofenceEnabled: z.boolean().optional(),
  geofenceRadiusMeters: z.coerce.number().int().positive().optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  photoIdRequired: z.boolean().optional(),
  checklistsAvailable247: z.boolean().optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  compensationTierId: z.uuid().nullable().optional(),
  inspectionDays: z.array(z.enum(weekdays)).optional(),
  checklistTemplateIds: z.array(z.uuid()).optional(),
};

const createPropertySchema = z.object({
  organizationId: z.uuid(),
  ...propertyFields,
});

const updatePropertySchema = z.object(propertyFields).partial();

const clientPropertySchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    street: z.string().trim().min(1).max(300).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    zip: z.string().trim().max(20).optional(),
    unitCount: z.coerce.number().int().positive().optional(),
    squareFootage: z.coerce.number().int().positive().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

const rosterSchema = z.object({
  specialistId: z.uuid(),
  assignment: z.enum(assignments),
});

module.exports = { createPropertySchema, updatePropertySchema, clientPropertySchema, rosterSchema };
