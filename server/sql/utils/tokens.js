const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const accessTokenTtl = process.env.JWT_EXPIRES_IN || "15m";
const refreshDays = Number(process.env.REFRESH_TOKEN_DAYS || 30);

const jwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");
  return process.env.JWT_SECRET;
};

const signAccessToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    jwtSecret(),
    { expiresIn: accessTokenTtl }
  );

const generateOpaqueToken = () => crypto.randomBytes(48).toString("hex");

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const refreshExpiry = () => {
  const expires = new Date();
  expires.setDate(expires.getDate() + refreshDays);
  return expires;
};

module.exports = {
  generateOpaqueToken,
  hashToken,
  refreshExpiry,
  signAccessToken
};
