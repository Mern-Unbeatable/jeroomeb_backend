const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const dashboardController = require("./dashboard.controller");

const router = express.Router();
const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/overview", ...superAdmin, asyncHandler(dashboardController.adminOverview));
router.get(
  "/",
  requireAuth,
  requireRole("CLIENT", "TENANT_ADMIN"),
  asyncHandler(dashboardController.overview)
);

module.exports = router;
