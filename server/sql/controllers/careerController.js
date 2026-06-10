const path = require("path");
const { query, transaction } = require("../db");
const auditLog = require("../utils/audit");
const HttpError = require("../utils/httpError");
const { notifyAdmins } = require("../utils/notifications");
const { pagedResponse, pagination } = require("../utils/pagination");
const { assertEmail, assertEnum, assertPhone, cleanString, optionalDate, requireFields } = require("../utils/validation");

const applicationStatuses = ["new", "screening", "shortlisted", "interview", "offered", "rejected", "archived"];

const buildApplicationFilters = (reqQuery) => {
  const where = [];
  const params = {};

  if (reqQuery.status) {
    assertEnum(reqQuery.status, applicationStatuses);
    where.push("status = :status");
    params.status = reqQuery.status;
  }
  if (reqQuery.position) {
    where.push("position = :position");
    params.position = cleanString(reqQuery.position, 140);
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
    where.push("(full_name LIKE :search OR email LIKE :search OR position LIKE :search OR qualification LIKE :search)");
  }

  return {
    clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
    params
  };
};

const submitCareerApplication = async (req, res, next) => {
  try {
    requireFields(req.body, ["full_name", "email", "phone", "position", "qualification"]);
    if (!req.file) throw new HttpError("Resume file is required", 400);
    assertEmail(req.body.email);
    assertPhone(req.body.phone);

    const experience = Number(req.body.experience || 0);
    if (Number.isNaN(experience) || experience < 0) throw new HttpError("experience must be a positive number", 400);

    const resumePath = `/uploads/resumes/${path.basename(req.file.filename)}`;
    const payload = {
      coverLetter: cleanString(req.body.cover_letter, 5000) || null,
      email: cleanString(req.body.email, 190).toLowerCase(),
      experience,
      fullName: cleanString(req.body.full_name, 140),
      phone: cleanString(req.body.phone, 30),
      position: cleanString(req.body.position, 140),
      qualification: cleanString(req.body.qualification, 190),
      resumeUrl: resumePath
    };

    const applicationId = await transaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO career_applications
          (full_name, email, phone, position, experience, qualification, resume_url, cover_letter)
         VALUES
          (:fullName, :email, :phone, :position, :experience, :qualification, :resumeUrl, :coverLetter)`,
        payload
      );
      await notifyAdmins(
        {
          message: `${payload.fullName} applied for ${payload.position}.`,
          title: "New career application",
          type: "career"
        },
        connection
      );
      return result.insertId;
    });

    res.status(201).json({ applicationId, message: "Career application submitted successfully", resumeUrl: resumePath });
  } catch (error) {
    next(error);
  }
};

const listApplications = async (req, res, next) => {
  try {
    const { limit, offset, page } = pagination(req.query);
    const filters = buildApplicationFilters(req.query);
    const [totalRow] = await query(`SELECT COUNT(*) AS total FROM career_applications ${filters.clause}`, filters.params);
    const applications = await query(
      `SELECT id, full_name, email, phone, position, experience, qualification, resume_url, cover_letter, status, created_at, updated_at
       FROM career_applications
       ${filters.clause}
       ORDER BY created_at DESC
       LIMIT :limit OFFSET :offset`,
      { ...filters.params, limit, offset }
    );

    res.json(pagedResponse(applications, totalRow.total, page, limit));
  } catch (error) {
    next(error);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    assertEnum(req.body.status, applicationStatuses);
    const result = await query(`UPDATE career_applications SET status = :status WHERE id = :id`, {
      id: req.params.id,
      status: req.body.status
    });
    if (!result.affectedRows) throw new HttpError("Career application not found", 404);
    await auditLog({
      action: "update_status",
      entityId: Number(req.params.id),
      entityType: "career_applications",
      metadata: { status: req.body.status },
      req
    });
    res.json({ message: "Career application status updated" });
  } catch (error) {
    next(error);
  }
};

const deleteApplication = async (req, res, next) => {
  try {
    const result = await query(`DELETE FROM career_applications WHERE id = :id`, { id: req.params.id });
    if (!result.affectedRows) throw new HttpError("Career application not found", 404);
    await auditLog({ action: "delete", entityId: Number(req.params.id), entityType: "career_applications", req });
    res.json({ message: "Career application deleted" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applicationStatuses,
  deleteApplication,
  listApplications,
  submitCareerApplication,
  updateApplicationStatus
};
