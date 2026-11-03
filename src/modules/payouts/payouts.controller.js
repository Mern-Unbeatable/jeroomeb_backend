const { z } = require("zod");
const { HttpError } = require("../../shared/http");
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

module.exports = { list, show };
