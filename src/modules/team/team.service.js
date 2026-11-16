const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { createCode, isUniqueConflict } = require("../../shared/codes");
const { sendTeamWelcomeEmail } = require("../../shared/mailer");

const teamRoles = ["SPECIALIST", "TENANT_ADMIN"];

const memberInclude = {
  organization: { select: { id: true, name: true } },
  specialistProfile: {
    include: {
      _count: {
        select: {
          inspections: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } },
        },
      },
    },
  },
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 14; i += 1) {
    password += alphabet[crypto.randomInt(alphabet.length)];
  }
  return password;
}

function roleLabel(user) {
  if (user.role === "SPECIALIST") return "Operations Continuity Specialist";
  return `${user.organization.name} Administrator`;
}

function toMember(user) {
  const profile = user.specialistProfile;
  const location = [profile && profile.city, profile && profile.state].filter(Boolean).join(", ");
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    roleLabel: roleLabel(user),
    status: user.status,
    setupPending: user.mustChangePassword,
    organization: user.organization,
    specialistId: profile ? profile.id : null,
    code: profile ? profile.code : null,
    location: location || null,
    openCount: profile ? profile._count.inspections : 0,
  };
}

async function reload(id) {
  return prisma.user.findUnique({ where: { id }, include: memberInclude });
}

async function findMember(id) {
  const user = await reload(id);
  if (!user || !teamRoles.includes(user.role) || !user.organizationId) {
    throw new HttpError(404, "Team member not found");
  }
  return user;
}

async function list(organizationId) {
  if (organizationId) {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) throw new HttpError(404, "Organization not found");
  }

  const users = await prisma.user.findMany({
    where: {
      role: { in: teamRoles },
      organizationId: organizationId || { not: null },
      status: { not: "DISABLED" },
    },
    include: memberInclude,
    orderBy: { fullName: "asc" },
  });

  return { count: users.length, members: users.map(toMember) };
}

function createProfile(tx, userId) {
  return tx.specialistProfile.create({
    data: {
      userId,
      code: createCode("OCS"),
      applicationStatus: "APPROVED",
    },
  });
}

async function create(input, actor) {
  const email = normalizeEmail(input.email);
  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!organization) throw new HttpError(404, "Organization not found");

  const password = input.password || temporaryPassword();
  const passwordHash = await bcrypt.hash(password, 12);
  let created;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            passwordHash,
            fullName: input.fullName,
            role: input.role,
            status: "ACTIVE",
            mustChangePassword: true,
            organizationId: organization.id,
          },
        });
        await createProfile(tx, user.id);
        await tx.activityEvent.create({
          data: {
            actorId: actor ? actor.id : null,
            type: "TEAM_MEMBER_ADDED",
            summary: `Added ${user.fullName} to ${organization.name}`,
            entityType: "User",
            entityId: user.id,
          },
        });
        return user;
      });
      break;
    } catch (error) {
      if (isUniqueConflict(error, "email")) {
        throw new HttpError(409, "An account with this email already exists");
      }
      if (isUniqueConflict(error, "code") && attempt < 4) continue;
      throw error;
    }
  }

  try {
    await sendTeamWelcomeEmail({
      to: email,
      fullName: input.fullName,
      organizationName: organization.name,
      roleLabel: roleLabel({ role: input.role, organization }),
      password,
    });
  } catch (error) {
    console.error("Team welcome email failed:", error.message);
    throw new HttpError(502, "The team member was created, but the welcome email could not be sent");
  }

  return { member: toMember(await reload(created.id)) };
}

async function changeRole(id, role, actor) {
  const user = await findMember(id);
  if (user.status === "DISABLED") throw new HttpError(400, "This member is deactivated");
  if (user.role === role) {
    throw new HttpError(
      409,
      role === "TENANT_ADMIN" ? "This member is already an admin" : "This member is already a specialist"
    );
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await prisma.$transaction(async (tx) => {
        if (role === "SPECIALIST" && !user.specialistProfile) await createProfile(tx, user.id);
        await tx.user.update({ where: { id: user.id }, data: { role } });
        await tx.activityEvent.create({
          data: {
            actorId: actor ? actor.id : null,
            type: "TEAM_ROLE_CHANGED",
            summary: `${user.fullName} is now ${role === "TENANT_ADMIN" ? "an admin" : "a specialist"}`,
            entityType: "User",
            entityId: user.id,
          },
        });
      });
      break;
    } catch (error) {
      if (isUniqueConflict(error, "code") && attempt < 4) continue;
      throw error;
    }
  }

  return { member: toMember(await reload(user.id)) };
}

async function deactivate(id, actor) {
  const user = await findMember(id);
  if (user.status === "DISABLED") throw new HttpError(409, "This member is already deactivated");

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { status: "DISABLED" } }),
    prisma.activityEvent.create({
      data: {
        actorId: actor ? actor.id : null,
        type: "TEAM_MEMBER_DEACTIVATED",
        summary: `${user.fullName} was deactivated`,
        entityType: "User",
        entityId: user.id,
      },
    }),
  ]);

  return { member: toMember({ ...user, status: "DISABLED" }) };
}

async function remove(id, actor) {
  const user = await findMember(id);
  const profile = user.specialistProfile;
  if (profile) {
    const [roster, inspections, payouts] = await Promise.all([
      prisma.propertyRoster.count({ where: { specialistId: profile.id } }),
      prisma.inspection.count({ where: { specialistId: profile.id } }),
      prisma.payout.count({ where: { specialistId: profile.id } }),
    ]);
    if (roster || inspections || payouts) {
      throw new HttpError(409, "This member is assigned to properties or inspections");
    }
  }

  await prisma.$transaction([
    prisma.activityEvent.create({
      data: {
        actorId: actor ? actor.id : null,
        type: "TEAM_MEMBER_DELETED",
        summary: `${user.fullName} was removed from ${user.organization.name}`,
        entityType: "User",
        entityId: user.id,
      },
    }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return { message: "Team member removed" };
}

module.exports = { list, create, changeRole, deactivate, remove };
