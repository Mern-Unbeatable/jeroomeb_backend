const checklistService = require("./checklists.service");

async function list(req, res) {
  res.json(await checklistService.list());
}

module.exports = { list };
