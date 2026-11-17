const { parseBody } = require("../../shared/http");
const { createChecklistSchema } = require("./checklists.validation");
const checklistService = require("./checklists.service");

async function list(req, res) {
  res.json(await checklistService.list());
}

async function create(req, res) {
  const input = parseBody(createChecklistSchema, req.body);
  res.status(201).json(await checklistService.create(input, req.user));
}

module.exports = { list, create };
