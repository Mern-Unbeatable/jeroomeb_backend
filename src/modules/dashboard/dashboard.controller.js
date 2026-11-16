const dashboardService = require("./dashboard.service");
const dashboardAdminService = require("./dashboard-admin.service");

async function overview(req, res) {
  res.json(await dashboardService.overview(req.user));
}

async function adminOverview(req, res) {
  res.json(await dashboardAdminService.overview());
}

module.exports = { overview, adminOverview };
