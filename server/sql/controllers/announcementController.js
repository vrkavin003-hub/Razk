const { query, transaction } = require("../db");
const auditLog = require("../utils/audit");
const HttpError = require("../utils/httpError");
const { notifyAdmins } = require("../utils/notifications");
const { pagedResponse, pagination } = require("../utils/pagination");
const { cleanString, requireFields } = require("../utils/validation");

const createAnnouncement = async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "description"]);
    const payload = {
      createdBy: req.user.id,
      description: cleanString(req.body.description, 5000),
      title: cleanString(req.body.title, 180)
    };
    const announcementId = await transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO announcements (title, description, created_by)
         VALUES (:title, :description, :createdBy)`,
        payload
      );
      await notifyAdmins(
        {
          message: payload.description.slice(0, 240),
          title: payload.title,
          type: "announcement"
        },
        connection
      );
      return result.insertId;
    });
    await auditLog({ action: "create", entityId: announcementId, entityType: "announcements", req });
    res.status(201).json({ announcementId, message: "Announcement created" });
  } catch (error) {
    next(error);
  }
};

const listAnnouncements = async (req, res, next) => {
  try {
    const { limit, offset, page } = pagination(req.query);
    const [totalRow] = await query(`SELECT COUNT(*) AS total FROM announcements`);
    const announcements = await query(
      `SELECT a.id, a.title, a.description, a.created_at, a.updated_at,
              au.id AS created_by_id, au.username AS created_by_username
       FROM announcements a
       JOIN admin_users au ON au.id = a.created_by
       ORDER BY a.created_at DESC
       LIMIT :limit OFFSET :offset`,
      { limit, offset }
    );
    res.json(pagedResponse(announcements, totalRow.total, page, limit));
  } catch (error) {
    next(error);
  }
};

const updateAnnouncement = async (req, res, next) => {
  try {
    const fields = [];
    const params = { id: req.params.id };
    if (req.body.title !== undefined) {
      fields.push("title = :title");
      params.title = cleanString(req.body.title, 180);
    }
    if (req.body.description !== undefined) {
      fields.push("description = :description");
      params.description = cleanString(req.body.description, 5000);
    }
    if (!fields.length) throw new HttpError("No fields to update", 400);
    const result = await query(`UPDATE announcements SET ${fields.join(", ")} WHERE id = :id`, params);
    if (!result.affectedRows) throw new HttpError("Announcement not found", 404);
    await auditLog({ action: "update", entityId: Number(req.params.id), entityType: "announcements", req });
    res.json({ message: "Announcement updated" });
  } catch (error) {
    next(error);
  }
};

const deleteAnnouncement = async (req, res, next) => {
  try {
    const result = await query(`DELETE FROM announcements WHERE id = :id`, { id: req.params.id });
    if (!result.affectedRows) throw new HttpError("Announcement not found", 404);
    await auditLog({ action: "delete", entityId: Number(req.params.id), entityType: "announcements", req });
    res.json({ message: "Announcement deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement
};
