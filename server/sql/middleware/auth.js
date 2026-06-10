const jwt = require("jsonwebtoken");
const { query } = require("../db");
const HttpError = require("../utils/httpError");

const sanitizeUser = (user) =>
  user
    ? {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    : null;

const protect = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) throw new HttpError("Not authorized, token missing", 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const users = await query(
      `SELECT id, username, email, role, status FROM admin_users WHERE id = :id AND status = 'active' LIMIT 1`,
      { id: decoded.id }
    );
    if (!users.length) throw new HttpError("Not authorized, user inactive or missing", 401);

    req.user = sanitizeUser(users[0]);
    next();
  } catch (error) {
    next(error.statusCode ? error : new HttpError("Not authorized, token invalid", 401));
  }
};

const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new HttpError("Forbidden: insufficient role permissions", 403));
      return;
    }
    next();
  };

module.exports = {
  authorize,
  protect,
  sanitizeUser
};
