const asyncHandler = require("../utils/asyncHandler");
const { hashDeviceId, verifyToken } = require("../utils/authToken");
const { normalizeDeviceId } = require("../utils/deviceApproval");
const { logWarn } = require("../utils/structuredLogger");
const User = require("../models/User");

const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401);
    throw new Error("Not authorized, token missing");
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch {
    res.status(401);
    throw new Error("Not authorized, token invalid");
  }

  const user = await User.findById(decoded.id).select("-password");
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("Not authorized, user inactive or missing");
  }

  if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
    logWarn("auth_token_version_rejected", { userId: String(user._id) });
    res.status(401);
    throw new Error("Your session has expired. Please login again.");
  }

  if (user.role === "employee") {
    const deviceId = normalizeDeviceId(req.get("x-device-id"));
    const requestDeviceHash = deviceId ? hashDeviceId(deviceId) : "";
    const approvedDeviceHash = user.registeredDeviceId ? hashDeviceId(user.registeredDeviceId) : "";
    if (
      !deviceId ||
      user.deviceApprovalStatus !== "approved" ||
      !approvedDeviceHash ||
      decoded.deviceHash !== requestDeviceHash ||
      approvedDeviceHash !== requestDeviceHash
    ) {
      logWarn("auth_device_rejected", { userId: String(user._id) });
      res.status(401);
      throw new Error("This employee session is not valid for the approved device.");
    }
  }

  req.user = user;
  next();
});

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    throw new Error("Forbidden: insufficient role permissions");
  }
  next();
};

module.exports = { authorize, protect };
