const { parseBody } = require("../../shared/http");
const { emitChatMessage, emitChatDeleted } = require("../../shared/socket");
const { sendMessageSchema } = require("./chats.validation");
const chatService = require("./chats.service");

async function list(req, res) {
  res.json(await chatService.list(req.user));
}

async function messages(req, res) {
  res.json(await chatService.messages(req.params.id, req.user, req.query));
}

async function send(req, res) {
  const input = parseBody(sendMessageSchema, req.body);
  const result = await chatService.send(req.params.id, req.user, input.body);
  emitChatMessage(result.chatId, result.message);
  res.status(201).json({ message: result.message });
}

async function remove(req, res) {
  const result = await chatService.remove(req.params.id, req.user);
  emitChatDeleted(result.chatId);
  res.json({ message: result.message });
}

module.exports = { list, messages, send, remove };
