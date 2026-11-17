const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const feedbackController = require("./specialist-feedback.controller");

const router = express.Router();
const client = [requireAuth, requireRole("CLIENT", "TENANT_ADMIN")];

router.get("/", ...client, asyncHandler(feedbackController.list));
router.post("/", ...client, asyncHandler(feedbackController.create));

module.exports = router;
