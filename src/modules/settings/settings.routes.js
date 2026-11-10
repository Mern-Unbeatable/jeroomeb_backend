const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const settingsController = require("./settings.controller");

const router = express.Router();
const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/pricing", ...superAdmin, asyncHandler(settingsController.pricing));
router.put("/pricing/full-service", ...superAdmin, asyncHandler(settingsController.saveFullService));
router.post("/pricing/full-service/restore", ...superAdmin, asyncHandler(settingsController.restoreFullService));
router.put("/pricing/software", ...superAdmin, asyncHandler(settingsController.saveSoftware));

module.exports = router;
