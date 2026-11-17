const { parseBody } = require("../../shared/http");
const { feedbackSchema } = require("./specialist-feedback.validation");
const feedbackService = require("./specialist-feedback.service");

async function list(req, res) {
  res.json(await feedbackService.list(req.user));
}

async function create(req, res) {
  const input = parseBody(feedbackSchema, req.body);
  res.status(201).json(await feedbackService.create(req.user, input));
}

module.exports = { list, create };
