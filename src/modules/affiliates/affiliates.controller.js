const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { applySchema } = require("./affiliates.validation");
const affiliateService = require("./affiliates.service");

function options(req, res) {
  res.json(affiliateService.options());
}

async function apply(req, res) {
  const input = parseBody(applySchema, req.body);
  const result = await affiliateService.apply(input);
  res.status(201).json(result);
}

async function list(req, res) {
  res.json(await affiliateService.list());
}

async function show(req, res) {
  const parsed = z.uuid().safeParse(req.params.id);
  if (!parsed.success) {
    throw new HttpError(404, "Affiliate application not found");
  }
  res.json(await affiliateService.getById(parsed.data));
}

async function remove(req, res) {
  const parsed = z.uuid().safeParse(req.params.id);
  if (!parsed.success) {
    throw new HttpError(404, "Affiliate application not found");
  }
  res.json(await affiliateService.remove(parsed.data));
}

module.exports = { options, apply, list, show, remove };
