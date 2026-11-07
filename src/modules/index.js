const authRoutes = require("./auth/auth.routes");
const usersRoutes = require("./users/users.routes");
const organizationsRoutes = require("./organizations/organizations.routes");
const propertiesRoutes = require("./properties/properties.routes");
const serviceRequestsRoutes = require("./service-requests/service-requests.routes");
const checklistsRoutes = require("./checklists/checklists.routes");
const inspectionsRoutes = require("./inspections/inspections.routes");
const reportsRoutes = require("./reports/reports.routes");
const payoutsRoutes = require("./payouts/payouts.routes");
const specialistsRoutes = require("./specialists/specialists.routes");
const affiliatesRoutes = require("./affiliates/affiliates.routes");
const teamRoutes = require("./team/team.routes");
const settingsRoutes = require("./settings/settings.routes");
const contactRoutes = require("./contact/contact.routes");
const analyticsRoutes = require("./analytics/analytics.routes");
const activityRoutes = require("./activity/activity.routes");
const billingRoutes = require("./billing/billing.routes");
const priceBandRoutes = require("./price-bands/price-bands.routes");
const dashboardRoutes = require("./dashboard/dashboard.routes");
const addOnRoutes = require("./add-on-services/add-on-services.routes");
const chatRoutes = require("./chats/chats.routes");
const accessKeyRoutes = require("./access-keys/access-keys.routes");

function registerModules(app) {
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/users", usersRoutes);
  app.use("/api/v1/organizations", organizationsRoutes);
  app.use("/api/v1/properties", propertiesRoutes);
  app.use("/api/v1/service-requests", serviceRequestsRoutes);
  app.use("/api/v1/checklists", checklistsRoutes);
  app.use("/api/v1/inspections", inspectionsRoutes);
  app.use("/api/v1/reports", reportsRoutes);
  app.use("/api/v1/payouts", payoutsRoutes);
  app.use("/api/v1/specialists", specialistsRoutes);
  app.use("/api/v1/affiliates", affiliatesRoutes);
  app.use("/api/v1/team", teamRoutes);
  app.use("/api/v1/settings", settingsRoutes);
  app.use("/api/v1/contact", contactRoutes);
  app.use("/api/v1/analytics", analyticsRoutes);
  app.use("/api/v1/activity", activityRoutes);
  app.use("/api/v1/billing", billingRoutes);
  app.use("/api/v1/price-bands", priceBandRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/add-on-services", addOnRoutes);
  app.use("/api/v1/chats", chatRoutes);
  app.use("/api/v1/access-keys", accessKeyRoutes);
}

module.exports = { registerModules };
