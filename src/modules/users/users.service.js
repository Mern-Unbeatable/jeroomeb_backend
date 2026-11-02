const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
  organization: { select: { id: true, name: true } },
  specialistProfile: { select: { id: true, code: true, applicationStatus: true } },
  affiliateProfile: { select: { id: true, companyName: true, applicationStatus: true } },
};

async function list(role) {
  const where = {};
  if (role) where.role = role;
  const users = await prisma.user.findMany({
    where,
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
  return { users };
}

async function getById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });
  if (!user) throw new HttpError(404, "User not found");
  return { user };
}

module.exports = { list, getById };
