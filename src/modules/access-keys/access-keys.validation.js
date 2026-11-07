const { z } = require("zod");

function clearable(max) {
  return z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value || null));
}

const fields = {
  mainEntryInstructions: clearable(4000),
  buildingAccessCode: clearable(80),
  elevatorAccess: clearable(4000),
  lockboxCode: clearable(80),
  emergencyContactName: clearable(120),
  emergencyContactTitle: clearable(120),
  emergencyContactPhone: clearable(30),
  additionalNotes: clearable(4000),
};

const contentKeys = Object.keys(fields);

function hasContent(input) {
  return contentKeys.some((key) => input[key] !== undefined && input[key] !== null);
}

const createAccessKeySchema = z
  .object(fields)
  .refine(hasContent, { message: "Add at least one access detail" });

const updateAccessKeySchema = z
  .object(fields)
  .refine((input) => contentKeys.some((key) => input[key] !== undefined), {
    message: "Send a field to update",
  });

module.exports = { createAccessKeySchema, updateAccessKeySchema, hasContent };
