const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const activityController = require("./activity.controller");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  requireRole("SUPER_ADMIN"),
  asyncHandler(activityController.list)
);

module.exports = router;
