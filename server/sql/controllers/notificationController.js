const { query } = require("../db");
const HttpError = require("../utils/httpError");
const { pagedResponse, pagination } = require("../utils/pagination");

const listNotifications = async (req, res, next) => {
  try {
    const { limit, offset, page } = pagination(req.query);
    const params = { limit, offset, userId: req.user.id };
    const typeClause = req.query.type ? "AND type = :type" : "";
    if (req.query.type) params.type = req.query.type;

    const [totalRow] = await query(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = :userId ${typeClause}`,
      params
    );
    const [unreadRow] = await query(
      `SELECT COUNT(*) AS total FROM notifications WHERE user_id = :userId AND is_read = 0 ${typeClause}`,
      params
    );
    const notifications = await query(
      `SELECT id, title, message, type, is_read, created_at, read_at
       FROM notifications
       WHERE user_id = :userId ${typeClause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      params
    );

    res.json({
      ...pagedResponse(notifications, totalRow.total, page, limit),
      unreadCount: unreadRow.total
    });
  } catch (error) {
    next(error);
  }
};

const counts = async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT type, COUNT(*) AS unread
       FROM notifications
       WHERE user_id = :userId AND is_read = 0
       GROUP BY type`,
      { userId: req.user.id }
    );
    res.json({
      totalUnread: rows.reduce((total, row) => total + Number(row.unread), 0),
      byType: rows.reduce((acc, row) => ({ ...acc, [row.type]: Number(row.unread) }), {})
    });
  } catch (error) {
    next(error);
  }
};

const markRead = async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE id = :id AND user_id = :userId`,
      { id: req.params.id, userId: req.user.id }
    );
    if (!result.affectedRows) throw new HttpError("Notification not found", 404);
    res.json({ message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
};

const markAllRead = async (req, res, next) => {
  try {
    await query(
      `UPDATE notifications
       SET is_read = 1, read_at = COALESCE(read_at, NOW())
       WHERE user_id = :userId AND (:type IS NULL OR type = :type)`,
      { type: req.query.type || null, userId: req.user.id }
    );
    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  counts,
  listNotifications,
  markAllRead,
  markRead
};
