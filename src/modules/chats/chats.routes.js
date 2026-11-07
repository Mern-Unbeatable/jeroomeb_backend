const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const chatController = require("./chats.controller");

const router = express.Router();
const readers = [requireAuth, requireRole("SUPER_ADMIN", "CLIENT", "TENANT_ADMIN")];
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/", ...readers, asyncHandler(chatController.list));
router.get("/:id/messages", ...readers, asyncHandler(chatController.messages));
router.post("/:id/messages", ...readers, asyncHandler(chatController.send));
router.delete("/:id", ...adminOnly, asyncHandler(chatController.remove));

module.exports = router;
