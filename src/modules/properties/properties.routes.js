const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const propertyController = require("./properties.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/", ...adminOnly, asyncHandler(propertyController.list));
router.post("/", ...adminOnly, asyncHandler(propertyController.create));
router.get("/:id", ...adminOnly, asyncHandler(propertyController.show));
router.patch("/:id", ...adminOnly, asyncHandler(propertyController.update));
router.delete("/:id", ...adminOnly, asyncHandler(propertyController.remove));
router.post("/:id/roster", ...adminOnly, asyncHandler(propertyController.assignRoster));
router.delete("/:id/roster/:rosterId", ...adminOnly, asyncHandler(propertyController.removeRoster));

module.exports = router;
