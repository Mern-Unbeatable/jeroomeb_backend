const { z } = require("zod");
const { parseBody, HttpError } = require("../../shared/http");
const { updatePriceBandSchema } = require("./price-bands.validation");
const priceBandService = require("./price-bands.service");

function bandId(value) {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new HttpError(404, "Price band not found");
  return parsed.data;
}

async function list(req, res) {
  res.json(await priceBandService.list());
}

async function update(req, res) {
  const input = parseBody(updatePriceBandSchema, req.body);
  res.json(await priceBandService.update(bandId(req.params.id), input, req.user));
}

module.exports = { list, update };
