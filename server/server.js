const dotenv = require("dotenv");
dotenv.config();

const cors = require("cors");
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const {
  getEnvironmentStatus,
  isAllowedClientOrigin,
  getStartupConfig,
  validateStartupConfiguration
} = require("./config/runtime");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const { connectSql } = require("./sql/db");
const sqlErrorHandler = require("./sql/middleware/error");
const mountSqlApi = require("./sql/mountSqlApi");
const mountLocalDevApi = require("./utils/localDevApi");
const { ensureDefaultAdmin } = require("./utils/defaultAdmin");
const ensureMongoIndexes = require("./utils/mongoIndexes");
const {
  generalApiLimiter,
  loginLimiter,
  passwordResetLimiter,
  uploadLimiter
} = require("./middleware/rateLimits");
const {
  initializeMonitoring,
  isMonitoringEnabled,
  setupMonitoringErrorHandler
} = require("./utils/monitoring");
const { useCloudStorage } = require("./utils/uploadStorage");

initializeMonitoring();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));

const startupConfig = getStartupConfig();

const logStartupStatus = () => {
  const status = getEnvironmentStatus();
  console.log(
    "Startup configuration:",
    JSON.stringify({
      databaseMode: startupConfig.databaseMode,
      environment: process.env.NODE_ENV || "development",
      hasClientOrigin: status.CLIENT_ORIGIN,
      hasJwtSecret: status.JWT_SECRET,
      hasMongoUri: status.MONGO_URI,
      localStoreAllowed: startupConfig.allowLocalStore,
      port: startupConfig.port,
      renderServiceId: process.env.RENDER_SERVICE_ID || "",
      renderHostname: process.env.RENDER_EXTERNAL_HOSTNAME || ""
    })
  );
};

const runtimeState = {
  database: {
    mode: "unknown",
    status: "starting",
    message: "Server is starting"
  }
};

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      if (
        isAllowedClientOrigin(origin, startupConfig) ||
        (process.env.NODE_ENV !== "production" && isLocalDevOrigin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  express.static(process.env.UPLOAD_ROOT ? path.resolve(process.env.UPLOAD_ROOT) : path.join(__dirname, "uploads"))
);

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  const mongoReadyState = mongoose.connection.readyState;
  const mongoStatus = ["disconnected", "connected", "connecting", "disconnecting"][mongoReadyState] || "unknown";
  const databaseReady =
    runtimeState.database.mode === "local-json" ||
    runtimeState.database.status === "connected";

  res.json({
    status: databaseReady ? "ok" : "degraded",
    app: "Razk Automation Employee Management System",
    server: {
      status: "running",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.round(process.uptime())
    },
    database: {
      mode: runtimeState.database.mode,
      ready: databaseReady,
      status: runtimeState.database.status,
      mongoose: mongoStatus
    },
    environment: {
      configured: getEnvironmentStatus(),
      clientOrigins: startupConfig.allowedClientOrigins,
      databaseMode: startupConfig.databaseMode,
      localStoreAllowed: startupConfig.allowLocalStore,
      mobileWebViewOrigins: startupConfig.mobileWebViewOrigins
    },
    services: {
      attendanceImageStorage: useCloudStorage() ? "cloudinary" : "local-development",
      monitoring: isMonitoringEnabled() ? "sentry" : "disabled"
    },
    timestamp: new Date().toISOString()
  });
});

app.use("/api/auth/login", loginLimiter);
app.use("/api/auth/forgot-password", passwordResetLimiter);
app.use("/api/auth/reset-password", passwordResetLimiter);
app.use("/api/uploads", uploadLimiter);
app.use("/api", generalApiLimiter);

const mountMongoApi = () => {
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/uploads", require("./routes/uploadRoutes"));
  app.use("/api/employees", require("./routes/employeeRoutes"));
  app.use("/api/attendance", require("./routes/attendanceRoutes"));
  app.use("/api/leave", require("./routes/leaveRoutes"));
  app.use("/api/permission", require("./routes/permissionRoutes"));
  app.use("/api/od", require("./routes/odRoutes"));
  app.use("/api/visitors", require("./routes/visitorRoutes"));
  app.use("/api/office-location", require("./routes/officeLocationRoutes"));
  app.use("/api/announcements", require("./routes/announcementRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));
  app.use("/api/reports", require("./routes/reportRoutes"));
  app.use("/api/dashboard", require("./routes/dashboardRoutes"));
};

const startServer = async () => {
  logStartupStatus();
  validateStartupConfiguration(startupConfig);

  const allowLocalStore = startupConfig.allowLocalStore && !startupConfig.isProduction;

  if (startupConfig.useSql) {
    runtimeState.database = {
      mode: startupConfig.databaseMode,
      status: "connecting",
      message: `Connecting to ${startupConfig.databaseMode === "sqlserver" ? "SQL Server" : "MySQL"}`
    };
    await connectSql();
    runtimeState.database = {
      mode: startupConfig.databaseMode,
      status: "connected",
      message: `${startupConfig.databaseMode === "sqlserver" ? "SQL Server" : "MySQL"} connection is active`
    };
    mountSqlApi(app);
  } else {
    try {
      runtimeState.database = { mode: "mongodb", status: "connecting", message: "Connecting to MongoDB" };
      await connectDB();
      runtimeState.database = { mode: "mongodb", status: "connected", message: "MongoDB connection is active" };
      await ensureMongoIndexes();
      if (await ensureDefaultAdmin()) {
        console.warn("Default admin account was created. Change its password immediately.");
      }
      mountMongoApi();
    } catch (error) {
      if (!allowLocalStore) {
        runtimeState.database = { mode: "mongodb", status: "error", message: error.message };
        throw error;
      }

      console.warn("MongoDB is not available. Starting with local development data store.");
      console.warn(error.message);
      runtimeState.database = {
        mode: "local-json",
        status: "fallback",
        message: "MongoDB unavailable; local development data store is active"
      };
      mountLocalDevApi(app);
    }
  }

  app.use(notFound);
  setupMonitoringErrorHandler(app);
  app.use(startupConfig.useSql ? sqlErrorHandler : errorHandler);

  const port = startupConfig.port;
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`Razk Automation HRMS API running on port ${port}`);
  });

  server.on("error", (error) => {
    console.error("HTTP server failed to start:", error.stack || error.message || error);
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down Razk Automation HRMS API...`);
    server.close(() => process.exit(0));
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error.stack || error.message || error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason && reason.stack ? reason.stack : reason);
  process.exit(1);
});

startServer().catch((error) => {
  console.error("Fatal startup error:", error.stack || error.message || error);
  process.exit(1);
});
