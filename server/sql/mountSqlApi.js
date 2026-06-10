const path = require("path");
const express = require("express");

const mountSqlApi = (app) => {
  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
  app.use("/api/auth", require("./routes/authRoutes"));
  app.use("/api/attendance", require("./routes/attendanceRoutes"));
  app.use("/api/office-location", require("./routes/officeLocationRoutes"));
  app.use("/api/contact", require("./routes/contactRoutes"));
  app.use("/api/careers", require("./routes/careerRoutes"));
  app.use("/api/admin", require("./routes/adminRoutes"));
  app.use("/api/announcements", require("./routes/announcementRoutes"));
  app.use("/api/notifications", require("./routes/notificationRoutes"));
  app.use("/api/reports", require("./routes/reportRoutes"));
};

module.exports = mountSqlApi;
