const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const specialistController = require("./specialists.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/options", specialistController.options);
router.post("/applications", asyncHandler(specialistController.apply));
router.get("/applications", ...adminOnly, asyncHandler(specialistController.list));
router.get("/applications/:id", ...adminOnly, asyncHandler(specialistController.show));
router.delete("/applications/:id", ...adminOnly, asyncHandler(specialistController.remove));

module.exports = router;
