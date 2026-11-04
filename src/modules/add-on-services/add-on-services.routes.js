const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const addOnController = require("./add-on-services.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];
const readers = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER", "CLIENT", "TENANT_ADMIN")];

router.get("/", ...readers, asyncHandler(addOnController.list));
router.post("/", ...adminOnly, asyncHandler(addOnController.create));
router.patch("/:id", ...adminOnly, asyncHandler(addOnController.update));
router.delete("/:id", ...adminOnly, asyncHandler(addOnController.remove));

module.exports = router;
