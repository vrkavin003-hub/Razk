const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is missing. Set it in the backend environment before using authentication.");
    error.statusCode = 500;
    throw error;
  }
  return process.env.JWT_SECRET;
};

const generateToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), {
    expiresIn: "7d"
  });

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    token: generateToken(user._id)
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

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
    res.status(401);
    throw new Error("Invalid email or password");
  }

  res.json({
    user: sanitizeUser(user),
    token: generateToken(user._id)
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
