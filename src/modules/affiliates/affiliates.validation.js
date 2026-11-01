const { z } = require("zod");

const businessTypes = ["Hotel", "Restaurant", "Villa", "Property"];

const decisionMakers = [
  "Property Owners / Landlords",
  "Asset Managers",
  "Property Managers / Regional Directors",
  "HOA / Condo Board Members",
  "Facilities Directors",
];

const propertyTypes = [
  "Premium Residential / Luxury Multi-Family High-Rises",
  "Commercial Multi-Tenant Office Buildings",
  "Mixed-Use Developments",
  "Corporate Parks / Retail Complexes",
];

const portfolioSizes = ["1-5 Properties", "6-20 Properties", "21+ Properties"];

const introMethods = [
  "Direct warm email / phone introductions to specific property managers",
  "Recommending Amenity during routine client consulting / risk audits",
  "Including Amenity Ops in email newsletters, blogs, or digital content",
  "Co-hosting webinars or networking events",
];

const quarterlyIntroductions = ["1-3 per quarter", "4-10 per quarter", "10+ per quarter"];

function choices(options) {
  return z
    .array(z.enum(options))
    .min(1)
    .refine((items) => new Set(items).size === items.length, {
      message: "Choose each option once",
    });
}

const applySchema = z.object({
  companyName: z.string().trim().min(1).max(160),
  fullName: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  website: z.string().trim().max(200).optional(),
  businessType: z.enum(businessTypes),
  markets: z.string().trim().min(1).max(600),
  decisionMakers: choices(decisionMakers),
  propertyTypes: choices(propertyTypes),
  portfolioSize: z.enum(portfolioSizes),
  introMethods: choices(introMethods),
  quarterlyIntroductions: z.enum(quarterlyIntroductions),
  partnershipFit: z.string().trim().min(1).max(400),
  termsAccepted: z.literal(true),
  taxAcknowledged: z.literal(true),
  informationConfirmed: z.literal(true),
  password: z.string().min(8).max(72).optional(),
});

const applicationOptions = {
  businessTypes,
  decisionMakers,
  propertyTypes,
  portfolioSizes,
  introMethods,
  quarterlyIntroductions,
};

module.exports = { applySchema, applicationOptions };
