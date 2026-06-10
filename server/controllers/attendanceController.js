const Attendance = require("../models/Attendance");
const OfficeLocation = require("../models/OfficeLocation");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const toCsv = require("../utils/csv");
const { getWorkingHours, isLateCheckIn, toDateKey } = require("../utils/dates");
const { buildLocationDecision, validateCoordinates } = require("../utils/geo");

const outsideLocationMessage = "You are outside the allowed company location. Attendance cannot be marked.";

const buildAttendanceQuery = async (filters = {}) => {
  const query = {};
  if (filters.date) query.date = filters.date;
  if (filters.employee) query.employee = filters.employee;
  if (filters.employeeId) query.employeeId = filters.employeeId;

  if (filters.department) {
    const employees = await User.find({
      department: filters.department,
      isActive: true
    }).select("_id");
    query.employee = { $in: employees.map((employee) => employee._id) };
  }

  return query;
};

const validateAttendanceLocation = async (body) => {
  const { latitude, longitude } = validateCoordinates(body);
  const office = await OfficeLocation.findOne({ status: "active" }).sort({ updatedAt: -1 });

  if (!office) {
    const error = new Error("No active office location is configured. Please contact admin.");
    error.statusCode = 400;
    throw error;
  }

  const decision = buildLocationDecision({ latitude, longitude, office });
  if (!decision.inside) {
    const error = new Error(outsideLocationMessage);
    error.statusCode = 403;
    error.details = decision;
    throw error;
  }

  return {
    decision,
    latitude,
    longitude
  };
};

const checkIn = asyncHandler(async (req, res) => {
  const date = toDateKey();
  const existing = await Attendance.findOne({ employee: req.user._id, date });

  if (existing) {
    res.status(409);
    throw new Error("You have already checked in today");
  }

  const location = await validateAttendanceLocation(req.body);
  const now = new Date();
  const attendance = await Attendance.create({
    employee: req.user._id,
    employeeId: req.user.employeeId || String(req.user._id),
    date,
    checkIn: now,
    checkInLatitude: location.latitude,
    checkInLongitude: location.longitude,
    checkInLocationStatus: location.decision.status,
    checkInDistanceMeters: location.decision.distanceMeters,
    status: isLateCheckIn(now) ? "Late" : "Present",
    locationNote: req.body.locationNote,
    remarks: req.body.remarks
  });

  res.status(201).json({ attendance, location: location.decision });
});

const checkOut = asyncHandler(async (req, res) => {
  const date = toDateKey();
  const attendance = await Attendance.findOne({ employee: req.user._id, date });

  if (!attendance || !attendance.checkIn) {
    res.status(400);
    throw new Error("You must check in before checking out");
  }

  if (attendance.checkOut) {
    res.status(409);
    throw new Error("You have already checked out today");
  }

  const now = new Date();
  if (now < attendance.checkIn) {
    res.status(400);
    throw new Error("Check-out cannot be before check-in");
  }

  const location = await validateAttendanceLocation(req.body);
  attendance.checkOut = now;
  attendance.checkOutLatitude = location.latitude;
  attendance.checkOutLongitude = location.longitude;
  attendance.checkOutLocationStatus = location.decision.status;
  attendance.checkOutDistanceMeters = location.decision.distanceMeters;
  attendance.workingHours = getWorkingHours(attendance.checkIn, now);
  attendance.status = attendance.workingHours < 4 ? "Half Day" : attendance.status;
  attendance.remarks = req.body.remarks || attendance.remarks;
  await attendance.save();

  res.json({ attendance, location: location.decision });
});

const getTodayAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findOne({
    employee: req.user._id,
    date: toDateKey()
  });

  res.json({ attendance });
});

const getMyHistory = asyncHandler(async (req, res) => {
  const attendance = await Attendance.find({ employee: req.user._id })
    .sort({ date: -1 })
    .limit(Number(req.query.limit) || 60);

  res.json({ attendance });
});

const getAllAttendance = asyncHandler(async (req, res) => {
  const query = await buildAttendanceQuery(req.query);
  const attendance = await Attendance.find(query)
    .populate("employee", "name email employeeId department designation")
    .sort({ date: -1, createdAt: -1 });

  res.json({ attendance });
});

const getReport = asyncHandler(async (req, res) => {
  const query = await buildAttendanceQuery(req.query);
  const attendance = await Attendance.find(query).populate(
    "employee",
    "name email employeeId department designation"
  );

  const summary = attendance.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { total: 0, Present: 0, Late: 0, "Half Day": 0, Absent: 0 }
  );

  res.json({ attendance, summary });
});

const exportCsv = asyncHandler(async (req, res) => {
  const query = await buildAttendanceQuery(req.query);
  const attendance = await Attendance.find(query)
    .populate("employee", "name email employeeId department designation")
    .sort({ date: -1 });

  const rows = [
    [
      "Date",
      "Employee ID",
      "Name",
      "Department",
      "Designation",
      "Check In",
      "Check Out",
      "Working Hours",
      "Status",
      "Check In Location",
      "Check In Distance (m)",
      "Check Out Location",
      "Check Out Distance (m)",
      "Remarks"
    ],
    ...attendance.map((item) => [
      item.date,
      item.employeeId,
      item.employee?.name || "",
      item.employee?.department || "",
      item.employee?.designation || "",
      item.checkIn ? item.checkIn.toISOString() : "",
      item.checkOut ? item.checkOut.toISOString() : "",
      item.workingHours,
      item.status,
      item.checkInLocationStatus || "",
      item.checkInDistanceMeters ?? "",
      item.checkOutLocationStatus || "",
      item.checkOutDistanceMeters ?? "",
      item.remarks || ""
    ])
  ];

  res.header("Content-Type", "text/csv");
  res.attachment(`attendance-report-${toDateKey()}.csv`);
  res.send(toCsv(rows));
});

module.exports = {
  checkIn,
  checkOut,
  exportCsv,
  getAllAttendance,
  getMyHistory,
  getReport,
  getTodayAttendance
};
