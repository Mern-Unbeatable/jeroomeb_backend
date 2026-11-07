const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const env = require("../config/env");
const prisma = require("./prisma");
const { allowedOrigins } = require("./cors");
const chatService = require("../modules/chats/chats.service");

let io;

function readSocketToken(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  if (typeof authToken === "string" && authToken.trim()) return authToken.trim();
  const header = socket.handshake.headers && socket.handshake.headers.authorization;
  if (typeof header === "string" && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) return token;
  }
  return null;
}

async function socketUser(socket) {
  const token = readSocketToken(socket);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET);
  } catch {
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.status === "DISABLED") return null;
  return user;
}

function attachSocket(server) {
  io = new Server(server, {
    cors: {
      origin: [...allowedOrigins()],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const user = await socketUser(socket);
      if (!user) {
        next(new Error("Authentication required"));
        return;
      }
      if (user.role !== "SUPER_ADMIN" && user.role !== "CLIENT" && user.role !== "TENANT_ADMIN") {
        next(new Error("You do not have access to this"));
        return;
      }
      socket.user = user;
      next();
    } catch (error) {
      next(error);
    }
  });

  io.on("connection", (socket) => {
    if (socket.user.role === "SUPER_ADMIN") {
      socket.join("chats:admin");
    } else {
      chatService
        .fullServiceOrganization(socket.user)
        .then((organization) => chatService.ensureChat(organization.id))
        .then((chat) => {
          socket.join(`chat:${chat.id}`);
          socket.emit("chat:ready", { chatId: chat.id });
        })
        .catch((error) => {
          socket.emit("chat:error", {
            message: error.status ? error.message : "Chat is not available",
          });
          socket.disconnect(true);
        });
    }

    socket.on("chat:join", async (payload) => {
      const parsed = z.uuid().safeParse(payload && payload.chatId);
      if (!parsed.success) {
        socket.emit("chat:error", { message: "Chat not found" });
        return;
      }
      try {
        const chat = await chatService.accessibleChat(parsed.data, socket.user);
        socket.join(`chat:${chat.id}`);
        socket.emit("chat:joined", { chatId: chat.id });
      } catch (error) {
        socket.emit("chat:error", {
          message: error.status ? error.message : "Could not join the chat",
        });
      }
    });
  });

  return io;
}

function emitChatMessage(chatId, message) {
  if (!io) return;
  io.to(`chat:${chatId}`).to("chats:admin").emit("chat:message", { chatId, message });
}

function emitChatDeleted(chatId) {
  if (!io) return;
  io.to(`chat:${chatId}`).to("chats:admin").emit("chat:deleted", { chatId });
}

module.exports = { attachSocket, emitChatMessage, emitChatDeleted };
