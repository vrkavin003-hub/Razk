const { query } = require("../db");
const HttpError = require("../utils/httpError");
const { pagedResponse, pagination } = require("../utils/pagination");
const toCsv = require("../../utils/csv");
const { getWorkingHours, isLateCheckIn, toDateKey } = require("../../utils/dates");
const { normalizeAttendanceLocation } = require("../../utils/geo");
const { getShiftFromCheckIn } = require("../../utils/shifts");

const mapAttendanceRow = (row) =>
  row
    ? {
        _id: String(row.id),
        id: row.id,
        employeeId: row.employee_id,
        date: row.date,
        checkIn: row.check_in_time,
        shiftName: row.shift_name || "Not marked",
        checkInLatitude: row.check_in_latitude === null ? null : Number(row.check_in_latitude),
        checkInLongitude: row.check_in_longitude === null ? null : Number(row.check_in_longitude),
        checkInAccuracy: row.check_in_accuracy === null ? null : Number(row.check_in_accuracy),
        checkInLocationStatus: row.check_in_location_status,
        checkInLocationCapturedAt: row.check_in_location_captured_at,
        checkInDistanceMeters: row.check_in_distance_meters,
        checkOut: row.check_out_time,
        checkOutLatitude: row.check_out_latitude === null ? null : Number(row.check_out_latitude),
        checkOutLongitude: row.check_out_longitude === null ? null : Number(row.check_out_longitude),
        checkOutAccuracy: row.check_out_accuracy === null ? null : Number(row.check_out_accuracy),
        checkOutLocationStatus: row.check_out_location_status,
        checkOutLocationCapturedAt: row.check_out_location_captured_at,
        checkOutDistanceMeters: row.check_out_distance_meters,
        workingHours: Number(row.work_duration || 0),
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    : null;

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

    const now = new Date();
    const location = normalizeAttendanceLocation(req.body, now);
    const shiftName = getShiftFromCheckIn(now, req.user.assignedShift || req.user.shiftName);
    const status = isLateCheckIn(now) ? "Late" : "Present";
    const result = await query(
      `INSERT INTO attendance
        (employee_id, check_in_time, shift_name, check_in_latitude, check_in_longitude, check_in_location_status,
         check_in_accuracy, check_in_location_captured_at, check_in_distance_meters, date, status)
       VALUES
        (:employeeId, :checkInTime, :shiftName, :latitude, :longitude, :locationStatus,
         :accuracy, :capturedAt, NULL, :date, :status)`,
      {
        accuracy: location.accuracy,
        capturedAt: location.capturedAt,
        checkInTime: now,
        date,
        employeeId,
        latitude: location.latitude,
        locationStatus: location.locationStatus,
        longitude: location.longitude,
        shiftName,
        status
      }
    );
    res.status(201).json({ attendanceId: result.insertId, location, message: "Check-in marked successfully." });
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

    const now = new Date();
    const location = normalizeAttendanceLocation(req.body, now);
    const workDuration = getWorkingHours(attendance.check_in_time, now);
    const status = workDuration < 4 ? "Half Day" : attendance.status;
    await query(
      `UPDATE attendance
       SET check_out_time = :checkOutTime,
           check_out_latitude = :latitude,
           check_out_longitude = :longitude,
           check_out_location_status = :locationStatus,
           check_out_accuracy = :accuracy,
           check_out_location_captured_at = :capturedAt,
           check_out_distance_meters = NULL,
           work_duration = :workDuration,
           status = :status
       WHERE id = :id`,
      {
        accuracy: location.accuracy,
        capturedAt: location.capturedAt,
        checkOutTime: now,
        id: attendance.id,
        latitude: location.latitude,
        locationStatus: location.locationStatus,
        longitude: location.longitude,
        status,
        workDuration
      }
    );
    res.json({ location, message: "Check-out marked successfully." });
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
      "shift_name",
      "check_in_latitude",
      "check_in_longitude",
      "check_in_accuracy",
      "check_in_location_status",
      "check_out_latitude",
      "check_out_longitude",
      "check_out_accuracy",
      "check_out_location_status",
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
