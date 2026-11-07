const { z } = require("zod");
const prisma = require("../../shared/prisma");
const { HttpError } = require("../../shared/http");
const { isUniqueConflict } = require("../../shared/codes");

const senderSelect = { id: true, fullName: true, role: true };

const chatInclude = {
  organization: { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: "desc" },
    take: 1,
    include: { sender: { select: senderSelect } },
  },
};

function toMessage(message) {
  return {
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    sender: {
      id: message.sender.id,
      fullName: message.sender.fullName,
      role: message.sender.role,
    },
  };
}

function toChat(chat) {
  const last = chat.messages[0] || null;
  return {
    id: chat.id,
    company: { id: chat.organization.id, name: chat.organization.name },
    lastMessage: last ? toMessage(last) : null,
    updatedAt: chat.updatedAt,
  };
}

async function fullServiceOrganization(user) {
  if (!user.organizationId) throw new HttpError(403, "This account has no company");
  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
  });
  if (
    !organization ||
    organization.subscriptionStatus !== "ACTIVE" ||
    organization.planKind !== "FULL_SERVICE"
  ) {
    throw new HttpError(403, "Chat is available on an active Service + Software plan");
  }
  return organization;
}

async function ensureChat(organizationId) {
  try {
    return await prisma.chat.create({
      data: { organizationId },
      include: chatInclude,
    });
  } catch (error) {
    if (!isUniqueConflict(error, "organizationId")) throw error;
    return prisma.chat.findUnique({
      where: { organizationId },
      include: chatInclude,
    });
  }
}

async function accessibleChat(id, user) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new HttpError(404, "Chat not found");

  const chat = await prisma.chat.findUnique({
    where: { id: parsed.data },
    include: { organization: true },
  });
  if (!chat) throw new HttpError(404, "Chat not found");

  if (user.role === "SUPER_ADMIN") {
    if (
      chat.organization.subscriptionStatus !== "ACTIVE" ||
      chat.organization.planKind !== "FULL_SERVICE"
    ) {
      throw new HttpError(404, "Chat not found");
    }
    return chat;
  }

  const organization = await fullServiceOrganization(user);
  if (chat.organizationId !== organization.id) {
    throw new HttpError(403, "You do not have access to this");
  }
  return chat;
}

async function list(user) {
  if (user.role === "SUPER_ADMIN") {
    const organizations = await prisma.organization.findMany({
      where: { subscriptionStatus: "ACTIVE", planKind: "FULL_SERVICE" },
      select: { id: true },
    });
    for (const organization of organizations) {
      await ensureChat(organization.id);
    }
    const chats = await prisma.chat.findMany({
      where: {
        organization: { subscriptionStatus: "ACTIVE", planKind: "FULL_SERVICE" },
      },
      include: chatInclude,
      orderBy: [{ updatedAt: "desc" }],
    });
    return { chats: chats.map(toChat) };
  }

  const organization = await fullServiceOrganization(user);
  const chat = await ensureChat(organization.id);
  return { chats: [toChat(chat)] };
}

function messageLimit(value) {
  const parsed = z.coerce.number().int().min(1).max(100).safeParse(value);
  return parsed.success ? parsed.data : 50;
}

async function messages(id, user, query) {
  const chat = await accessibleChat(id, user);
  const take = messageLimit(query.limit);
  let cursor;
  if (query.before) {
    const parsed = z.uuid().safeParse(query.before);
    if (!parsed.success) throw new HttpError(400, "Unknown message");
    const existing = await prisma.chatMessage.findFirst({
      where: { id: parsed.data, chatId: chat.id },
      select: { id: true },
    });
    if (!existing) throw new HttpError(400, "Unknown message");
    cursor = existing.id;
  }

  const rows = await prisma.chatMessage.findMany({
    where: { chatId: chat.id },
    orderBy: { createdAt: "desc" },
    take,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { sender: { select: senderSelect } },
  });

  return { messages: rows.reverse().map(toMessage) };
}

async function send(id, user, body) {
  const chat = await accessibleChat(id, user);
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({
      data: { chatId: chat.id, senderId: user.id, body },
      include: { sender: { select: senderSelect } },
    });
    await tx.chat.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });
    return created;
  });

  return { chatId: chat.id, message: toMessage(message) };
}

async function remove(id, actor) {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new HttpError(404, "Chat not found");

  const chat = await prisma.chat.findUnique({
    where: { id: parsed.data },
    include: { organization: { select: { name: true } } },
  });
  if (!chat) throw new HttpError(404, "Chat not found");

  await prisma.$transaction([
    prisma.activityEvent.create({
      data: {
        actorId: actor.id,
        type: "CHAT_DELETED",
        summary: `Chat with ${chat.organization.name} deleted`,
        entityType: "Chat",
        entityId: chat.id,
      },
    }),
    prisma.chat.delete({ where: { id: chat.id } }),
  ]);

  return { chatId: chat.id, message: "Chat deleted" };
}

module.exports = {
  list,
  messages,
  send,
  remove,
  accessibleChat,
  fullServiceOrganization,
  ensureChat,
};
