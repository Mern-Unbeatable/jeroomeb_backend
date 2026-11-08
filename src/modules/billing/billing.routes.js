const express = require("express");
const { asyncHandler } = require("../../shared/http");
const { requireAuth, requireRole } = require("../../shared/auth");
const billingController = require("./billing.controller");

const router = express.Router();
const client = [requireAuth, requireRole("CLIENT", "TENANT_ADMIN")];

router.get("/plans", asyncHandler(billingController.plans));
router.post("/checkout", ...client, asyncHandler(billingController.checkout));
router.post("/confirm", ...client, asyncHandler(billingController.confirm));
router.get("/subscription", ...client, asyncHandler(billingController.subscription));
router.post("/subscription/cancel", ...client, asyncHandler(billingController.cancelPlan));
router.post("/subscription", ...client, asyncHandler(billingController.changePlan));
router.get("/ledger", ...client, asyncHandler(billingController.ledger));
router.get("/invoices/:invoiceId/pdf", ...client, asyncHandler(billingController.invoicePdf));
router.get("/invoices/:invoiceId", ...client, asyncHandler(billingController.invoice));
router.post("/payment-method", ...client, asyncHandler(billingController.startPaymentMethod));
router.post("/payment-method/confirm", ...client, asyncHandler(billingController.confirmPaymentMethod));

module.exports = router;
