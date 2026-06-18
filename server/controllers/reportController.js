const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const {
  buildDepartmentReport,
  buildEmployeeReport,
  buildMonthlyReport,
  sendReportPdf
} = require("../utils/reportBuilder");
const { sendReportExcel } = require("../utils/excelReportBuilder");

const requireDateRange = (req) => {
  const { from, to } = req.query;
  if (!from || !to) {
    const error = new Error("from and to query parameters are required");
    error.statusCode = 400;
    throw error;
  }
  return { from, to };
};

const normalizeUser = (user) => ({
  _id: String(user._id),
  employeeId: user.employeeId,
  name: user.name,
  email: user.email,
  department: user.department,
  designation: user.designation,
  assignedShift: user.assignedShift,
  weeklyWeekOffDay: user.weeklyWeekOffDay,
  joiningDate: user.joiningDate,
  role: user.role
});

const normalizeAttendance = (record) => ({
  _id: String(record._id),
  employee: String(record.employee),
  employeeId: record.employeeId,
  date: record.date,
  checkIn: record.checkIn,
  shiftName: record.shiftName,
  checkInAccuracy: record.checkInAccuracy,
  checkInLatitude: record.checkInLatitude,
  checkInLocationStatus: record.checkInLocationStatus,
  checkInLongitude: record.checkInLongitude,
  attendanceSite: record.attendanceSite,
  checkInPhoto: record.checkInPhoto,
  checkInPhotoCapturedAt: record.checkInPhotoCapturedAt,
  checkInPhotoDevice: record.checkInPhotoDevice,
  checkOut: record.checkOut,
  checkOutAccuracy: record.checkOutAccuracy,
  checkOutLatitude: record.checkOutLatitude,
  checkOutLocationStatus: record.checkOutLocationStatus,
  checkOutLongitude: record.checkOutLongitude,
  workingHours: record.workingHours,
  status: record.status,
  remarks: record.remarks,
  updatedAt: record.updatedAt
});

const normalizeLeave = (record) => ({
  _id: String(record._id),
  employee: String(record.employee),
  employeeId: record.employee?.employeeId,
  fromDate: record.fromDate,
  toDate: record.toDate,
  status: record.status,
  leaveType: record.leaveType
});

const findEmployee = async (identifier) => {
  const query = [{ employeeId: identifier }];
  if (mongoose.isValidObjectId(identifier)) query.push({ _id: identifier });
  const employee = await User.findOne({ $or: query, isActive: true });
  if (!employee) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }
  return employee;
};

const canAccessEmployeeReport = (user, employee) => {
  if (["admin", "hr"].includes(user.role)) return true;
  if (user.role === "dri") return false;
  return String(user._id) === String(employee._id) || user.employeeId === employee.employeeId;
};

const assertEmployeeReportAccess = (user, employee) => {
  if (canAccessEmployeeReport(user, employee)) return;
  const error = new Error("Employees can only access their own attendance report");
  error.statusCode = 403;
  throw error;
};

const getEmployeeReportData = async ({ employeeIdentifier, from, to, generatedBy }) => {
  const employee = await findEmployee(employeeIdentifier);
  assertEmployeeReportAccess(generatedBy, employee);
  const [attendance, leaves] = await Promise.all([
    Attendance.find({ employee: employee._id, date: { $gte: from, $lte: to } }).sort({ date: 1 }),
    LeaveRequest.find({
      employee: employee._id,
      status: "Approved",
      fromDate: { $lte: new Date(to) },
      toDate: { $gte: new Date(from) }
    }).populate("employee", "employeeId")
  ]);

  return buildEmployeeReport({
    employee: normalizeUser(employee),
    attendance: attendance.map(normalizeAttendance),
    leaves: leaves.map(normalizeLeave),
    from,
    to,
    generatedBy: normalizeUser(generatedBy)
  });
};

