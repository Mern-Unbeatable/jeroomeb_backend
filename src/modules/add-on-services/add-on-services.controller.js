const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { createAddOnSchema, updateAddOnSchema } = require("./add-on-services.validation");
const addOnService = require("./add-on-services.service");

function addOnId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Add-on not found");
  return parsed.data;
}

async function list(req, res) {
  res.json(await addOnService.list(req.user));
}

// Create a new add-on service
async function create(req, res) {
  const input = parseBody(createAddOnSchema, req.body);
  const result = await addOnService.create(input, req.user);
  res.status(201).json(result);
}

async function update(req, res) {
  const input = parseBody(updateAddOnSchema, req.body);
  res.json(await addOnService.update(addOnId(req.params.id), input, req.user));
}

async function remove(req, res) {
  res.json(await addOnService.remove(addOnId(req.params.id), req.user));
}

module.exports = { list, create, update, remove };
