const { z } = require("zod");
const { HttpError } = require("../../shared/http");
const userService = require("./users.service");

const roles = [
  "SUPER_ADMIN",
  "TEAM_MEMBER",
  "TENANT_ADMIN",
  "CLIENT",
  "SPECIALIST",
  "AFFILIATE",
];

function userId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "User not found");
  return parsed.data;
}

async function list(req, res) {
  const role = req.query.role;
  if (role && !roles.includes(role)) {
    throw new HttpError(400, "Unknown role");
  }
  res.json(await userService.list(role));
}

async function show(req, res) {
  res.json(await userService.getById(userId(req.params.id)));
}

module.exports = { list, show };
