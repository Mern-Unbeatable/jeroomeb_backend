const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { isUniqueConflict } = require("../../shared/codes");
const { applicationOptions } = require("./affiliates.validation");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toApplication(user, profile) {
  const answers = profile.strategyAnswers || {};
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
      companyName: profile.companyName,
      jobTitle: profile.jobTitle,
      website: profile.website,
      businessType: profile.businessType,
      markets: profile.marketSummary,
      decisionMakers: answers.decisionMakers || [],
      propertyTypes: answers.propertyTypes || [],
      portfolioSize: profile.portfolioBand,
      introMethods: answers.introMethods || [],
      quarterlyIntroductions: answers.quarterlyIntroductions || null,
      partnershipFit: answers.partnershipFit || null,
      termsAccepted: profile.termsAccepted,
      taxAcknowledged: profile.taxAcknowledged,
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

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: input.fullName,
          phone: input.phone,
          role: "AFFILIATE",
          status: "ACTIVE",
          mustChangePassword: !input.password,
        },
      });

      const profile = await tx.affiliateProfile.create({
        data: {
          userId: user.id,
          companyName: input.companyName,
          jobTitle: input.jobTitle,
          website: input.website || null,
          businessType: input.businessType,
          marketSummary: input.markets,
          portfolioBand: input.portfolioSize,
          strategyAnswers: {
            decisionMakers: input.decisionMakers,
            propertyTypes: input.propertyTypes,
            introMethods: input.introMethods,
            quarterlyIntroductions: input.quarterlyIntroductions,
            partnershipFit: input.partnershipFit,
            informationConfirmed: true,
          },
          termsAccepted: true,
          taxAcknowledged: true,
          applicationStatus: "SUBMITTED",
        },
      });

      return { user, profile };
    });

    return toApplication(result.user, result.profile);
  } catch (error) {
    if (isUniqueConflict(error, "email")) {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw error;
  }
}

async function list() {
  const profiles = await prisma.affiliateProfile.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    applications: profiles.map((profile) => toApplication(profile.user, profile)),
  };
}

async function getById(id) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!profile) {
    throw new HttpError(404, "Affiliate application not found");
  }
  return { application: toApplication(profile.user, profile) };
}

async function remove(id) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { id } });
  if (!profile) {
    throw new HttpError(404, "Affiliate application not found");
  }
  await prisma.user.delete({ where: { id: profile.userId } });
  return { message: "Affiliate application deleted" };
}

module.exports = { options, apply, list, getById, remove };
