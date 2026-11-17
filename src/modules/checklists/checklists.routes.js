const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const checklistController = require("./checklists.controller");

const router = express.Router();
const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/", ...superAdmin, asyncHandler(checklistController.list));
router.post("/", ...superAdmin, asyncHandler(checklistController.create));

module.exports = router;