const getMonthlyReportData = async ({ month, year, generatedBy }) => {
  if (!month || !year) {
    const error = new Error("month and year query parameters are required");
    error.statusCode = 400;
    throw error;
  }

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  const [employees, attendance, leaves] = await Promise.all([
    User.find({ isActive: true, role: { $in: ["employee", "hr", "dri"] } }).sort({ employeeId: 1 }),
    Attendance.find({ date: { $gte: from, $lte: to } }),
    LeaveRequest.find({
      status: "Approved",
      fromDate: { $lte: new Date(to) },
      toDate: { $gte: new Date(from) }
    }).populate("employee", "employeeId")
  ]);

  return buildMonthlyReport({
    employees: employees.map(normalizeUser),
    attendance: attendance.map(normalizeAttendance),
    leaves: leaves.map(normalizeLeave),
    month,
    year,
    generatedBy: normalizeUser(generatedBy)
  });
};

const getDepartmentReportData = async ({ department, from, to, generatedBy }) => {
  const [employees, attendance, leaves] = await Promise.all([
    User.find({ isActive: true, department, role: { $in: ["employee", "hr", "dri"] } }).sort({ employeeId: 1 }),
    Attendance.find({ date: { $gte: from, $lte: to } }),
    LeaveRequest.find({
      status: "Approved",
      fromDate: { $lte: new Date(to) },
      toDate: { $gte: new Date(from) }
    }).populate("employee", "employeeId")
  ]);

  return buildDepartmentReport({
    department,
    employees: employees.map(normalizeUser),
    attendance: attendance.map(normalizeAttendance),
    leaves: leaves.map(normalizeLeave),
    from,
    to,
    generatedBy: normalizeUser(generatedBy)
  });
};

const getAllRangeReportData = async ({ from, to, generatedBy }) => {
  const [employees, attendance, leaves] = await Promise.all([
    User.find({ isActive: true, role: { $in: ["employee", "hr", "dri"] } }).sort({ employeeId: 1 }),
    Attendance.find({ date: { $gte: from, $lte: to } }),
    LeaveRequest.find({
      status: "Approved",
      fromDate: { $lte: new Date(to) },
      toDate: { $gte: new Date(from) }
    }).populate("employee", "employeeId")
  ]);

  return buildDepartmentReport({
    department: "All Departments",
    employees: employees.map(normalizeUser),
    attendance: attendance.map(normalizeAttendance),
    leaves: leaves.map(normalizeLeave),
    from,
    to,
    generatedBy: normalizeUser(generatedBy)
  });
};

const getEmployeeReport = asyncHandler(async (req, res) => {
  const { from, to } = requireDateRange(req);
  const report = await getEmployeeReportData({
    employeeIdentifier: req.params.employeeId,
    from,
    to,
    generatedBy: req.user
  });
  res.json({ report });
});

const getMonthlyReport = asyncHandler(async (req, res) => {
  const report = await getMonthlyReportData({
    month: req.query.month,
    year: req.query.year,
    generatedBy: req.user
  });
  res.json({ report });
});

const getDepartmentReport = asyncHandler(async (req, res) => {
  const { from, to } = requireDateRange(req);
  const report = await getDepartmentReportData({
    department: req.params.department,
    from,
    to,
    generatedBy: req.user
  });
  res.json({ report });
});

const getCustomReport = asyncHandler(async (req, res) => {
  const { type } = req.query;
  if (type === "employee") {
    const { from, to } = requireDateRange(req);
    const report = await getEmployeeReportData({
      employeeIdentifier: req.query.employeeId,
      from,
      to,
      generatedBy: req.user
    });
    res.json({ report });
    return;
  }

  if (type === "department") {
    const { from, to } = requireDateRange(req);
    const report = await getDepartmentReportData({
      department: req.query.department,
      from,
      to,
      generatedBy: req.user
    });
    res.json({ report });
    return;
  }

  if (type === "all") {
    const { from, to } = requireDateRange(req);
    const report = await getAllRangeReportData({ from, to, generatedBy: req.user });
    res.json({ report });
    return;
  }

  const report = await getMonthlyReportData({
    month: req.query.month || new Date().getMonth() + 1,
    year: req.query.year || new Date().getFullYear(),
    generatedBy: req.user
  });
  res.json({ report });
});

const employeePdf = asyncHandler(async (req, res) => {
  const { from, to } = requireDateRange(req);
  const report = await getEmployeeReportData({
    employeeIdentifier: req.params.employeeId,
    from,
    to,
    generatedBy: req.user
  });
  sendReportPdf(res, report, `employee-attendance-${report.employee.employeeId}.pdf`);
});

