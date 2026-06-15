const Attendance = require("../models/Attendance");
const mongoose = require("mongoose");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const toCsv = require("../utils/csv");
const { getWorkingHours, isLateCheckIn, toDateKey } = require("../utils/dates");
const { normalizeAttendanceLocation } = require("../utils/geo");
const { getShiftFromCheckIn } = require("../utils/shifts");
const { isAssignedWeekOffDate, weekRangeForDateKey } = require("../utils/weekOff");

const employeeSelect = "name email employeeId department designation assignedShift weeklyWeekOffDay profilePhoto";
const hrWeekOffSourceStatuses = ["Absent", "Leave", "Missed"];

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

const checkIn = asyncHandler(async (req, res) => {
  const date = toDateKey();
  if (isAssignedWeekOffDate(req.user, date)) {
    res.status(400);
    throw new Error(`Today is assigned as ${req.user.weeklyWeekOffDay || "Week Off"} for this employee`);
  }

  const existing = await Attendance.findOne({ employee: req.user._id, date });

  if (existing) {
    res.status(409);
    throw new Error("You have already checked in today");
  }

  const now = new Date();
  const location = normalizeAttendanceLocation(req.body, now);
  const shiftName = getShiftFromCheckIn(now, req.user.assignedShift);
  const attendance = await Attendance.create({
    employee: req.user._id,
    employeeId: req.user.employeeId || String(req.user._id),
    date,
    checkIn: now,
    shiftName,
    checkInLatitude: location.latitude,
    checkInLongitude: location.longitude,
    checkInAccuracy: location.accuracy,
    checkInLocationStatus: location.locationStatus,
    checkInLocationCapturedAt: location.capturedAt,
    checkInDistanceMeters: null,
    status: isLateCheckIn(now) ? "Late" : "Present",
    locationNote: req.body.locationNote,
    remarks: req.body.remarks
  });

  res.status(201).json({ attendance, location, message: "Check-in marked successfully." });
});

const checkOut = asyncHandler(async (req, res) => {
  const date = toDateKey();
  const attendance = await Attendance.findOne({ employee: req.user._id, date });

  if (!attendance || !attendance.checkIn) {
    res.status(400);
    throw new Error("You must check in before checking out");
  }

  if (attendance.status === "Week Off") {
    res.status(400);
    throw new Error("Week Off attendance cannot be checked out");
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

  attendance.checkOut = now;
  const location = normalizeAttendanceLocation(req.body, now);
  attendance.checkOutLatitude = location.latitude;
  attendance.checkOutLongitude = location.longitude;
  attendance.checkOutAccuracy = location.accuracy;
  attendance.checkOutLocationStatus = location.locationStatus;
  attendance.checkOutLocationCapturedAt = location.capturedAt;
  attendance.checkOutDistanceMeters = null;
  attendance.workingHours = getWorkingHours(attendance.checkIn, now);
  attendance.status = attendance.workingHours < 4 ? "Half Day" : attendance.status;
  attendance.remarks = req.body.remarks || attendance.remarks;
  await attendance.save();

  res.json({ attendance, location, message: "Check-out marked successfully." });
});

const getTodayAttendance = asyncHandler(async (req, res) => {
  const attendance = await Attendance.findOne({
    employee: req.user._id,
    date: toDateKey()
  });

  if (!attendance && isAssignedWeekOffDate(req.user, toDateKey())) {
    res.json({
      attendance: {
        _id: `week-off-${req.user._id}-${toDateKey()}`,
        employee: req.user._id,
        employeeId: req.user.employeeId || String(req.user._id),
        date: toDateKey(),
        status: "Week Off",
        shiftName: "Weekly Week Off",
        workingHours: 0,
        remarks: `Assigned ${req.user.weeklyWeekOffDay || "Week Off"}`,
        isVirtualWeekOff: true
      }
    });
    return;
  }

  res.json({ attendance });
});

const getMyHistory = asyncHandler(async (req, res) => {
  const limit = Number(req.query.limit) || 60;
  const attendance = await Attendance.find({ employee: req.user._id })
    .sort({ date: -1 })
    .limit(limit);

  res.json({ attendance });
});

const getAllAttendance = asyncHandler(async (req, res) => {
  const query = await buildAttendanceQuery(req.query);
  const attendance = await Attendance.find(query)
    .populate("employee", employeeSelect)
    .sort({ date: -1, createdAt: -1 });

  res.json({ attendance });
});

const getReport = asyncHandler(async (req, res) => {
  const query = await buildAttendanceQuery(req.query);
  const attendance = await Attendance.find(query).populate(
    "employee",
    employeeSelect
  );

  const summary = attendance.reduce(
    (acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    { total: 0, Present: 0, Late: 0, "Half Day": 0, Absent: 0, "Week Off": 0 }
  );

  res.json({ attendance, summary });
});

const exportCsv = asyncHandler(async (req, res) => {
  const query = await buildAttendanceQuery(req.query);
  const attendance = await Attendance.find(query)
    .populate("employee", employeeSelect)
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
      "Shift",
      "Working Hours",
      "Status",
      "Check-in Latitude",
      "Check-in Longitude",
      "Check-in Accuracy",
      "Check-in Location Status",
      "Check-out Latitude",
      "Check-out Longitude",
      "Check-out Accuracy",
      "Check-out Location Status",
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
      item.shiftName || getShiftFromCheckIn(item.checkIn, item.employee?.assignedShift),
      item.workingHours,
      item.status,
      item.checkInLatitude ?? "",
      item.checkInLongitude ?? "",
      item.checkInAccuracy ?? "",
      item.checkInLocationStatus || "",
      item.checkOutLatitude ?? "",
      item.checkOutLongitude ?? "",
      item.checkOutAccuracy ?? "",
      item.checkOutLocationStatus || "",
      item.remarks || ""
    ])
  ];

  res.header("Content-Type", "text/csv");
  res.attachment(`attendance-report-${toDateKey()}.csv`);
  res.send(toCsv(rows));
});

