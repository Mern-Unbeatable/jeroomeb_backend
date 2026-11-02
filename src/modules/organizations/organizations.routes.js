const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const organizationController = require("./organizations.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/", ...adminOnly, asyncHandler(organizationController.list));
router.post("/provision", ...adminOnly, asyncHandler(organizationController.provision));
router.get("/:id", ...adminOnly, asyncHandler(organizationController.show));

module.exports = router;
