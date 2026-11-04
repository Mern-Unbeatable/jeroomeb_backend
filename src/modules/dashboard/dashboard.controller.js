const dashboardService = require("./dashboard.service");

async function overview(req, res) {
  res.json(await dashboardService.overview(req.user));
}

module.exports = { overview };
