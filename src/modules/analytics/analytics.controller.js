const analyticsService = require("./analytics.service");

async function show(req, res) {
  res.json(await analyticsService.report());
}

async function exportAnalytics(req, res) {
  const data = await analyticsService.report();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="analytics.csv"');
  res.send(analyticsService.toCsv(data));
}

module.exports = { show, exportAnalytics };
