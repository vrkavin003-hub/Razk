const cors = require("cors");
const dotenv = require("dotenv");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const connectDB = require("./config/db");
const { errorHandler, notFound } = require("./middleware/errorMiddleware");
const { connectSql } = require("./sql/db");
const sqlErrorHandler = require("./sql/middleware/error");
const mountSqlApi = require("./sql/mountSqlApi");
const mountLocalDevApi = require("./utils/localDevApi");

dotenv.config();

const app = express();

const allowedClientOrigins = (process.env.CLIENT_URL || "http://localhost:5174")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

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
      if (allowedClientOrigins.includes(origin) || (process.env.NODE_ENV !== "production" && isLocalDevOrigin)) {
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

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "HYA Tech Employee Management System",
    timestamp: new Date().toISOString()
  });
});

const mountMongoApi = () => {
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/employees", require("./routes/employeeRoutes"));
  app.use("/api/attendance", require("./routes/attendanceRoutes"));
  app.use("/api/leave", require("./routes/leaveRoutes"));
  app.use("/api/permission", require("./routes/permissionRoutes"));
  app.use("/api/office-location", require("./routes/officeLocationRoutes"));
  app.use("/api/announcements", require("./routes/announcementRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));
  app.use("/api/reports", require("./routes/reportRoutes"));
  app.use("/api/dashboard", require("./routes/dashboardRoutes"));
};

const startServer = async () => {
  const useSql = process.env.DB_CLIENT === "mysql" || process.env.USE_SQL === "true";

  if (useSql) {
    await connectSql();
    mountSqlApi(app);
  } else {
    try {
      await connectDB();
      mountMongoApi();
    } catch (error) {
      if (process.env.ALLOW_LOCAL_STORE === "false") {
        throw error;
      }

      console.warn("MongoDB is not available. Starting with local development data store.");
      console.warn(error.message);
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
