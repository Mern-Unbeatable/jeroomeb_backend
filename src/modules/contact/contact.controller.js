const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { createContactSchema } = require("./contact.validation");
const contactService = require("./contact.service");

async function create(req, res) {
  const input = parseBody(createContactSchema, req.body);
  const result = await contactService.create(input);
  res.status(201).json(result);
}

async function list(req, res) {
  res.json(await contactService.list());
}

async function remove(req, res) {
  const parsed = z.uuid().safeParse(req.params.id);
  if (!parsed.success) {
    throw new HttpError(404, "Contact message not found");
  }
  const result = await contactService.remove(parsed.data);
  res.json(result);
}

module.exports = { create, list, remove };
