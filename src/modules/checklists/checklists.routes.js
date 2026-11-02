const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const checklistController = require("./checklists.controller");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN", "TEAM_MEMBER"),
  asyncHandler(checklistController.list)
);

module.exports = router;
