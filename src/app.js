const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const env = require("./config/env");
const { registerModules } = require("./modules");

const allowedOrigins = new Set(
  env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/", (req, res) => {
    res.json({ ok: true, message: "API is running properly" });
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true, message: "Server is running" });
  });

  registerModules(app);

  app.use((req, res) => {
    res.status(404).json({ message: "Not found" });
  });

  app.use((error, req, res, next) => {
    const status = error.status || 500;
    if (status >= 500) {
      console.error(error);
    }
    const body = {
      message: status >= 500 ? "Internal server error" : error.message,
    };
    if (error.details) {
      body.errors = error.details;
    }
    res.status(status).json(body);
  });

  return app;
}

module.exports = { createApp };
