const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const analyticsController = require("./analytics.controller");

const router = express.Router();
const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/export", ...superAdmin, asyncHandler(analyticsController.exportAnalytics));
router.get("/", ...superAdmin, asyncHandler(analyticsController.show));

module.exports = router;
