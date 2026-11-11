const inspectorService = require("./supabase-inspectors.service");

async function list(req, res) {
  res.json(await inspectorService.listInspectors());
}

async function show(req, res) {
  res.json(await inspectorService.getInspector(req.params.id));
}

module.exports = { list, show };
