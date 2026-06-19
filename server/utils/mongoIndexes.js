const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { logInfo } = require("./structuredLogger");

const ensureMongoIndexes = async () => {
  if (String(process.env.MONGO_CREATE_INDEXES || "true").toLowerCase() === "false") return;
  await Promise.all([Attendance.createIndexes(), User.createIndexes()]);
  logInfo("mongodb_indexes_ready", {
    models: ["Attendance", "User"]
  });
};

module.exports = ensureMongoIndexes;
