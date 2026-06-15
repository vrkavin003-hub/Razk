const crypto = require("crypto");

const FALLBACK_SECRET_SALT = "razk-automation-hrms-fallback-secret";

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const stableSource =
    process.env.JWT_REFRESH_SECRET ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_EXTERNAL_HOSTNAME ||
    process.env.MONGO_URI ||
    FALLBACK_SECRET_SALT;

  return crypto.createHash("sha256").update(`${FALLBACK_SECRET_SALT}:${stableSource}`).digest("hex");
};

module.exports = {
  getJwtSecret
};
