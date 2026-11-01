const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const {
  createServiceRequestSchema,
  updateStatusSchema,
} = require("./service-requests.validation");
const serviceRequestService = require("./service-requests.service");

function requestId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Service request not found");
  return parsed.data;
}

async function options(req, res) {
  res.json(await serviceRequestService.listOptions());
}

async function create(req, res) {
  const input = parseBody(createServiceRequestSchema, req.body);
  const result = await serviceRequestService.create(input, req.user || null);
  res.status(201).json(result);
}

async function list(req, res) {
  res.json(await serviceRequestService.list(req.query.status));
}

async function show(req, res) {
  res.json(await serviceRequestService.getById(requestId(req.params.id)));
}

async function updateStatus(req, res) {
  const input = parseBody(updateStatusSchema, req.body);
  const result = await serviceRequestService.updateStatus(
    requestId(req.params.id),
    input.status,
    req.user
  );
  res.json(result);
}

async function remove(req, res) {
  res.json(await serviceRequestService.remove(requestId(req.params.id), req.user));
}

module.exports = { options, create, list, show, updateStatus, remove };
