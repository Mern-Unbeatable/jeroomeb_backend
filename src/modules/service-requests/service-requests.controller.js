const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const {
  createServiceRequestSchema,
  requestAddOnSchema,
  confirmAddOnSchema,
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

async function requestAddOn(req, res) {
  const input = parseBody(requestAddOnSchema, req.body);
  const result = await serviceRequestService.requestAddOn(req.user, input.addOnServiceId);
  res.status(201).json(result);
}

async function confirmAddOn(req, res) {
  const input = parseBody(confirmAddOnSchema, req.body);
  res.json(await serviceRequestService.confirmAddOn(req.user, input.sessionId));
}

async function list(req, res) {
  res.json(await serviceRequestService.list(req.query.status, req.user));
}

async function show(req, res) {
  res.json(await serviceRequestService.getById(requestId(req.params.id), req.user));
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

module.exports = {
  options,
  create,
  requestAddOn,
  confirmAddOn,
  list,
  show,
  updateStatus,
  remove,
};
