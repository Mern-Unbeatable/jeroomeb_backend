const bcrypt = require("bcryptjs");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { isUniqueConflict } = require("../../shared/codes");
const { sendTenantWelcomeEmail } = require("../../shared/mailer");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function money(value) {
  return value == null ? null : value.toString();
}

function toPlan(plan) {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    kind: plan.kind,
    monthlyPrice: money(plan.monthlyPrice),
    propertyLimit: plan.propertyLimit,
  };
}

function toTenant(organization) {
  return {
    id: organization.id,
    name: organization.name,
    subscriptionStatus: organization.subscriptionStatus,
    propertyLimit: organization.propertyLimit,
    licensePlan: toPlan(organization.licensePlan),
    planKind: organization.planKind,
    paidAt: organization.paidAt,
    priceBand: organization.servicePriceBand
      ? {
          id: organization.servicePriceBand.id,
          name: organization.servicePriceBand.name,
          kind: organization.servicePriceBand.kind,
          monthlyPrice: money(organization.servicePriceBand.monthlyPrice),
        }
      : null,
    userCount: organization._count ? organization._count.users : undefined,
    propertyCount: organization._count ? organization._count.properties : undefined,
    createdAt: organization.createdAt,
  };
}

const tenantInclude = {
  licensePlan: true,
  servicePriceBand: true,
  _count: { select: { users: true, properties: true } },
};

async function list() {
  const organizations = await prisma.organization.findMany({
    include: tenantInclude,
    orderBy: { createdAt: "desc" },
  });
  return { tenants: organizations.map(toTenant) };
}

async function getById(id) {
  const organization = await prisma.organization.findUnique({
    where: { id },
    include: {
      ...tenantInclude,
      users: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          role: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      },
      properties: {
        select: { id: true, code: true, name: true, status: true, propertyType: true },
        orderBy: { createdAt: "desc" },
      },
      checklistAccess: {
        include: { template: { select: { id: true, name: true } } },
      },
    },
  });
  if (!organization) throw new HttpError(404, "Tenant not found");

  return {
    tenant: {
      ...toTenant(organization),
      users: organization.users,
      properties: organization.properties,
      checklists: organization.checklistAccess.map((link) => link.template),
    },
  };
}

async function provision(input, actor) {
  const email = normalizeEmail(input.admin.email);
  const band = await prisma.servicePriceBand.findFirst({
    where: { id: input.priceBandId, active: true, kind: "SOFTWARE" },
  });
  if (!band) throw new HttpError(400, "Software plan not found");

  const templateIds = [...new Set(input.checklistTemplateIds)];
  if (templateIds.length) {
    const templates = await prisma.checklistTemplate.findMany({
      where: { id: { in: templateIds }, active: true },
    });
    if (templates.length !== templateIds.length) {
      throw new HttpError(400, "One or more checklist templates are not available");
    }
  }

  const passwordHash = await bcrypt.hash(input.admin.password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          planKind: "SOFTWARE",
          servicePriceBandId: band.id,
          propertyLimit: input.propertyLimit ?? null,
          subscriptionStatus: input.subscriptionStatus,
          checklistAccess: {
            create: templateIds.map((templateId) => ({ templateId })),
          },
        },
        include: tenantInclude,
      });

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: input.admin.fullName,
          phone: input.admin.phone || null,
          role: "TENANT_ADMIN",
          status: "ACTIVE",
          mustChangePassword: true,
          organizationId: organization.id,
        },
      });

      await tx.activityEvent.create({
        data: {
          actorId: actor ? actor.id : null,
          type: "TENANT_PROVISIONED",
          summary: `Provisioned tenant ${organization.name}`,
          entityType: "Organization",
          entityId: organization.id,
        },
      });

      return { organization, user };
    });

    try {
      await sendTenantWelcomeEmail({
        to: email,
        fullName: input.admin.fullName,
        organizationName: result.organization.name,
        password: input.admin.password,
      });
    } catch (error) {
      console.error("Tenant welcome email failed:", error.message);
      throw new HttpError(502, "The tenant was created, but the welcome email could not be sent");
    }

    return {
      tenant: toTenant(result.organization),
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        status: result.user.status,
        mustChangePassword: result.user.mustChangePassword,
      },
    };
  } catch (error) {
    if (isUniqueConflict(error, "email")) {
      throw new HttpError(409, "An account with this email already exists");
    }
    throw error;
  }
}

module.exports = { list, getById, provision };
