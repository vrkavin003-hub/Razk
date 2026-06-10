const bcrypt = require("bcryptjs");
const { query } = require("../db");
const auditLog = require("../utils/audit");
const HttpError = require("../utils/httpError");
const { pagedResponse, pagination } = require("../utils/pagination");
const { assertEmail, assertEnum, cleanString, requireFields } = require("../utils/validation");

const roles = ["super_admin", "admin", "hr", "manager", "viewer"];
const statuses = ["active", "inactive", "suspended"];

const dashboard = async (_req, res, next) => {
  try {
    const [messageCount] = await query(`SELECT COUNT(*) AS total FROM contact_messages`);
    const [applicationCount] = await query(`SELECT COUNT(*) AS total FROM career_applications`);
    const [userCount] = await query(`SELECT COUNT(*) AS total FROM admin_users`);
    const recentContacts = await query(
      `SELECT id, 'contact' AS activity_type, subject AS title, name AS actor, status, created_at
       FROM contact_messages
       ORDER BY created_at DESC
       LIMIT 5`
    );
    const recentApplications = await query(
      `SELECT id, 'career' AS activity_type, position AS title, full_name AS actor, status, created_at
       FROM career_applications
       ORDER BY created_at DESC
       LIMIT 5`
    );

    const recentActivities = [...recentContacts, ...recentApplications]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    res.json({
      cards: {
        totalApplications: applicationCount.total,
        totalMessages: messageCount.total,
        totalUsers: userCount.total
      },
      recentActivities
    });
  } catch (error) {
    next(error);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const { limit, offset, page } = pagination(req.query);
    const where = [];
    const params = {};
    if (req.query.role) {
      assertEnum(req.query.role, roles, "role");
      where.push("role = :role");
      params.role = req.query.role;
    }
    if (req.query.status) {
      assertEnum(req.query.status, statuses, "status");
      where.push("status = :status");
      params.status = req.query.status;
    }
    if (req.query.search) {
      params.search = `%${cleanString(req.query.search, 120)}%`;
      where.push("(username LIKE :search OR email LIKE :search)");
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [totalRow] = await query(`SELECT COUNT(*) AS total FROM admin_users ${clause}`, params);
    const users = await query(
      `SELECT id, username, email, role, status, last_login_at, created_at, updated_at
       FROM admin_users
       ${clause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset }
    );
    res.json(pagedResponse(users, totalRow.total, page, limit));
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    requireFields(req.body, ["username", "email", "password"]);
    assertEmail(req.body.email);
    const role = req.body.role || "admin";
    assertEnum(role, roles, "role");
    const passwordHash = await bcrypt.hash(req.body.password, 12);
    const result = await query(
      `INSERT INTO admin_users (username, email, password_hash, role, status)
       VALUES (:username, :email, :passwordHash, :role, :status)`,
      {
        email: cleanString(req.body.email, 190).toLowerCase(),
        passwordHash,
        role,
        status: req.body.status || "active",
        username: cleanString(req.body.username, 80)
      }
    );
    await auditLog({ action: "create", entityId: result.insertId, entityType: "admin_users", req });
    res.status(201).json({ id: result.insertId, message: "Admin user created" });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const fields = [];
    const params = { id: req.params.id };
    if (req.body.username !== undefined) {
      fields.push("username = :username");
      params.username = cleanString(req.body.username, 80);
    }
    if (req.body.email !== undefined) {
      assertEmail(req.body.email);
      fields.push("email = :email");
      params.email = cleanString(req.body.email, 190).toLowerCase();
    }
    if (req.body.role !== undefined) {
      assertEnum(req.body.role, roles, "role");
      fields.push("role = :role");
      params.role = req.body.role;
    }
    if (req.body.status !== undefined) {
      assertEnum(req.body.status, statuses, "status");
      fields.push("status = :status");
      params.status = req.body.status;
    }
    if (req.body.password) {
      fields.push("password_hash = :passwordHash");
      params.passwordHash = await bcrypt.hash(req.body.password, 12);
    }
    if (!fields.length) throw new HttpError("No fields to update", 400);

    const result = await query(`UPDATE admin_users SET ${fields.join(", ")} WHERE id = :id`, params);
    if (!result.affectedRows) throw new HttpError("Admin user not found", 404);
    await auditLog({ action: "update", entityId: Number(req.params.id), entityType: "admin_users", req });
    res.json({ message: "Admin user updated" });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) throw new HttpError("You cannot delete your own account", 400);
    const result = await query(`DELETE FROM admin_users WHERE id = :id`, { id: req.params.id });
    if (!result.affectedRows) throw new HttpError("Admin user not found", 404);
    await auditLog({ action: "delete", entityId: Number(req.params.id), entityType: "admin_users", req });
    res.json({ message: "Admin user deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUser,
  dashboard,
  deleteUser,
  listUsers,
  updateUser
};
