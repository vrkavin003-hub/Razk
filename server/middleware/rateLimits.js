const crypto = require("crypto");
const { ipKeyGenerator, rateLimit } = require("express-rate-limit");
const { verifyToken } = require("../utils/authToken");
const { logWarn } = require("../utils/structuredLogger");

const normalizedIp = (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || "unknown", 56);

const authenticatedIdentity = (req) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      const decoded = verifyToken(token);
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      // Invalid tokens fall back to the normalized request IP.
    }
  }
  return `ip:${normalizedIp(req)}`;
};

const bodyIdentity = (req, fields) => {
  const value = fields.map((field) => req.body?.[field]).find(Boolean);
  if (!value) return `ip:${normalizedIp(req)}`;
  const digest = crypto.createHash("sha256").update(String(value).trim().toLowerCase()).digest("hex");
  return `subject:${digest}`;
};

const limiter = ({ event, keyGenerator, limit, skip, windowMs }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip,
    handler: (req, res) => {
      logWarn("rate_limit_exceeded", {
        event,
        method: req.method,
        path: req.originalUrl,
        userId: req.user?._id ? String(req.user._id) : undefined
      });
      res.status(429).json({
        message: "Too many requests. Please wait and try again."
      });
    }
  });

const generalApiLimiter = limiter({
  event: "general_api",
  keyGenerator: authenticatedIdentity,
  limit: Number(process.env.GENERAL_RATE_LIMIT_MAX || 3000),
  windowMs: Number(process.env.GENERAL_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
});

const loginLimiter = limiter({
  event: "login",
  keyGenerator: (req) => bodyIdentity(req, ["email"]),
  limit: Number(process.env.LOGIN_RATE_LIMIT_MAX || 15),
  skip: (req) => req.method !== "POST",
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000)
});

const passwordResetLimiter = limiter({
  event: "password_reset",
  keyGenerator: (req) => bodyIdentity(req, ["email", "token"]),
  limit: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 10),
  skip: (req) => req.method !== "POST",
  windowMs: Number(process.env.PASSWORD_RESET_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000)
});

const uploadLimiter = limiter({
  event: "upload",
  keyGenerator: authenticatedIdentity,
  limit: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 100),
  windowMs: Number(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || 60 * 60 * 1000)
});

module.exports = {
  generalApiLimiter,
  loginLimiter,
  passwordResetLimiter,
  uploadLimiter
};
