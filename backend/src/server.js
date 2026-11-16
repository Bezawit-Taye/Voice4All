/**
 * Voice4All Shared Backend Foundation & Server
 * Phase 1: Core Express setup, Tutor routes, and Router Mounting for Support & Career
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const tutorRoutes = require("./routes/tutor.routes");
const analyticsRoutes = require("./routes/analytics.routes");

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];

if (
  NODE_ENV === "production" &&
  (!configuredOrigins.length || configuredOrigins.includes("*"))
) {
  throw new Error("Production requires explicit CORS_ORIGIN values; wildcards are not allowed.");
}

// 1. CORS Configuration
const allowedOrigins = configuredOrigins.length ? configuredOrigins : ["*"];
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (
        !origin ||
        allowedOrigins.includes("*") ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      const error = new Error("Origin is not allowed by CORS.");
      error.status = 403;
      return callback(error);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  }),
);

// 2. Request Parsing Middleware
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// 3. Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "voice4all-backend",
    version: "1.0.0",
    environment: NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    aiProvider: process.env.AI_PROVIDER || "mock_demo",
    mountedEndpoints: [
      { path: "/api/health", status: "ready" },
      { path: "/api/tutor", status: "ready" },
      { path: "/api/analytics", status: "ready" },
      { path: "/api/support", status: "mounted" },
      { path: "/api/career", status: "mounted" },
    ],
  });
});

// 4. Tutor & Teacher Analytics Routes
app.use("/api/tutor", tutorRoutes);
app.use("/api/analytics", analyticsRoutes);

// 5. Support Router Mounting (Designed for Member 3 integration)
const supportRouteFile = path.join(__dirname, "routes", "support.routes.js");
if (fs.existsSync(supportRouteFile)) {
  try {
    const supportRoutes = require("./routes/support.routes");
    app.use("/api/support", supportRoutes.default || supportRoutes);
    console.log(
      "[Router] Support router successfully loaded from routes/support.routes.js",
    );
  } catch (err) {
    console.error(
      "[Router] Failed to load routes/support.routes.js:",
      err.message,
    );
  }
} else {
  // Graceful mount handler until Member 3 adds support.routes.js
  app.use("/api/support", (req, res) => {
    res.status(501).json({
      status: "pending_member_3",
      message:
        "Support route is mounted at /api/support. Implementation will be attached by Member 3.",
      requestedPath: req.originalUrl,
      method: req.method,
    });
  });
}

// 6. Career Router Mounting (Designed for Member 3 integration)
const careerRouteFile = path.join(__dirname, "routes", "career.routes.js");
if (fs.existsSync(careerRouteFile)) {
  try {
    const careerRoutes = require("./routes/career.routes");
    app.use("/api/career", careerRoutes.default || careerRoutes);
    console.log(
      "[Router] Career router successfully loaded from routes/career.routes.js",
    );
  } catch (err) {
    console.error(
      "[Router] Failed to load routes/career.routes.js:",
      err.message,
    );
  }
} else {
  // Graceful mount handler until Member 3 adds career.routes.js
  app.use("/api/career", (req, res) => {
    res.status(501).json({
      status: "pending_member_3",
      message:
        "Career route is mounted at /api/career. Implementation will be attached by Member 3.",
      requestedPath: req.originalUrl,
      method: req.method,
    });
  });
}

// Serve the frontend without exposing backend source or dependency folders.
app.use((req, res, next) => {
  let requestedPath;
  try {
    requestedPath = decodeURIComponent(req.path).replace(/\\/g, "/");
  } catch (err) {
    return res.sendStatus(400);
  }
  const blockedSegments = new Set(["backend", ".git", "node_modules"]);
  if (
    requestedPath
      .split("/")
      .some((segment) => blockedSegments.has(segment.toLowerCase()))
  ) {
    return res.sendStatus(404);
  }
  next();
});
app.use(express.static(PROJECT_ROOT));

// 7. 404 Route Handler
app.use("*", (req, res) => {
  res.status(404).json({
    status: "error",
    error: `Not Found: ${req.method} ${req.originalUrl}`,
  });
});

// 8. Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("[Server Error]", err.stack || err.message);
  const statusCode = err.status || err.statusCode || 500;
  const publicError =
    NODE_ENV === "production"
      ? statusCode === 400
        ? "Invalid request."
        : statusCode === 403
          ? "Origin is not allowed."
          : statusCode === 413
            ? "Request is too large."
            : "Internal Server Error."
      : err.message || "Internal Server Error";
  res.status(statusCode).json({
    status: "error",
    error: publicError,
  });
});

// Start server if executed directly
if (require.main === module) {
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Voice4All Backend listening on port ${PORT}`);
    console.log(`- Health Check: /api/health`);
    console.log(`- Tutor Ask:    POST /api/tutor/ask`);
    console.log(`- Support API:  /api/support`);
    console.log(`- Career API:   /api/career`);
  });
  server.headersTimeout = 30_000;
  server.requestTimeout = 60_000;
  server.timeout = 185_000;
}

module.exports = app;
