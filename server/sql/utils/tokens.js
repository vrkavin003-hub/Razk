const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../../config/authSecret");

const accessTokenTtl = process.env.JWT_EXPIRES_IN || "15m";
const refreshDays = Number(process.env.REFRESH_TOKEN_DAYS || 30);

const signAccessToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role
    },
    getJwtSecret(),
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
