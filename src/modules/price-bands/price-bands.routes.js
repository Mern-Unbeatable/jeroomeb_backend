const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const priceBandController = require("./price-bands.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/", ...adminOnly, asyncHandler(priceBandController.list));
router.patch("/:id", ...adminOnly, asyncHandler(priceBandController.update));

module.exports = router;
