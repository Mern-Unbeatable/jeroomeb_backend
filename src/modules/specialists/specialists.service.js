const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { createCode, isUniqueConflict } = require("../../shared/codes");
const { applicationOptions, travelMiles, comfortRatings } = require("./specialists.validation");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function splitLocation(location) {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], state: parts.slice(1).join(", ") };
  }
  return { city: location, state: null };
}

function comfortLabel(rating) {
  const match = comfortRatings.find((item) => item.value === rating);
  return match ? match.label : null;
}

function toApplication(user, profile) {
  const answers = profile.situationalAnswers || {};
  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      status: user.status,
    },
    profile: {
      id: profile.id,
      code: profile.code,
      location: profile.state ? `${profile.city}, ${profile.state}` : profile.city,
      travelRange: answers.travelRange || null,
      shiftAvailability: answers.shiftAvailability || [],
      premiumPropertyExperience: Boolean(answers.premiumPropertyExperience),
      propertyTypes: answers.propertyTypes || [],
      assetProtectionExperience: profile.experienceSummary,
      complianceExperience: profile.regulationSummary,
      comfortRating: profile.comfortRating,
      comfortLabel: comfortLabel(profile.comfortRating),
      multiPointInspection: answers.multiPointInspection || null,
      handOffBrief: answers.handOffBrief || null,
      riskReduction: answers.riskReduction || null,
      hasTransportation: profile.hasTransportation,
      canDoMultiPointInspection: profile.canDoMultiPointInspection,
      backgroundCheckConsent: profile.backgroundCheckConsent,
      informationConfirmed: Boolean(answers.informationConfirmed),
      applicationStatus: profile.applicationStatus,
      createdAt: profile.createdAt,
    },
  };
}

function options() {
  return applicationOptions;
}

async function apply(input) {
  const email = normalizeEmail(input.email);
  const passwordHash = await bcrypt.hash(
    input.password || crypto.randomBytes(32).toString("hex"),
    12
  );
  const location = splitLocation(input.location);
  const compliance = input.complianceExperience ? input.complianceExperience : null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: input.fullName,
            phone: input.phone,
            role: "SPECIALIST",
            status: "ACTIVE",
            mustChangePassword: !input.password,
          },
        });

        const profile = await tx.specialistProfile.create({
          data: {
            userId: user.id,
            code: createCode("SPC"),
            applicationStatus: "SUBMITTED",
            city: location.city,
            state: location.state,
            travelRadiusMiles: travelMiles[input.travelRange],
            shiftPreference: input.shiftAvailability.join(", "),
            propertyTypesExperience: input.propertyTypes.join(", "),
            experienceSummary: input.assetProtectionExperience,
            regulationSummary: compliance,
            comfortRating: input.comfortRating,
            situationalAnswers: {
              travelRange: input.travelRange,
              shiftAvailability: input.shiftAvailability,
              premiumPropertyExperience: input.premiumPropertyExperience,
              propertyTypes: input.propertyTypes,
              multiPointInspection: input.multiPointInspection,
              handOffBrief: input.handOffBrief,
              riskReduction: input.riskReduction,
              informationConfirmed: true,
            },
            hasTransportation: input.hasTransportation,
            canDoMultiPointInspection: input.canDoMultiPointInspection,
            backgroundCheckConsent: input.backgroundCheckConsent,
          },
        });

        return { user, profile };
      });

      return toApplication(result.user, result.profile);
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

  throw new HttpError(500, "Could not submit the application");
}

async function list() {
  const profiles = await prisma.specialistProfile.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    applications: profiles.map((profile) => toApplication(profile.user, profile)),
  };
}

async function getById(id) {
  const profile = await prisma.specialistProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!profile) {
    throw new HttpError(404, "Specialist application not found");
  }
  return { application: toApplication(profile.user, profile) };
}

async function remove(id) {
  const profile = await prisma.specialistProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new HttpError(404, "Specialist application not found");
  }
  await prisma.user.delete({ where: { id: profile.userId } });
  return { message: "Specialist application deleted" };
}

module.exports = { options, apply, list, getById, remove };
