const Announcement = require("../models/Announcement");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const ODRequest = require("../models/ODRequest");
const PermissionRequest = require("../models/PermissionRequest");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { daysBetweenInclusive, toDateKey } = require("../utils/dates");
const { leaveBalanceForEmployee } = require("./leaveController");
const { permissionBalanceForEmployee } = require("./permissionController");

const lastSevenDateKeys = () => {
  const dates = [];
  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    dates.push(toDateKey(date));
  }
  return dates;
};

const requestStatusChart = async () => {
  const statuses = ["Pending", "Approved", "Rejected"];
  const rows = await LeaveRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]);
  return statuses.map((status) => ({
    status,
    count: rows.find((row) => row._id === status)?.count || 0
  }));
};

const buildOrgDashboard = async () => {
  const today = toDateKey();
  const activeEmployees = await User.find({ isActive: true, role: { $in: ["employee", "hr"] } });
  const totalEmployees = activeEmployees.length;
  const todayAttendance = await Attendance.find({ date: today }).populate(
    "employee",
    "department role isActive"
  );
  const presentToday = todayAttendance.length;
  const lateToday = todayAttendance.filter((item) => item.status === "Late").length;
  const absentToday = Math.max(totalEmployees - presentToday, 0);
  const pendingLeaveRequests = await LeaveRequest.countDocuments({ status: "Pending" });
  const pendingPermissionRequests = await PermissionRequest.countDocuments({ status: "Pending" });
  const pendingODRequests = await ODRequest.countDocuments({ status: "Pending" });
  const departments = [...new Set(activeEmployees.map((employee) => employee.department).filter(Boolean))];

  const dateKeys = lastSevenDateKeys();
  const weeklyAttendance = dateKeys.map((date) => {
    const records = todayAttendance.filter((record) => record.date === date);
    return {
      date,
      present: records.length,
      late: records.filter((record) => record.status === "Late").length,
      absent: date === today ? absentToday : 0
    };
  });

  if (dateKeys.some((date) => date !== today)) {
    const weekRecords = await Attendance.find({ date: { $in: dateKeys } });
    weeklyAttendance.forEach((row) => {
      const records = weekRecords.filter((record) => record.date === row.date);
      row.present = records.length;
      row.late = records.filter((record) => record.status === "Late").length;
      row.absent = row.date === today ? absentToday : 0;
    });
  }

  const departmentAttendance = departments.map((department) => {
    const departmentEmployees = activeEmployees.filter((employee) => employee.department === department);
    const present = todayAttendance.filter((record) => record.employee?.department === department).length;
    return {
      department,
      total: departmentEmployees.length,
      present,
      absent: Math.max(departmentEmployees.length - present, 0)
    };
  });

  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const monthRecords = await Attendance.countDocuments({
    date: { $gte: toDateKey(firstDayOfMonth), $lte: today }
  });
  const daysElapsed = daysBetweenInclusive(firstDayOfMonth, new Date());
  const monthlyAttendancePercentage = totalEmployees
    ? Math.round((monthRecords / (totalEmployees * daysElapsed)) * 100)
    : 0;

  return {
    cards: {
      totalEmployees,
      presentToday,
      absentToday,
      lateToday,
      pendingLeaveRequests,
      pendingODRequests,
      pendingPermissionRequests,
      totalDepartments: departments.length,
      monthlyAttendancePercentage
    },
    weeklyAttendance,
    departmentAttendance,
    leaveStatusChart: await requestStatusChart()
  };
};

const adminDashboard = asyncHandler(async (req, res) => {
  res.json(await buildOrgDashboard());
});

const hrDashboard = asyncHandler(async (req, res) => {
  res.json(await buildOrgDashboard());
});

const employeeDashboard = asyncHandler(async (req, res) => {
  const today = toDateKey();
  const [attendance, history, pendingLeaves, pendingPermissions, pendingODRequests, announcements] =
    await Promise.all([
      Attendance.findOne({ employee: req.user._id, date: today }),
      Attendance.find({ employee: req.user._id }).sort({ date: -1 }).limit(30),
      LeaveRequest.countDocuments({ employee: req.user._id, status: "Pending" }),
      PermissionRequest.countDocuments({ employee: req.user._id, status: "Pending" }),
      ODRequest.countDocuments({ employee: req.user._id, status: "Pending" }),
      Announcement.find({ targetRole: { $in: ["all", "employee"] } }).sort({ createdAt: -1 }).limit(5)
    ]);

  const leaveBalance = await leaveBalanceForEmployee(req.user._id);
  const permissionBalance = await permissionBalanceForEmployee(req.user._id);

  res.json({
    todayStatus: attendance?.status || "Absent",
    attendance,
    workingHoursToday: attendance?.workingHours || 0,
    leaveBalance: leaveBalance.remaining,
    leaveBalanceDetails: leaveBalance,
    permissionBalance,
    pendingRequests: pendingLeaves + pendingPermissions + pendingODRequests,
    attendanceHistory: history,
    announcements
  });
});

module.exports = {
  adminDashboard,
  employeeDashboard,
  hrDashboard
};
