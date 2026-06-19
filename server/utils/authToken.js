const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../config/authSecret");

const hashDeviceId = (deviceId) =>
  crypto.createHmac("sha256", getJwtSecret()).update(String(deviceId || "")).digest("hex");

const generateToken = (user, deviceId = "") => {
  const payload = {
    id: String(user._id || user.id),
    tokenVersion: Number(user.tokenVersion || 0)
  };

  if (user.role === "employee") {
    if (!deviceId) throw new Error("Approved device is required to create an employee session");
    payload.deviceHash = hashDeviceId(deviceId);
  }

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

const verifyToken = (token) => jwt.verify(token, getJwtSecret());

module.exports = {
  generateToken,
  hashDeviceId,
  verifyToken
};
