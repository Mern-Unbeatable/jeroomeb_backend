const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const inspectionController = require("./inspections.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];
const staff = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER", "SPECIALIST")];

router.get("/options", ...adminOnly, asyncHandler(inspectionController.options));
router.get("/", ...staff, asyncHandler(inspectionController.list));
router.post("/", ...adminOnly, asyncHandler(inspectionController.create));
router.get("/:id", ...staff, asyncHandler(inspectionController.show));
router.patch("/:id", ...adminOnly, asyncHandler(inspectionController.update));
router.post("/:id/cancel", ...adminOnly, asyncHandler(inspectionController.cancel));
router.put("/:id/answers", ...staff, asyncHandler(inspectionController.saveAnswers));
router.post("/:id/resolve", ...staff, asyncHandler(inspectionController.resolve));

module.exports = router;
