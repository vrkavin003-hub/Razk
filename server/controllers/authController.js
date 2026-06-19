const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const { generateToken } = require("../utils/authToken");
const { normalizeDeviceId, normalizeDeviceName } = require("../utils/deviceApproval");
const { logInfo, logWarn } = require("../utils/structuredLogger");
const User = require("../models/User");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const loginSubject = (value) =>
  crypto.createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex").slice(0, 16);
const bumpTokenVersion = (user) => {
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId,
  department: user.department,
  designation: user.designation,
  assignedShift: user.assignedShift,
  phone: user.phone,
  joiningDate: user.joiningDate,
  address: user.address,
  emergencyContact: user.emergencyContact,
  profilePhoto: user.profilePhoto,
  registeredDeviceName: user.registeredDeviceName,
  deviceRegisteredAt: user.deviceRegisteredAt,
  deviceApprovalStatus: user.deviceApprovalStatus,
  pendingDeviceName: user.pendingDeviceName,
  deviceRequestedAt: user.deviceRequestedAt,
  deviceApprovedAt: user.deviceApprovedAt,
  deviceRejectedAt: user.deviceRejectedAt,
  deviceResetAt: user.deviceResetAt,
  isActive: user.isActive
});

const register = asyncHandler(async (req, res) => {
  const payload = req.body;

  if (!payload.name || !payload.email || !payload.password) {
    res.status(400);
    throw new Error("Name, email, and password are required");
  }

  const user = await User.create(payload);

  res.status(201).json({
    user: sanitizeUser(user),
    token: user.role === "employee" ? undefined : generateToken(user)
  });
});

const login = asyncHandler(async (req, res) => {
  const { deviceId, deviceName, email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Email/Login ID and password are required");
  }

  const loginId = String(email).trim();
  const user = await User.findOne({
    $or: [
      { email: loginId.toLowerCase() },
      { employeeId: loginId },
      { employeeId: { $regex: `^${escapeRegex(loginId)}$`, $options: "i" } }
    ]
  }).select("+password");

  if (!user || !user.isActive || !(await user.matchPassword(password))) {
    logWarn("login_failed", {
      loginSubject: loginSubject(loginId),
      reason: "invalid_credentials"
    });
    res.status(401);
    throw new Error("Invalid email or password");
  }

  if (user.role === "employee") {
    if (!user.employeeId) {
      logWarn("login_failed", { reason: "missing_employee_id", userId: String(user._id) });
      res.status(403);
      throw new Error("Employee ID is not configured for this account. Please contact HR.");
    }
    if (loginId.toLowerCase() !== String(user.employeeId).toLowerCase()) {
      logWarn("login_failed", { reason: "employee_email_login_blocked", userId: String(user._id) });
      res.status(400);
      throw new Error("Employees must login using their Employee ID");
    }
    const normalizedDeviceId = normalizeDeviceId(deviceId);
    const normalizedDeviceName = normalizeDeviceName(deviceName);
    if (!normalizedDeviceId) {
      logWarn("login_failed", { reason: "missing_device_id", userId: String(user._id) });
      res.status(400);
      throw new Error("A valid device ID is required for employee login");
    }

    if (user.registeredDeviceId === normalizedDeviceId) {
      if (user.deviceApprovalStatus !== "approved") {
        user.deviceApprovalStatus = "approved";
        user.deviceApprovedAt = user.deviceApprovedAt || user.deviceRegisteredAt || new Date();
        bumpTokenVersion(user);
        await user.save();
      }
    } else if (user.registeredDeviceId) {
      logWarn("login_failed", { reason: "different_device", userId: String(user._id) });
      res.status(403);
      throw new Error("This employee account is registered to another device. Please contact HR.");
    } else {
      if (user.deviceApprovalStatus === "rejected") {
        logWarn("login_failed", { reason: "device_rejected", userId: String(user._id) });
        res.status(403);
        throw new Error("Your device approval request was rejected by HR. Please contact HR.");
      }
      if (user.deviceApprovalStatus === "pending" && user.pendingDeviceId && user.pendingDeviceId !== normalizedDeviceId) {
        res.status(403);
        throw new Error("A device approval request is already pending for this employee. Please contact HR.");
      }
      if (user.deviceApprovalStatus === "pending" && user.pendingDeviceId === normalizedDeviceId) {
        res.status(202).json({
          requiresDeviceApproval: true,
          message: "Your device approval request is pending with HR. You can login after HR approves this device."
        });
        return;
      }
      user.pendingDeviceId = normalizedDeviceId;
      user.pendingDeviceName = normalizedDeviceName;
      user.deviceRequestedAt = new Date();
      user.deviceApprovalStatus = "pending";
      user.deviceRejectedAt = undefined;
      user.deviceRejectedBy = undefined;
      await user.save();
      logInfo("device_approval_requested", { userId: String(user._id) });
      res.status(202).json({
        requiresDeviceApproval: true,
        message: "Your device approval request has been sent to HR. You can login after HR approves this device."
      });
      return;
    }
  }

  logInfo("login_succeeded", { role: user.role, userId: String(user._id) });
  res.json({
    user: sanitizeUser(user),
    token: generateToken(user, user.role === "employee" ? String(deviceId).trim() : "")
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email: String(email || "").toLowerCase() });
  const clientOrigin = process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || "http://localhost:5174";

  if (!user) {
    res.json({ message: "If that email exists, a reset token has been generated." });
    return;
  }

  const resetToken = crypto.randomBytes(24).toString("hex");
  user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  user.resetPasswordExpires = Date.now() + 1000 * 60 * 30;
  await user.save();

  res.json({
    message: "Password reset token generated.",
    resetToken,
    resetUrl: `${clientOrigin}/reset-password?token=${resetToken}`
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    res.status(400);
    throw new Error("Reset token and new password are required");
  }

  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() }
  }).select("+password");

  if (!user) {
    res.status(400);
    throw new Error("Reset token is invalid or expired");
  }

  user.password = password;
  bumpTokenVersion(user);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  res.json({ message: "Password reset successful" });
});

const me = asyncHandler(async (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

const changePassword = asyncHandler(async (req, res) => {
  const { confirmNewPassword, currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmNewPassword) {
    res.status(400);
    throw new Error("Current password, new password, and confirm password are required");
  }

  if (newPassword !== confirmNewPassword) {
    res.status(400);
    throw new Error("New password and confirm password do not match");
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!user || !(await user.matchPassword(currentPassword))) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }

  user.password = newPassword;
  bumpTokenVersion(user);
  await user.save();

  res.json({ message: "Password changed successfully" });
});

module.exports = {
  changePassword,
  forgotPassword,
  login,
  me,
  register,
  resetPassword
};