const employeeExcel = asyncHandler(async (req, res) => {
  const { from, to } = requireDateRange(req);
  const report = await getEmployeeReportData({
    employeeIdentifier: req.params.employeeId,
    from,
    to,
    generatedBy: req.user
  });
  await sendReportExcel(res, report, `employee-attendance-${report.employee.employeeId}.xlsx`);
});

const monthlyPdf = asyncHandler(async (req, res) => {
  const report = await getMonthlyReportData({
    month: req.query.month,
    year: req.query.year,
    generatedBy: req.user
  });
  sendReportPdf(res, report, `monthly-attendance-${req.query.year}-${req.query.month}.pdf`);
});

const monthlyExcel = asyncHandler(async (req, res) => {
  const report = await getMonthlyReportData({
    month: req.query.month,
    year: req.query.year,
    generatedBy: req.user
  });
  await sendReportExcel(res, report, `monthly-attendance-${req.query.year}-${req.query.month}.xlsx`);
});

const departmentPdf = asyncHandler(async (req, res) => {
  const { from, to } = requireDateRange(req);
  const report = await getDepartmentReportData({
    department: req.params.department,
    from,
    to,
    generatedBy: req.user
  });
  sendReportPdf(res, report, `department-attendance-${req.params.department}.pdf`);
});

const departmentExcel = asyncHandler(async (req, res) => {
  const { from, to } = requireDateRange(req);
  const report = await getDepartmentReportData({
    department: req.params.department,
    from,
    to,
    generatedBy: req.user
  });
  await sendReportExcel(res, report, `department-attendance-${req.params.department}.xlsx`);
});

const customPdf = asyncHandler(async (req, res) => {
  if (req.query.type === "employee") {
    const { from, to } = requireDateRange(req);
    const report = await getEmployeeReportData({
      employeeIdentifier: req.query.employeeId,
      from,
      to,
      generatedBy: req.user
    });
    return sendReportPdf(res, report, `employee-attendance-${report.employee.employeeId}.pdf`);
  }
  if (req.query.type === "department") {
    const { from, to } = requireDateRange(req);
    const report = await getDepartmentReportData({
      department: req.query.department,
      from,
      to,
      generatedBy: req.user
    });
    return sendReportPdf(res, report, `department-attendance-${req.query.department}.pdf`);
  }
  if (req.query.type === "all") {
    const { from, to } = requireDateRange(req);
    const report = await getAllRangeReportData({ from, to, generatedBy: req.user });
    return sendReportPdf(res, report, `attendance-${from}-to-${to}.pdf`);
  }
  return monthlyPdf(req, res);
});

const customExcel = asyncHandler(async (req, res) => {
  if (req.query.type === "employee") {
    const { from, to } = requireDateRange(req);
    const report = await getEmployeeReportData({
      employeeIdentifier: req.query.employeeId,
      from,
      to,
      generatedBy: req.user
    });
    return sendReportExcel(res, report, `employee-attendance-${report.employee.employeeId}.xlsx`);
  }
  if (req.query.type === "department") {
    const { from, to } = requireDateRange(req);
    const report = await getDepartmentReportData({
      department: req.query.department,
      from,
      to,
      generatedBy: req.user
    });
    return sendReportExcel(res, report, `department-attendance-${req.query.department}.xlsx`);
  }
  if (req.query.type === "all") {
    const { from, to } = requireDateRange(req);
    const report = await getAllRangeReportData({ from, to, generatedBy: req.user });
    return sendReportExcel(res, report, `attendance-${from}-to-${to}.xlsx`);
  }
  const report = await getMonthlyReportData({
    month: req.query.month || new Date().getMonth() + 1,
    year: req.query.year || new Date().getFullYear(),
    generatedBy: req.user
  });
  return sendReportExcel(res, report, `monthly-attendance-${report.year}-${report.month}.xlsx`);
});

module.exports = {
  customExcel,
  customPdf,
  departmentExcel,
  departmentPdf,
  employeeExcel,
  employeePdf,
  getCustomReport,
  getDepartmentReport,
  getEmployeeReport,
  getMonthlyReport,
  monthlyExcel,
  monthlyPdf
};
