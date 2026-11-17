const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const payoutController = require("./payouts.controller");

const router = express.Router();
const staff = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER", "SPECIALIST")];
const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/", ...staff, asyncHandler(payoutController.list));
router.post(
  "/request",
  requireAuth,
  requireRole("SPECIALIST"),
  asyncHandler(payoutController.requestPayout)
);
router.post("/:id/approve", ...superAdmin, asyncHandler(payoutController.approve));
router.post("/:id/pay", ...superAdmin, asyncHandler(payoutController.markPaid));
router.get("/:id", ...staff, asyncHandler(payoutController.show));

module.exports = router;
