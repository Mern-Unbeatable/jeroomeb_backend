const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { applySchema } = require("./specialists.validation");
const specialistService = require("./specialists.service");

function options(req, res) {
  res.json(specialistService.options());
}

async function apply(req, res) {
  const input = parseBody(applySchema, req.body);
  const result = await specialistService.apply(input);
  res.status(201).json(result);
}

async function list(req, res) {
  res.json(await specialistService.list());
}

function applicationId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) {
    throw new HttpError(404, "Specialist application not found");
  }
  return parsed.data;
}

async function show(req, res) {
  res.json(await specialistService.getById(applicationId(req.params.id)));
}

async function remove(req, res) {
  res.json(await specialistService.remove(applicationId(req.params.id)));
}

module.exports = { options, apply, list, show, remove };
