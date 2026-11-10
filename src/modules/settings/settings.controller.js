const { parseBody } = require("../../shared/http");
const { fullServiceSchema, softwareSchema } = require("./settings.validation");
const settingsService = require("./settings.service");

async function pricing(req, res) {
  res.json(await settingsService.pricing());
}

async function saveFullService(req, res) {
  const input = parseBody(fullServiceSchema, req.body);
  res.json(await settingsService.saveFullService(input, req.user));
}

async function restoreFullService(req, res) {
  res.json(await settingsService.restoreFullService(req.user));
}

async function saveSoftware(req, res) {
  const input = parseBody(softwareSchema, req.body);
  res.json(await settingsService.saveSoftware(input, req.user));
}

module.exports = { pricing, saveFullService, restoreFullService, saveSoftware };
