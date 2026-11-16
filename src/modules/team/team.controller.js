const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { createMemberSchema } = require("./team.validation");
const teamService = require("./team.service");

function memberId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Team member not found");
  return parsed.data;
}

function organizationFilter(value) {
  if (value == null || value === "") return undefined;
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(400, "Unknown organization");
  return parsed.data;
}

async function list(req, res) {
  res.json(await teamService.list(organizationFilter(req.query.organizationId)));
}

async function create(req, res) {
  const input = parseBody(createMemberSchema, req.body);
  res.status(201).json(await teamService.create(input, req.user));
}

async function makeAdmin(req, res) {
  res.json(await teamService.changeRole(memberId(req.params.id), "TENANT_ADMIN", req.user));
}

async function makeSpecialist(req, res) {
  res.json(await teamService.changeRole(memberId(req.params.id), "SPECIALIST", req.user));
}

async function deactivate(req, res) {
  res.json(await teamService.deactivate(memberId(req.params.id), req.user));
}

async function remove(req, res) {
  res.json(await teamService.remove(memberId(req.params.id), req.user));
}

module.exports = { list, create, makeAdmin, makeSpecialist, deactivate, remove };
