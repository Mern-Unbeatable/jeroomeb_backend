const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const payoutController = require("./payouts.controller");

const router = express.Router();
const staff = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER", "SPECIALIST")];

router.get("/", ...staff, asyncHandler(payoutController.list));
router.get("/:id", ...staff, asyncHandler(payoutController.show));

module.exports = router;
