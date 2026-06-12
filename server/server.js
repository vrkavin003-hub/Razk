const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const path = require("path");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const { connectSql } = require("./sql/db");
const sqlErrorHandler = require("./sql/middleware/error");
const mountSqlApi = require("./sql/mountSqlApi");
const mountLocalDevApi = require("./utils/localDevApi");

dotenv.config();

const app = express();

const configuredClientOrigins = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "http://localhost:5174";
const allowedClientOrigins = configuredClientOrigins
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const mobileWebViewOrigins = ["capacitor://localhost", "ionic://localhost", "https://localhost"];
const runtimeState = {
  database: {
    mode: "unknown",
    status: "starting",
    message: "Server is starting"
  }
};

const requiredEnv = ["MONGO_URI", "JWT_SECRET", "JWT_REFRESH_SECRET", "PORT", "CLIENT_ORIGIN"];
const envStatus = () =>
  requiredEnv.reduce((status, key) => {
    status[key] = Boolean(process.env[key] || (key === "CLIENT_ORIGIN" && process.env.CLIENT_URL));
    return status;
  }, {});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false
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
        allowedClientOrigins.includes(origin) ||
        mobileWebViewOrigins.includes(origin) ||
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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  const mongoReadyState = mongoose.connection.readyState;
  const mongoStatus = ["disconnected", "connected", "connecting", "disconnecting"][mongoReadyState] || "unknown";

  res.json({
    status: "ok",
    app: "HYA Tech Employee Management System",
    server: {
      status: "running",
      environment: process.env.NODE_ENV || "development",
      uptimeSeconds: Math.round(process.uptime())
    },
    database: {
      ...runtimeState.database,
      mongoose: mongoStatus
    },
    environment: {
      configured: envStatus(),
      clientOrigins: allowedClientOrigins,
      mobileWebViewOrigins
    },
    timestamp: new Date().toISOString()
  });
});

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
  const useSql = process.env.DB_CLIENT === "mysql" || process.env.USE_SQL === "true";

  if (useSql) {
    runtimeState.database = { mode: "mysql", status: "connecting", message: "Connecting to MySQL" };
    await connectSql();
    runtimeState.database = { mode: "mysql", status: "connected", message: "MySQL connection is active" };
    mountSqlApi(app);
  } else {
    try {
      runtimeState.database = { mode: "mongodb", status: "connecting", message: "Connecting to MongoDB" };
      await connectDB();
      runtimeState.database = { mode: "mongodb", status: "connected", message: "MongoDB connection is active" };
      mountMongoApi();
    } catch (error) {
      if (process.env.ALLOW_LOCAL_STORE !== "true") {
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
  app.use(useSql ? sqlErrorHandler : errorHandler);

  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    console.log(`HYA Tech HRMS API running on port ${port}`);
  });
};

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
