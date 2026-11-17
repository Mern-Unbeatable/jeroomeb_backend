const { z } = require("zod");
const { HttpError, parseBody } = require("../../shared/http");
const { requestPayoutSchema } = require("./payouts.validation");
const payoutService = require("./payouts.service");

function payoutId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Payout not found");
  return parsed.data;
}

async function list(req, res) {
  res.json(await payoutService.list(req.user, req.query));
}

async function show(req, res) {
  res.json(await payoutService.getById(payoutId(req.params.id), req.user));
}

async function requestPayout(req, res) {
  const input = parseBody(requestPayoutSchema, req.body);
  res.status(201).json(await payoutService.requestPayout(req.user, input));
}

async function approve(req, res) {
  res.json(await payoutService.approve(payoutId(req.params.id), req.user));
}

async function markPaid(req, res) {
  res.json(await payoutService.markPaid(payoutId(req.params.id), req.user));
}

module.exports = { list, show, requestPayout, approve, markPaid };
