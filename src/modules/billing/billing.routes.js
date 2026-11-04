const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const billingController = require("./billing.controller");

const router = express.Router();
const client = [requireAuth, requireRole("CLIENT", "TENANT_ADMIN")];

router.get("/plans", asyncHandler(billingController.plans));
router.post("/checkout", ...client, asyncHandler(billingController.checkout));
router.post("/confirm", ...client, asyncHandler(billingController.confirm));

module.exports = router;
