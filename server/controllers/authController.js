const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d"
  });

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId,
  department: user.department,
  designation: user.designation,
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
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

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
    resetUrl: `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${resetToken}`
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

module.exports = {
  forgotPassword,
  login,
  me,
  register,
  resetPassword
};
