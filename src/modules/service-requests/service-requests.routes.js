const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { optionalAuth, requireAuth, requireRole } = require("../../shared/auth");
const serviceRequestController = require("./service-requests.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/options", asyncHandler(serviceRequestController.options));
router.post("/", optionalAuth, asyncHandler(serviceRequestController.create));
router.get("/", ...adminOnly, asyncHandler(serviceRequestController.list));
router.get("/:id", ...adminOnly, asyncHandler(serviceRequestController.show));
router.patch("/:id/status", ...adminOnly, asyncHandler(serviceRequestController.updateStatus));
router.delete("/:id", ...adminOnly, asyncHandler(serviceRequestController.remove));

module.exports = router;
