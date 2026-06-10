const { query } = require("../db");
const HttpError = require("../utils/httpError");
const { pagedResponse, pagination } = require("../utils/pagination");
const toCsv = require("../../utils/csv");
const { getWorkingHours, isLateCheckIn, toDateKey } = require("../../utils/dates");
const { buildLocationDecision, validateCoordinates } = require("../../utils/geo");
const { activeOffice } = require("./officeLocationController");

const outsideLocationMessage = "You are outside the allowed company location. Attendance cannot be marked.";

const mapAttendanceRow = (row) =>
  row
    ? {
        _id: String(row.id),
        id: row.id,
        employeeId: row.employee_id,
        date: row.date,
        checkIn: row.check_in_time,
        checkInLatitude: Number(row.check_in_latitude),
        checkInLongitude: Number(row.check_in_longitude),
        checkInLocationStatus: row.check_in_location_status,
        checkInDistanceMeters: row.check_in_distance_meters,
        checkOut: row.check_out_time,
        checkOutLatitude: row.check_out_latitude === null ? null : Number(row.check_out_latitude),
        checkOutLongitude: row.check_out_longitude === null ? null : Number(row.check_out_longitude),
        checkOutLocationStatus: row.check_out_location_status,
        checkOutDistanceMeters: row.check_out_distance_meters,
        workingHours: Number(row.work_duration || 0),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    : null;

const validateAttendanceLocation = async (body) => {
  const coordinates = validateCoordinates(body);
  const office = await activeOffice();
  if (!office) throw new HttpError("No active office location is configured. Please contact admin.", 400);
  const decision = buildLocationDecision({ ...coordinates, office });
  if (!decision.inside) {
    throw new HttpError(outsideLocationMessage, 403, decision);
  }
  return { ...coordinates, decision };
};

const currentEmployeeId = (req) => String(req.body.employee_id || req.user.employeeId || req.user.id);

const checkIn = async (req, res, next) => {
  try {
    const employeeId = currentEmployeeId(req);
    const date = toDateKey();
    const existing = await query(`SELECT id FROM attendance WHERE employee_id = :employeeId AND date = :date LIMIT 1`, {
      date,
      employeeId
    });
    if (existing.length) throw new HttpError("You have already checked in today", 409);

    const location = await validateAttendanceLocation(req.body);
    const now = new Date();
    const status = isLateCheckIn(now) ? "Late" : "Present";
    const result = await query(
      `INSERT INTO attendance
        (employee_id, check_in_time, check_in_latitude, check_in_longitude, check_in_location_status,
         check_in_distance_meters, date, status)
       VALUES
        (:employeeId, :checkInTime, :latitude, :longitude, :locationStatus, :distanceMeters, :date, :status)`,
      {
        checkInTime: now,
        date,
        distanceMeters: location.decision.distanceMeters,
        employeeId,
        latitude: location.latitude,
        locationStatus: location.decision.status,
        longitude: location.longitude,
        status
      }
    );
    res.status(201).json({ attendanceId: result.insertId, location: location.decision, message: "Checked in successfully" });
  } catch (error) {
    next(error);
  }
};

const checkOut = async (req, res, next) => {
  try {
    const employeeId = currentEmployeeId(req);
    const date = toDateKey();
    const rows = await query(`SELECT * FROM attendance WHERE employee_id = :employeeId AND date = :date LIMIT 1`, {
      date,
      employeeId
    });
    const attendance = rows[0];
    if (!attendance) throw new HttpError("You must check in before checking out", 400);
    if (attendance.check_out_time) throw new HttpError("You have already checked out today", 409);

    const location = await validateAttendanceLocation(req.body);
    const now = new Date();
    const workDuration = getWorkingHours(attendance.check_in_time, now);
    const status = workDuration < 4 ? "Half Day" : attendance.status;
    await query(
      `UPDATE attendance
       SET check_out_time = :checkOutTime,
           check_out_latitude = :latitude,
           check_out_longitude = :longitude,
           check_out_location_status = :locationStatus,
           check_out_distance_meters = :distanceMeters,
           work_duration = :workDuration,
           status = :status
       WHERE id = :id`,
      {
        checkOutTime: now,
        distanceMeters: location.decision.distanceMeters,
        id: attendance.id,
        latitude: location.latitude,
        locationStatus: location.decision.status,
        longitude: location.longitude,
        status,
        workDuration
      }
    );
    res.json({ location: location.decision, message: "Checked out successfully" });
  } catch (error) {
    next(error);
  }
};

const myAttendance = async (req, res, next) => {
  try {
    const employeeId = String(req.query.employee_id || req.user.id);
    const rows = await query(
      `SELECT * FROM attendance WHERE employee_id = :employeeId ORDER BY date DESC, created_at DESC LIMIT 60`,
      { employeeId }
    );
    res.json({ attendance: rows.map(mapAttendanceRow) });
  } catch (error) {
    next(error);
  }
};

const todayAttendance = async (req, res, next) => {
  try {
    const employeeId = String(req.query.employee_id || req.user.id);
    const rows = await query(`SELECT * FROM attendance WHERE employee_id = :employeeId AND date = :date LIMIT 1`, {
      date: toDateKey(),
      employeeId
    });
    res.json({ attendance: mapAttendanceRow(rows[0]) });
  } catch (error) {
    next(error);
  }
};

const allAttendance = async (req, res, next) => {
  try {
    const { limit, offset, page } = pagination(req.query);
    const where = [];
    const params = { limit, offset };
    if (req.query.date) {
      where.push("date = :date");
      params.date = req.query.date;
    }
    if (req.query.employeeId) {
      where.push("employee_id = :employeeId");
      params.employeeId = req.query.employeeId;
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const [totalRow] = await query(`SELECT COUNT(*) AS total FROM attendance ${clause}`, params);
    const rows = await query(
      `SELECT * FROM attendance ${clause} ORDER BY date DESC, created_at DESC LIMIT :limit OFFSET :offset`,
      params
    );
    const attendance = rows.map(mapAttendanceRow);
    res.json({ ...pagedResponse(attendance, totalRow.total, page, limit), attendance });
  } catch (error) {
    next(error);
  }
};

const exportCsv = async (req, res, next) => {
  try {
    const rows = await query(`SELECT * FROM attendance ORDER BY date DESC, created_at DESC`);
    const columns = [
      "date",
      "employee_id",
      "check_in_time",
      "check_out_time",
      "check_in_location_status",
      "check_in_distance_meters",
      "check_out_location_status",
      "check_out_distance_meters",
      "work_duration",
      "status"
    ];
    res.header("Content-Type", "text/csv");
    res.attachment(`attendance-location-report-${toDateKey()}.csv`);
    res.send(toCsv([columns, ...rows.map((row) => columns.map((column) => row[column] ?? ""))]));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  allAttendance,
  checkIn,
  checkOut,
  exportCsv,
  myAttendance,
  todayAttendance
};
