const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const userController = require("./users.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/", ...adminOnly, asyncHandler(userController.list));
router.get("/:id", ...adminOnly, asyncHandler(userController.show));

module.exports = router;
