const { parseBody } = require("../../shared/http");
const { createAccessKeySchema, updateAccessKeySchema } = require("./access-keys.validation");
const accessKeyService = require("./access-keys.service");

async function list(req, res) {
  res.json(await accessKeyService.list(req.user));
}

async function show(req, res) {
  res.json(await accessKeyService.getById(req.params.id, req.user));
}

async function create(req, res) {
  const input = parseBody(createAccessKeySchema, req.body);
  const result = await accessKeyService.create(req.user, input);
  res.status(201).json(result);
}

async function update(req, res) {
  const input = parseBody(updateAccessKeySchema, req.body);
  res.json(await accessKeyService.update(req.params.id, req.user, input));
}

module.exports = { list, show, create, update };
