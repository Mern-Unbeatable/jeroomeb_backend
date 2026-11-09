const { z } = require("zod");
const { HttpError } = require("../../shared/http");

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.email(),
  password: z.string().min(8).max(72),
  phone: z.string().trim().min(7).max(30),
  companyName: z.string().trim().min(1).max(160),
  numberOfUnits: z.coerce.number().int().positive(),
  squareFootage: z.coerce.number().int().positive(),
  propertyAddress: z.string().trim().min(1).max(300),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(72),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const verifyOtpSchema = z.object({
  email: z.email(),
  otp: z.string().trim().regex(/^\d{5}$/),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().min(1),
  password: z.string().min(8).max(72),
  confirmPassword: z.string().min(1).max(72),
});

const profileSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    email: z.email().optional(),
    phone: z.string().trim().min(7).max(30).optional(),
    companyName: z.string().trim().min(1).max(160).optional(),
    numberOfUnits: z.coerce.number().int().positive().optional(),
    squareFootage: z.coerce.number().int().positive().optional(),
    propertyAddress: z.string().trim().min(1).max(300).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    zip: z.string().trim().max(20).optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "Nothing to update",
  });

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
  confirmPassword: z.string().min(1).max(72),
});

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid request", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

module.exports = {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema,
  changePasswordSchema,
  profileSchema,
  parseBody,
};
