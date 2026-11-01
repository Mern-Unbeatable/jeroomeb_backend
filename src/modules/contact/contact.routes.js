const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const contactController = require("./contact.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.post("/", asyncHandler(contactController.create));
router.get("/", ...adminOnly, asyncHandler(contactController.list));
router.delete("/:id", ...adminOnly, asyncHandler(contactController.remove));

module.exports = router;
