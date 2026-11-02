const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { provisionTenantSchema } = require("./organizations.validation");
const organizationService = require("./organizations.service");

function tenantId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Tenant not found");
  return parsed.data;
}

async function list(req, res) {
  res.json(await organizationService.list());
}

async function show(req, res) {
  res.json(await organizationService.getById(tenantId(req.params.id)));
}

async function provision(req, res) {
  const input = parseBody(provisionTenantSchema, req.body);
  const result = await organizationService.provision(input, req.user);
  res.status(201).json(result);
}

module.exports = { list, show, provision };