const ensureSingleWeekOffInWeek = async ({ employeeId, date, excludeId }) => {
  const range = weekRangeForDateKey(date);
  const existing = await Attendance.findOne({
    employee: employeeId,
    date: { $gte: range.start, $lte: range.end },
    status: "Week Off",
    ...(excludeId ? { _id: { $ne: excludeId } } : {})
  });

  if (existing) {
    const error = new Error("This employee already has one Week Off marked in this week");
    error.statusCode = 400;
    throw error;
  }
};

const markWeekOff = asyncHandler(async (req, res) => {
  const { employeeId, date, reason } = req.body;
  if (!employeeId || !date) {
    res.status(400);
    throw new Error("Employee ID and date are required");
  }

  const employeeQuery = [{ employeeId }];
  if (mongoose.isValidObjectId(employeeId)) employeeQuery.push({ _id: employeeId });
  const employee = await User.findOne({
    isActive: true,
    $or: employeeQuery
  });

  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }

  if (!isAssignedWeekOffDate(employee, date)) {
    res.status(400);
    throw new Error(`Selected date is not this employee's assigned Week Off day (${employee.weeklyWeekOffDay || "Sunday"})`);
  }

  let attendance = await Attendance.findOne({ employee: employee._id, date });
  if (attendance && !hrWeekOffSourceStatuses.includes(attendance.status)) {
    res.status(400);
    throw new Error("HR can change only Leave, Absent, or Missed attendance to Week Off");
  }

  await ensureSingleWeekOffInWeek({ employeeId: employee._id, date, excludeId: attendance?._id });

  if (!attendance) {
    attendance = new Attendance({
      employee: employee._id,
      employeeId: employee.employeeId || String(employee._id),
      date,
      shiftName: "Weekly Week Off",
      workingHours: 0
    });
  }

  attendance.status = "Week Off";
  attendance.checkIn = undefined;
  attendance.checkOut = undefined;
  attendance.workingHours = 0;
  attendance.remarks = reason || `Marked Week Off by ${req.user.role.toUpperCase()}`;
  attendance.statusUpdatedBy = req.user._id;
  attendance.statusUpdatedAt = new Date();
  attendance.statusUpdateReason = reason || "";
  await attendance.save();

  const populated = await Attendance.findById(attendance._id).populate("employee", employeeSelect);
  res.json({ attendance: populated, message: "Week Off marked successfully" });
});

module.exports = {
  checkIn,
  checkOut,
  exportCsv,
  getAllAttendance,
  getMyHistory,
  getReport,
  getTodayAttendance,
  markWeekOff
};
