const { query, transaction } = require("../db");

const adminRoles = ["super_admin", "admin", "hr"];

const adminUserIds = async (connection = null) => {
  const executor = connection ? connection.execute.bind(connection) : query;
  if (connection) {
    const [rows] = await executor(
      `SELECT id FROM admin_users WHERE status = 'active' AND role IN ('super_admin', 'admin', 'hr')`
    );
    return rows.map((row) => row.id);
  }
  const rows = await executor(`SELECT id FROM admin_users WHERE status = 'active' AND role IN ('super_admin', 'admin', 'hr')`);
  return rows.map((row) => row.id);
};

const createNotification = async ({ userId, title, message, type = "system" }, connection = null) => {
  const params = { message, title, type, userId };
  if (connection) {
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES (:userId, :title, :message, :type)`,
      params
    );
    return;
  }
  await query(
    `INSERT INTO notifications (user_id, title, message, type)
     VALUES (:userId, :title, :message, :type)`,
    params
  );
};

const notifyAdmins = async ({ title, message, type = "system" }, connection = null) => {
  const ids = await adminUserIds(connection);
  for (const userId of ids) {
    await createNotification({ message, title, type, userId }, connection);
  }
};

const notifyAdminsInTransaction = async (payload) =>
  transaction(async (connection) => {
    await notifyAdmins(payload, connection);
  });

module.exports = {
  adminRoles,
  createNotification,
  notifyAdmins,
  notifyAdminsInTransaction
};
