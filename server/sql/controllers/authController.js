const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query, transaction } = require("../db");
const { sanitizeUser } = require("../middleware/auth");
const auditLog = require("../utils/audit");
const HttpError = require("../utils/httpError");
const { generateOpaqueToken, hashToken, refreshExpiry, signAccessToken } = require("../utils/tokens");
const { assertEmail, cleanString, requireFields } = require("../utils/validation");

const login = async (req, res, next) => {
  try {
    requireFields(req.body, ["email", "password"]);
    assertEmail(req.body.email);

    const email = cleanString(req.body.email, 190).toLowerCase();
    const users = await query(`SELECT * FROM admin_users WHERE email = :email LIMIT 1`, { email });
    const user = users[0];
    if (!user || user.status !== "active" || !(await bcrypt.compare(req.body.password, user.password_hash))) {
      throw new HttpError("Invalid email or password", 401);
    }

    const refreshToken = generateOpaqueToken();
    const tokenHash = hashToken(refreshToken);
    const expiresAt = refreshExpiry();

    await transaction(async (connection) => {
      await connection.execute(`UPDATE admin_users SET last_login_at = NOW() WHERE id = :id`, { id: user.id });
      await connection.execute(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES (:userId, :tokenHash, :expiresAt)`,
        { expiresAt, tokenHash, userId: user.id }
      );
    });

    await auditLog({ action: "login", entityId: user.id, entityType: "admin_users", req: { ...req, user } });

    res.json({
      refreshToken,
      token: signAccessToken(user),
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    requireFields(req.body, ["refreshToken"]);
    const tokenHash = hashToken(req.body.refreshToken);
    const rows = await query(
      `SELECT rt.id AS refresh_id, au.*
       FROM refresh_tokens rt
       JOIN admin_users au ON au.id = rt.user_id
       WHERE rt.token_hash = :tokenHash
         AND rt.revoked_at IS NULL
         AND rt.expires_at > NOW()
         AND au.status = 'active'
       LIMIT 1`,
      { tokenHash }
    );
    if (!rows.length) throw new HttpError("Invalid refresh token", 401);

    res.json({
      token: signAccessToken(rows[0]),
      user: sanitizeUser(rows[0])
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.body.refreshToken) {
      await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = :tokenHash`, {
        tokenHash: hashToken(req.body.refreshToken)
      });
    }
    await auditLog({ action: "logout", entityType: "auth", req });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

const forgotPassword = async (req, res, next) => {
  try {
    requireFields(req.body, ["email"]);
    assertEmail(req.body.email);
    const email = cleanString(req.body.email, 190).toLowerCase();
    const users = await query(`SELECT id FROM admin_users WHERE email = :email AND status = 'active' LIMIT 1`, { email });
    let resetToken = "";

    if (users.length) {
      resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (:userId, :tokenHash, :expiresAt)`,
        { expiresAt, tokenHash: hashToken(resetToken), userId: users[0].id }
      );
    }

    res.json({
      message: "If the email exists, a password reset token has been generated.",
      resetToken: process.env.NODE_ENV === "production" ? undefined : resetToken
    });
  } catch (error) {
    next(error);
  }
};

const me = async (req, res) => {
  res.json({ user: req.user });
};

module.exports = {
  forgotPassword,
  login,
  logout,
  me,
  refresh
};
