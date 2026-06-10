const { query, transaction } = require("../db");
const auditLog = require("../utils/audit");
const HttpError = require("../utils/httpError");
const { pagedResponse, pagination } = require("../utils/pagination");
const { notifyAdmins } = require("../utils/notifications");
const { assertEmail, assertEnum, assertPhone, cleanString, optionalDate, requireFields } = require("../utils/validation");

const contactStatuses = ["new", "in_review", "responded", "closed", "spam"];

const buildContactFilters = (reqQuery) => {
  const where = [];
  const params = {};

  if (reqQuery.status) {
    assertEnum(reqQuery.status, contactStatuses);
    where.push("status = :status");
    params.status = reqQuery.status;
  }
  const from = optionalDate(reqQuery.from);
  const to = optionalDate(reqQuery.to);
  if (from) {
    where.push("DATE(created_at) >= :from");
    params.from = from;
  }
  if (to) {
    where.push("DATE(created_at) <= :to");
    params.to = to;
  }
  if (reqQuery.search) {
    params.search = `%${cleanString(reqQuery.search, 120)}%`;
    where.push("(name LIKE :search OR email LIKE :search OR company LIKE :search OR subject LIKE :search)");
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
};

const submitContactMessage = async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "subject", "message"]);
    assertEmail(req.body.email);
    assertPhone(req.body.phone, "phone", false);

    const payload = {
      company: cleanString(req.body.company, 160) || null,
      email: cleanString(req.body.email, 190).toLowerCase(),
      message: cleanString(req.body.message, 5000),
      name: cleanString(req.body.name, 120),
      phone: cleanString(req.body.phone, 30) || null,
      subject: cleanString(req.body.subject, 180)
    };

    const contactId = await transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO contact_messages (name, email, phone, company, subject, message)
         VALUES (:name, :email, :phone, :company, :subject, :message)`,
        payload
      );
      await notifyAdmins(
        {
          message: `${payload.name} submitted a contact message: ${payload.subject}`,
          title: "New contact message",
          type: "contact"
        },
        connection
      );
      return result.insertId;
    });

    res.status(201).json({ contactId, message: "Contact message submitted successfully" });
  } catch (error) {
    next(error);
  }
};

const listContactMessages = async (req, res, next) => {
  try {
    const { limit, offset, page } = pagination(req.query);
    const filters = buildContactFilters(req.query);
    const [totalRow] = await query(`SELECT COUNT(*) AS total FROM contact_messages ${filters.clause}`, filters.params);
    const messages = await query(
      `SELECT id, name, email, phone, company, subject, message, status, created_at, updated_at
       FROM contact_messages
       ${filters.clause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { ...filters.params, limit, offset }
    );

    res.json(pagedResponse(messages, totalRow.total, page, limit));
  } catch (error) {
    next(error);
  }
};

const updateContactStatus = async (req, res, next) => {
  try {
    assertEnum(req.body.status, contactStatuses);
    const result = await query(`UPDATE contact_messages SET status = :status WHERE id = :id`, {
      id: req.params.id,
      status: req.body.status
    });
    if (!result.affectedRows) throw new HttpError("Contact message not found", 404);
    await auditLog({
      action: "update_status",
      entityId: Number(req.params.id),
      entityType: "contact_messages",
      metadata: { status: req.body.status },
      req
    });
    res.json({ message: "Contact message status updated" });
  } catch (error) {
    next(error);
  }
};

const deleteContactMessage = async (req, res, next) => {
  try {
    const result = await query(`DELETE FROM contact_messages WHERE id = :id`, { id: req.params.id });
    if (!result.affectedRows) throw new HttpError("Contact message not found", 404);
    await auditLog({ action: "delete", entityId: Number(req.params.id), entityType: "contact_messages", req });
    res.json({ message: "Contact message deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  contactStatuses,
  deleteContactMessage,
  listContactMessages,
  submitContactMessage,
  updateContactStatus
};
