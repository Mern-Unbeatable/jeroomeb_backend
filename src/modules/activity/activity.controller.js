const activityService = require("./activity.service");

async function list(req, res) {
  res.json({ activity: await activityService.list(50) });
}

module.exports = { list };
