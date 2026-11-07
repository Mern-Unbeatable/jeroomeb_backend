const env = require("../config/env");

function allowedOrigins() {
  return new Set([
    "https://jeroomeb.maktechgroup.tech",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    ...env.CORS_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ]);
}

module.exports = { allowedOrigins };
