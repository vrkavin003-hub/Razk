const { query, transaction } = require("../db");
const HttpError = require("../utils/httpError");
const { buildLocationDecision, validateCoordinates } = require("../../utils/geo");

const mapOffice = (office) =>
  office
    ? {
        _id: String(office.id),
        id: office.id,
        officeName: office.office_name,
        latitude: Number(office.latitude),
        longitude: Number(office.longitude),
        radiusMeters: Number(office.radius_meters),
        status: office.status,
        createdAt: office.created_at,
        updatedAt: office.updated_at
      }
    : null;

const activeOffice = async () => {
  const rows = await query(
    `SELECT * FROM office_locations WHERE status = 'active' ORDER BY updated_at DESC LIMIT 1`
  );
  return rows[0] || null;
};

const listOfficeLocations = async (req, res, next) => {
  try {
    const active = mapOffice(await activeOffice());
    if (["super_admin", "admin", "hr"].includes(req.user.role)) {
      const rows = await query(`SELECT * FROM office_locations ORDER BY updated_at DESC`);
      res.json({ activeOffice: active, locations: rows.map(mapOffice) });
      return;
    }
    res.json({ activeOffice: active });
  } catch (error) {
    next(error);
  }
};

const normalizeOfficePayload = (body) => {
  const officeName = String(body.officeName || body.office_name || "").trim();
  const { latitude, longitude } = validateCoordinates(body);
  const radiusMeters = Number(body.radiusMeters ?? body.radius_meters);
  if (!officeName) throw new HttpError("Office name is required", 400);
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    throw new HttpError("Allowed radius must be a positive number", 400);
  }
  return {
    latitude,
    longitude,
    officeName,
    radiusMeters,
    status: body.status === "inactive" ? "inactive" : "active"
  };
};

const createOfficeLocation = async (req, res, next) => {
  try {
    const payload = normalizeOfficePayload(req.body);
    const officeId = await transaction(async (connection) => {
      if (payload.status === "active") {
        await connection.execute(`UPDATE office_locations SET status = 'inactive' WHERE status = 'active'`);
      }
      const [result] = await connection.execute(
        `INSERT INTO office_locations (office_name, latitude, longitude, radius_meters, status)
         VALUES (:officeName, :latitude, :longitude, :radiusMeters, :status)`,
        payload
      );
      return result.insertId;
    });
    const rows = await query(`SELECT * FROM office_locations WHERE id = :id`, { id: officeId });
    res.status(201).json({ officeLocation: mapOffice(rows[0]) });
  } catch (error) {
    next(error);
  }
};

const updateOfficeLocation = async (req, res, next) => {
  try {
    const payload = normalizeOfficePayload(req.body);
    await transaction(async (connection) => {
      if (payload.status === "active") {
        await connection.execute(`UPDATE office_locations SET status = 'inactive' WHERE status = 'active' AND id <> :id`, {
          id: req.params.id
        });
      }
      const [result] = await connection.execute(
        `UPDATE office_locations
         SET office_name = :officeName,
             latitude = :latitude,
             longitude = :longitude,
             radius_meters = :radiusMeters,
             status = :status
         WHERE id = :id`,
        { ...payload, id: req.params.id }
      );
      if (!result.affectedRows) throw new HttpError("Office location not found", 404);
    });
    const rows = await query(`SELECT * FROM office_locations WHERE id = :id`, { id: req.params.id });
    res.json({ officeLocation: mapOffice(rows[0]) });
  } catch (error) {
    next(error);
  }
};

const previewDistance = async (req, res, next) => {
  try {
    const coordinates = validateCoordinates(req.query);
    const active = mapOffice(await activeOffice());
    if (!active) throw new HttpError("No active office location is configured", 400);
    res.json({
      activeOffice: active,
      decision: buildLocationDecision({ ...coordinates, office: active })
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  activeOffice,
  createOfficeLocation,
  listOfficeLocations,
  previewDistance,
  updateOfficeLocation
};
