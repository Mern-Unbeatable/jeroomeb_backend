const { parseBody } = require("../../shared/http");
const { checkoutSchema, confirmSchema, paymentMethodSchema, changePlanSchema } = require("./billing.validation");
const billingService = require("./billing.service");
const ledgerService = require("./billing-ledger.service");
const subscriptionService = require("./billing-subscription.service");
const { renderInvoicePdf } = require("./invoice-pdf");

async function plans(req, res) {
  res.json(await billingService.plans(req.query.kind));
}

async function checkout(req, res) {
  const input = parseBody(checkoutSchema, req.body);
  const result = await billingService.checkout(req.user, input);
  res.status(201).json(result);
}

async function confirm(req, res) {
  const input = parseBody(confirmSchema, req.body);
  res.json(await billingService.confirm(req.user, input));
}

async function ledger(req, res) {
  res.json(await ledgerService.ledger(req.user));
}

async function invoice(req, res) {
  res.json(await ledgerService.invoiceDetail(req.user, req.params.invoiceId));
}

async function invoicePdf(req, res) {
  const { invoice: record } = await ledgerService.invoiceDetail(req.user, req.params.invoiceId);
  const filename = `${String(record.invoiceNumber || record.id).replace(/[^\w.-]+/g, "_")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  renderInvoicePdf(record, res);
}

async function startPaymentMethod(req, res) {
  const input = parseBody(paymentMethodSchema, req.body || {});
  const result = await ledgerService.startPaymentMethod(req.user, input);
  res.status(201).json(result);
}

async function confirmPaymentMethod(req, res) {
  const input = parseBody(confirmSchema, req.body);
  res.json(await ledgerService.confirmPaymentMethod(req.user, input.sessionId));
}

async function subscription(req, res) {
  res.json(await subscriptionService.present(req.user));
}

async function changePlan(req, res) {
  const input = parseBody(changePlanSchema, req.body);
  res.json(await subscriptionService.changePlan(req.user, input));
}

async function cancelPlan(req, res) {
  res.json(await subscriptionService.cancelPlan(req.user));
}

module.exports = {
  plans,
  checkout,
  confirm,
  ledger,
  invoice,
  invoicePdf,
  startPaymentMethod,
  confirmPaymentMethod,
  subscription,
  changePlan,
  cancelPlan,
};
