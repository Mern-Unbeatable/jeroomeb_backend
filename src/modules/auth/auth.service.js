const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const env = require("../../config/env");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { signToken } = require("../../shared/auth");
const { sendPasswordResetEmail } = require("../../shared/mailer");

const RESET_TOKEN_MINUTES = 60;

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    organization: user.organization
      ? {
          id: user.organization.id,
          name: user.organization.name,
          subscriptionStatus: user.organization.subscriptionStatus,
        }
      : null,
  };
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createOtp() {
  return String(crypto.randomInt(0, 100000)).padStart(5, "0");
}

function propertyCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[crypto.randomInt(alphabet.length)];
  }
  return `PROP-${suffix}`;
}

function isUniqueConflict(error, field) {
  const target = error && error.meta && error.meta.target;
  const fields = Array.isArray(target) ? target.map(String) : target ? [String(target)] : [];
  return error && error.code === "P2002" && fields.some((item) => item.includes(field));
}

async function createAccount(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: { name: input.companyName },
        });

        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            fullName: input.fullName,
            phone: input.phone,
            role: "CLIENT",
            status: "ACTIVE",
            organizationId: organization.id,
          },
        });

        await tx.property.create({
          data: {
            code: propertyCode(),
            organizationId: organization.id,
            name: input.companyName,
            contactName: input.fullName,
            email: input.email,
            phone: input.phone,
            street: input.propertyAddress,
            propertyType: "RESIDENTIAL_MULTI_TENANT",
            status: "DRAFT",
            unitCount: input.numberOfUnits,
            squareFootage: input.squareFootage,
          },
        });

        return tx.user.findUnique({
          where: { id: user.id },
          include: {
            organization: {
              select: { id: true, name: true, subscriptionStatus: true },
            },
          },
        });
      });
    } catch (error) {
      if (isUniqueConflict(error, "email")) {
        throw new HttpError(409, "An account with this email already exists");
      }
      if (isUniqueConflict(error, "code") && attempt < 4) {
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(500, "Could not create the account");
}

async function register(input) {
  const email = normalizeEmail(input.email);
  const user = await createAccount({ ...input, email });
  return { user: toPublicUser(user), token: signToken(user) };
}

async function login(input) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: {
        select: { id: true, name: true, subscriptionStatus: true },
      },
    },
  });

  const passwordMatches = user
    ? await bcrypt.compare(input.password, user.passwordHash)
    : false;

  if (!user || user.status === "DISABLED" || !passwordMatches) {
    throw new HttpError(401, "Invalid email or password");
  }

  return { user: toPublicUser(user), token: signToken(user) };
}

async function forgotPassword(input) {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({ where: { email } });
  const response = {
    message: "If an account exists for that email, a reset code has been sent.",
  };

  if (!user || user.status === "DISABLED") {
    return response;
  }

  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  let otp = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    otp = createOtp();
    try {
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(otp),
          expiresAt,
        },
      });
      break;
    } catch (error) {
      otp = null;
      if (isUniqueConflict(error, "tokenHash") && attempt < 4) {
        continue;
      }
      throw error;
    }
  }

  if (!otp) {
    throw new HttpError(500, "Could not create the reset code");
  }

  try {
    await sendPasswordResetEmail({ to: user.email, otp, expiresAt });
  } catch (error) {
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });
    console.error("Password reset email failed:", error.message);
    throw new HttpError(500, "Could not send the reset email");
  }

  if (env.NODE_ENV !== "production") {
    response.otp = otp;
    response.expiresAt = expiresAt.toISOString();
  }

  return response;
}

async function verifyOtp(input) {
  const email = normalizeEmail(input.email);
  const tokenHash = hashResetToken(input.otp);
  const user = await prisma.user.findUnique({ where: { email } });
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (
    !user ||
    user.status === "DISABLED" ||
    !record ||
    record.userId !== user.id ||
    record.usedAt ||
    record.expiresAt < new Date()
  ) {
    throw new HttpError(400, "Invalid or expired code");
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { tokenHash: hashResetToken(resetToken) },
  });

  return { message: "Code verified", resetToken };
}

async function resetPassword(input) {
  if (input.password !== input.confirmPassword) {
    throw new HttpError(400, "Passwords do not match");
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(input.resetToken) },
  });
  const user = record
    ? await prisma.user.findUnique({ where: { id: record.userId } })
    : null;

  if (
    !user ||
    user.status === "DISABLED" ||
    !record ||
    record.usedAt ||
    record.expiresAt < new Date()
  ) {
    throw new HttpError(400, "Invalid or expired reset session");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, mustChangePassword: false },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return { message: "Password updated" };
}

async function changePassword(userId, input) {
  if (input.newPassword !== input.confirmPassword) {
    throw new HttpError(400, "Passwords do not match");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "DISABLED") {
    throw new HttpError(401, "Authentication required");
  }

  const currentMatches = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!currentMatches) {
    throw new HttpError(400, "Current password is incorrect");
  }
  if (input.currentPassword === input.newPassword) {
    throw new HttpError(400, "New password must be different");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });

  return { message: "Password updated" };
}

function currentUser(user) {
  return toPublicUser(user);
}

module.exports = {
  register,
  login,
  forgotPassword,
  verifyOtp,
  resetPassword,
  changePassword,
  currentUser,
};
