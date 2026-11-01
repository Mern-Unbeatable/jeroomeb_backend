const { z } = require("zod");

const propertyTypes = [
  {
    value: "RESIDENTIAL_MULTI_TENANT",
    label: "Residential Multi-Tenant",
    description: "Apartments and residential properties",
  },
  {
    value: "COMMERCIAL",
    label: "Commercial",
    description: "Commercial multi-tenant properties",
  },
  {
    value: "ACTIVE_ADULT_55",
    label: "55+ Active Adult Community",
    description: "Active adult residential communities",
  },
];

const propertyTypeByInput = new Map(
  propertyTypes.flatMap((option) => [
    [option.value, option.value],
    [option.label, option.value],
  ])
);

const statusActions = {
  Approved: "APPROVED",
  APPROVED: "APPROVED",
  Cancel: "CANCELLED",
  Cancelled: "CANCELLED",
  CANCELLED: "CANCELLED",
  Ongoing: "ONGOING",
  ONGOING: "ONGOING",
  Completed: "COMPLETED",
  COMPLETED: "COMPLETED",
};

const statusFilters = {
  "Pending Review": "PENDING_REVIEW",
  PENDING_REVIEW: "PENDING_REVIEW",
  "In Progress": "IN_PROGRESS",
  IN_PROGRESS: "IN_PROGRESS",
  Approved: "APPROVED",
  APPROVED: "APPROVED",
  Ongoing: "ONGOING",
  ONGOING: "ONGOING",
  Completed: "COMPLETED",
  COMPLETED: "COMPLETED",
  Cancel: "CANCELLED",
  Cancelled: "CANCELLED",
  CANCELLED: "CANCELLED",
};

const createServiceRequestSchema = z.object({
  propertyType: z.string().trim().refine((value) => propertyTypeByInput.has(value), {
    message: "Invalid property type",
  }),
  unitCount: z.coerce.number().int().positive(),
  buildingCount: z.coerce.number().int().positive().optional(),
  serviceIds: z.array(z.uuid()).min(1),
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(160),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  propertyInformation: z.string().trim().min(1).max(4000),
  informationConfirmed: z.literal(true),
});

const updateStatusSchema = z.object({
  status: z.string().trim().refine((value) => statusActions[value], {
    message: "Unknown status",
  }),
});

module.exports = {
  propertyTypes,
  propertyTypeByInput,
  statusActions,
  statusFilters,
  createServiceRequestSchema,
  updateStatusSchema,
};
