const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const controller = require("./supabase-inspectors.controller");

const router = express.Router();

const superAdmin = [requireAuth, requireRole("SUPER_ADMIN")];

router.get("/", ...superAdmin, asyncHandler(controller.list));
router.get("/:id", ...superAdmin, asyncHandler(controller.show));

module.exports = router;
