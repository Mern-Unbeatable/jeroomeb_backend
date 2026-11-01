const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const affiliateController = require("./affiliates.controller");

const router = express.Router();
const adminOnly = [requireAuth, requireRole("SUPER_ADMIN", "TEAM_MEMBER")];

router.get("/options", affiliateController.options);
router.post("/applications", asyncHandler(affiliateController.apply));
router.get("/applications", ...adminOnly, asyncHandler(affiliateController.list));
router.get("/applications/:id", ...adminOnly, asyncHandler(affiliateController.show));
router.delete("/applications/:id", ...adminOnly, asyncHandler(affiliateController.remove));

module.exports = router;
