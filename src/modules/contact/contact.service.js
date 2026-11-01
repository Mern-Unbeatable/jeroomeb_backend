const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function toPublicMessage(message) {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    phone: message.phone,
    message: message.message,
    createdAt: message.createdAt,
  };
}

async function create(input) {
  const message = await prisma.contactMessage.create({
    data: {
      name: input.name,
      email: normalizeEmail(input.email),
      phone: input.phone || null,
      message: input.message,
    },
  });

  return { message: toPublicMessage(message) };
}

async function list() {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
  });
  return { messages: messages.map(toPublicMessage) };
}

async function remove(id) {
  const existing = await prisma.contactMessage.findUnique({ where: { id } });
  if (!existing) {
    throw new HttpError(404, "Contact message not found");
  }
  await prisma.contactMessage.delete({ where: { id } });
  return { message: "Contact message deleted" };
}

module.exports = { create, list, remove };
