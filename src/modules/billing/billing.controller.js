const { parseBody } = require("../../shared/http");
const { checkoutSchema, confirmSchema } = require("./billing.validation");
const billingService = require("./billing.service");

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

module.exports = { plans, checkout, confirm };
