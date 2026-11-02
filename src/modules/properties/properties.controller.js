const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const {
  createPropertySchema,
  updatePropertySchema,
  rosterSchema,
} = require("./properties.validation");
const propertyService = require("./properties.service");

function propertyId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Property not found");
  return parsed.data;
}

async function list(req, res) {
  res.json(await propertyService.list());
}

async function show(req, res) {
  res.json(await propertyService.getById(propertyId(req.params.id)));
}

async function create(req, res) {
  const input = parseBody(createPropertySchema, req.body);
  const result = await propertyService.create(input, req.user);
  res.status(201).json(result);
}

async function update(req, res) {
  const input = parseBody(updatePropertySchema, req.body);
  const result = await propertyService.update(propertyId(req.params.id), input, req.user);
  res.json(result);
}

async function remove(req, res) {
  res.json(await propertyService.remove(propertyId(req.params.id)));
}

async function assignRoster(req, res) {
  const input = parseBody(rosterSchema, req.body);
  const result = await propertyService.assignRoster(propertyId(req.params.id), input, req.user);
  res.status(201).json(result);
}

async function removeRoster(req, res) {
  const roster = z.uuid().safeParse(req.params.rosterId);
  if (!roster.success) throw new HttpError(404, "Roster assignment not found");
  res.json(
    await propertyService.removeRoster(propertyId(req.params.id), roster.data, req.user)
  );
}

module.exports = { list, show, create, update, remove, assignRoster, removeRoster };
