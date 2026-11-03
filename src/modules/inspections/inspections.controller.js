const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const {
  createInspectionSchema,
  updateInspectionSchema,
  answersSchema,
  resolveSchema,
} = require("./inspections.validation");
const inspectionService = require("./inspections.service");

function inspectionId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Inspection not found");
  return parsed.data;
}

async function options(req, res) {
  res.json(await inspectionService.options());
}

async function list(req, res) {
  const propertyId = req.query.propertyId;
  if (propertyId !== undefined) {
    const parsed = z.uuid().safeParse(propertyId);
    if (!parsed.success) throw new HttpError(400, "Unknown property");
  }
  res.json(await inspectionService.list(req.user, req.query));
}

async function show(req, res) {
  res.json(await inspectionService.getById(inspectionId(req.params.id), req.user));
}

async function create(req, res) {
  const input = parseBody(createInspectionSchema, req.body);
  const result = await inspectionService.create(input, req.user);
  res.status(201).json(result);
}

async function update(req, res) {
  const input = parseBody(updateInspectionSchema, req.body);
  res.json(await inspectionService.update(inspectionId(req.params.id), input, req.user));
}

async function cancel(req, res) {
  res.json(await inspectionService.cancel(inspectionId(req.params.id), req.user));
}

async function saveAnswers(req, res) {
  const input = parseBody(answersSchema, req.body);
  res.json(await inspectionService.saveAnswers(inspectionId(req.params.id), input, req.user));
}

async function resolve(req, res) {
  const input = parseBody(resolveSchema, req.body || {});
  res.json(await inspectionService.resolve(inspectionId(req.params.id), input, req.user));
}

module.exports = { options, list, show, create, update, cancel, saveAnswers, resolve };
