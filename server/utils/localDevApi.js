const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const toCsv = require("./csv");
const { daysBetweenInclusive, getWorkingHours, isLateCheckIn, toDateKey } = require("./dates");
const { buildLocationDecision, normalizeAttendanceLocation, validateCoordinates } = require("./geo");
const { getShiftFromCheckIn } = require("./shifts");
const { normalizeAttendanceSite } = require("./attendanceSites");
const { normalizeDeviceId, normalizeDeviceName } = require("./deviceApproval");
const { generateToken, hashDeviceId, verifyToken } = require("./authToken");
const { logError, logInfo, logWarn } = require("./structuredLogger");
const { deleteStoredFile, isAllowedAttendancePhotoUrl, toStoredFileResponse } = require("./uploadStorage");
const { canViewAttendancePhoto, sendAttendancePhoto } = require("./attendancePhotoAccess");
const { upload } = require("../middleware/uploadMiddleware");
const {
  PAID_LEAVE_DAYS_PER_YEAR,
  PAID_PERMISSION_HOURS_PER_MONTH,
  dateRangeDays,
  monthBounds,
  permissionHours,
  splitPaidAllowance,
  yearBounds
} = require("./requestBalances");
const {
  buildDepartmentReport,
  buildEmployeeReport,
  buildMonthlyReport,
  sendReportPdf
} = require("./reportBuilder");
const { sendReportExcel } = require("./excelReportBuilder");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = process.env.LOCAL_STORE_FILE
  ? path.resolve(process.env.LOCAL_STORE_FILE)
  : path.join(DATA_DIR, "local-dev-db.json");

const json = (res, data, status = 200) => res.status(status).json(data);
const newId = () => crypto.randomUUID();

const clone = (value) => JSON.parse(JSON.stringify(value));

const createInitialData = () => ({
  users: [
    {
      _id: newId(),
      name: "Razk Automation Admin",
      email: "admin@razkautomation.com",
      password: bcrypt.hashSync("Admin@12345", 10),
      role: "admin",
      employeeId: "RAZK-ADMIN-001",
      department: "Administration",
      designation: "System Administrator",
      assignedShift: "",
      phone: "9000000000",
      joiningDate: new Date().toISOString(),
      address: "Razk Automation Manufacturing Office",
      emergencyContact: "9000000001",
      profilePhoto: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: newId(),
      name: "Demo HR",
      email: "hr@razkautomation.com",
      password: bcrypt.hashSync("HR@12345", 10),
      role: "hr",
      employeeId: "RAZK-DEMO-HR",
      department: "HR",
      designation: "HR Executive",
      assignedShift: "General Shift",
      phone: "9000000201",
      joiningDate: new Date().toISOString(),
      address: "Razk Automation Office",
      emergencyContact: "9000000202",
      profilePhoto: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: newId(),
      name: "Demo Employee",
      email: "employee@razkautomation.com",
      password: bcrypt.hashSync("Employee@123", 10),
      role: "employee",
      employeeId: "RAZK-DEMO-EMP",
      department: "Production",
      designation: "Machine Operator",
      assignedShift: "",
      phone: "9000000101",
      joiningDate: new Date().toISOString(),
      address: "Razk Automation Floor",
      emergencyContact: "9000000102",
      profilePhoto: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  officeLocations: [
    {
      _id: newId(),
      officeName: "Razk Automation",
      latitude: 12.740912,
      longitude: 77.825292,
      radiusMeters: 100,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ],
  attendance: [],
  leaves: [],
  permissions: [],
  odRequests: [],
  visitors: [],
  notifications: [],
  announcements: [
    {
      _id: newId(),
      title: "Welcome to Razk Automation HRMS",
      message: "Use this system for attendance, leave, permissions, and company updates.",
      targetRole: "all",
      createdBy: "system",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
});

const loadDb = () => {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = createInitialData();
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
};

let db = loadDb();
db.notifications = db.notifications || [];
db.announcements = db.announcements || [];
db.attendance = db.attendance || [];
db.odRequests = db.odRequests || [];
db.visitors = db.visitors || [];
db.officeLocations = db.officeLocations || [
  {
    _id: newId(),
    officeName: "Razk Automation",
    latitude: 12.740912,
    longitude: 77.825292,
    radiusMeters: 100,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
db.leaves = db.leaves || [];
db.permissions = db.permissions || [];
db.users = db.users || [];

const saveDb = () => {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const safe = clone(user);
  delete safe.password;
  delete safe.resetPasswordToken;
  delete safe.resetPasswordExpires;
  delete safe.registeredDeviceId;
  delete safe.pendingDeviceId;
  return safe;
};

const bumpTokenVersion = (user) => {
  user.tokenVersion = Number(user.tokenVersion || 0) + 1;
};

const matchUser = (id) => db.users.find((user) => user._id === id && user.isActive);

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return json(res, { message: "Not authorized, token missing" }, 401);
  }

  try {
    const decoded = verifyToken(token);
    const user = matchUser(decoded.id);
    if (!user) return json(res, { message: "Not authorized, user inactive or missing" }, 401);
    if (Number(decoded.tokenVersion || 0) !== Number(user.tokenVersion || 0)) {
      return json(res, { message: "Your session has expired. Please login again." }, 401);
    }
    if (user.role === "employee") {
      const deviceId = normalizeDeviceId(req.get("x-device-id"));
      const requestDeviceHash = deviceId ? hashDeviceId(deviceId) : "";
      const approvedDeviceHash = user.registeredDeviceId ? hashDeviceId(user.registeredDeviceId) : "";
      if (
        !deviceId ||
        user.deviceApprovalStatus !== "approved" ||
        !approvedDeviceHash ||
        decoded.deviceHash !== requestDeviceHash ||
        approvedDeviceHash !== requestDeviceHash
      ) {
        return json(res, { message: "This employee session is not valid for the approved device." }, 401);
      }
    }
    req.user = user;
    return next();
  } catch {
    return json(res, { message: "Not authorized, token invalid" }, 401);
  }
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return json(res, { message: "Forbidden: insufficient role permissions" }, 403);
    }
    return next();
  };

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const employeeSummary = (id) => {
  const employee = db.users.find((user) => user._id === id);
  if (!employee) return null;
  const { name, email, employeeId, department, designation, assignedShift, role, isActive, profilePhoto } = employee;
  return { _id: id, name, email, employeeId, department, designation, assignedShift, role, isActive, profilePhoto };
};

const populateAttendance = (record) => ({
  ...record,
  employee: employeeSummary(record.employee)
});

const populateDecision = (record) => ({
  ...record,
  employee: employeeSummary(record.employee),
  approvedBy: employeeSummary(record.approvedBy)
});

const populateNotification = (notification) => ({
  ...notification,
  createdBy: employeeSummary(notification.createdBy)
});

const activeReportEmployees = () =>
  db.users
    .filter((user) => user.isActive && ["employee", "hr"].includes(user.role))
    .map(sanitizeUser);

const localEmployeeReport = ({ employeeId, from, to, generatedBy }) => {
  const employee = db.users.find(
    (user) => user.isActive && (user.employeeId === employeeId || user._id === employeeId)
  );
  if (!employee) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }
  if (!["admin", "hr"].includes(generatedBy.role) && generatedBy._id !== employee._id && generatedBy.employeeId !== employee.employeeId) {
    const error = new Error("Employees can only access their own attendance report");
    error.statusCode = 403;
    throw error;
  }

  return buildEmployeeReport({
    employee: sanitizeUser(employee),
    attendance: db.attendance.filter((record) => record.employee === employee._id && record.date >= from && record.date <= to),
    leaves: db.leaves.filter((leave) => leave.employee === employee._id && leave.status === "Approved"),
    from,
    to,
    generatedBy: sanitizeUser(generatedBy)
  });
};

const localMonthlyReport = ({ month, year, generatedBy }) => {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const to = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);
  return buildMonthlyReport({
    employees: activeReportEmployees(),
    attendance: db.attendance.filter((record) => record.date >= from && record.date <= to),
    leaves: db.leaves.filter((leave) => leave.status === "Approved"),
    month,
    year,
    generatedBy: sanitizeUser(generatedBy)
  });
};

const localDepartmentReport = ({ department, from, to, generatedBy }) =>
  buildDepartmentReport({
    department,
    employees: activeReportEmployees().filter((employee) => employee.department === department),
    attendance: db.attendance.filter((record) => record.date >= from && record.date <= to),
    leaves: db.leaves.filter((leave) => leave.status === "Approved"),
    from,
    to,
    generatedBy: sanitizeUser(generatedBy)
  });

const localAllRangeReport = ({ from, to, generatedBy }) =>
  buildDepartmentReport({
    department: "All Departments",
    employees: activeReportEmployees(),
    attendance: db.attendance.filter((record) => record.date >= from && record.date <= to),
    leaves: db.leaves.filter((leave) => leave.status === "Approved"),
    from,
    to,
    generatedBy: sanitizeUser(generatedBy)
  });

const notificationRecipients = (targetRole) =>
  db.users
    .filter((user) => user.isActive && (targetRole === "all" || user.role === targetRole))
    .map((user) => user._id);

const hrNotificationRecipients = () =>
  db.users
    .filter((user) => user.isActive && user.role === "hr")
    .map((user) => user._id);

const notifyUsers = ({ userIds, title, message, type = "system", createdBy }) => {
  const createdAt = new Date().toISOString();
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const notifications = uniqueUserIds.map((user) => ({
    _id: newId(),
    user,
    title,
    message,
    type,
    isRead: false,
    createdBy,
    createdAt,
    updatedAt: createdAt
  }));
  db.notifications.push(...notifications);
  return notifications;
};

const approvedLeaveDaysForYear = (employeeId, dateValue = new Date(), excludeId = null) => {
  const { from, to } = yearBounds(dateValue);
  return db.leaves
    .filter((leave) => {
      if (leave.status !== "Approved" || leave.employee !== employeeId || leave._id === excludeId) return false;
      return new Date(leave.fromDate) <= to && new Date(leave.toDate) >= from;
    })
    .reduce((total, leave) => total + Number(leave.paidDays ?? dateRangeDays(leave.fromDate, leave.toDate)), 0);
};

const localLeaveBalance = (employeeId, dateValue = new Date()) => {
  const used = approvedLeaveDaysForYear(employeeId, dateValue);
  return {
    limit: PAID_LEAVE_DAYS_PER_YEAR,
    remaining: Math.max(PAID_LEAVE_DAYS_PER_YEAR - used, 0),
    used
  };
};

const approvedPermissionHoursForMonth = (employeeId, dateValue = new Date(), excludeId = null) => {
  const { from, to } = monthBounds(dateValue);
  return db.permissions
    .filter((permission) => {
      if (permission.status !== "Approved" || permission.employee !== employeeId || permission._id === excludeId) return false;
      const date = new Date(permission.date);
      return date >= from && date <= to;
    })
    .reduce((total, permission) => total + Number(permission.paidHours ?? permissionHours(permission.fromTime, permission.toTime)), 0);
};

const localPermissionBalance = (employeeId, dateValue = new Date()) => {
  const used = approvedPermissionHoursForMonth(employeeId, dateValue);
  return {
    limit: PAID_PERMISSION_HOURS_PER_MONTH,
    remaining: Math.max(PAID_PERMISSION_HOURS_PER_MONTH - used, 0),
    used
  };
};

const filteredAttendance = (query) => {
  let records = [...db.attendance];
  if (query.date) records = records.filter((record) => record.date === query.date);
  if (query.employeeId) records = records.filter((record) => record.employeeId === query.employeeId);
  if (query.employee) records = records.filter((record) => record.employee === query.employee);
  if (query.department) {
    const employees = db.users
      .filter((user) => user.department === query.department && user.isActive)
      .map((user) => user._id);
    records = records.filter((record) => employees.includes(record.employee));
  }
  return records.sort((a, b) => String(b.date).localeCompare(String(a.date)));
};

const activeOfficeLocation = () =>
  [...db.officeLocations].filter((office) => office.status === "active").sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];

const orgDashboard = () => {
  const today = toDateKey();
  const activeEmployees = db.users.filter((user) => user.isActive && ["employee", "hr"].includes(user.role));
  const todayAttendance = db.attendance.filter((record) => record.date === today);
  const totalEmployees = activeEmployees.length;
  const presentToday = todayAttendance.length;
  const absentToday = Math.max(totalEmployees - presentToday, 0);
  const lateToday = todayAttendance.filter((record) => record.status === "Late").length;
  const departments = [...new Set(activeEmployees.map((employee) => employee.department).filter(Boolean))];
  const dateKeys = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    dateKeys.push(toDateKey(date));
  }

  const weeklyAttendance = dateKeys.map((date) => {
    const records = db.attendance.filter((record) => record.date === date);
    return {
      date,
      present: records.length,
      late: records.filter((record) => record.status === "Late").length,
      absent: date === today ? absentToday : 0
    };
  });

  const departmentAttendance = departments.map((department) => {
    const employees = activeEmployees.filter((employee) => employee.department === department);
    const present = todayAttendance.filter((record) => employeeSummary(record.employee)?.department === department).length;
    return {
      department,
      total: employees.length,
      present,
      absent: Math.max(employees.length - present, 0)
    };
  });

  const firstDayOfMonth = new Date();
  firstDayOfMonth.setDate(1);
  const monthRecords = db.attendance.filter(
    (record) => record.date >= toDateKey(firstDayOfMonth) && record.date <= today
  ).length;
  const daysElapsed = daysBetweenInclusive(firstDayOfMonth, new Date());

  return {
    cards: {
      totalEmployees,
      presentToday,
      absentToday,
      lateToday,
      pendingLeaveRequests: db.leaves.filter((leave) => leave.status === "Pending").length,
      pendingODRequests: db.odRequests.filter((request) => request.status === "Pending").length,
      pendingPermissionRequests: db.permissions.filter((permission) => permission.status === "Pending").length,
      totalDepartments: departments.length,
      monthlyAttendancePercentage: totalEmployees
        ? Math.round((monthRecords / (totalEmployees * daysElapsed)) * 100)
        : 0
    },
    weeklyAttendance,
    departmentAttendance,
    leaveStatusChart: ["Pending", "Approved", "Rejected"].map((status) => ({
      status,
      count: db.leaves.filter((leave) => leave.status === status).length
    }))
  };
};

const mountLocalDevApi = (app) => {
  app.post(
    "/api/auth/login",
    asyncRoute(async (req, res) => {
      const { deviceId, deviceName, email, password } = req.body;
      const loginId = String(email || "").trim();
      let approvedDeviceId = "";
      const user = db.users.find(
        (item) =>
          item.isActive &&
          (
            item.email === loginId.toLowerCase() ||
            String(item.employeeId || "").toLowerCase() === loginId.toLowerCase()
          )
      );

      if (!user || !(await bcrypt.compare(password || "", user.password))) {
        logWarn("login_failed", { reason: "invalid_credentials" });
        return json(res, { message: "Invalid email or password" }, 401);
      }

      if (user.role === "employee") {
        if (!user.employeeId) {
          return json(res, { message: "Employee ID is not configured for this account. Please contact HR." }, 403);
        }
        if (loginId.toLowerCase() !== String(user.employeeId).toLowerCase()) {
          return json(res, { message: "Employees must login using their Employee ID" }, 400);
        }
        const normalizedDeviceId = normalizeDeviceId(deviceId);
        const normalizedDeviceName = normalizeDeviceName(deviceName);
        if (!normalizedDeviceId) {
          return json(res, { message: "A valid device ID is required for employee login" }, 400);
        }
        if (user.registeredDeviceId === normalizedDeviceId) {
          if (user.deviceApprovalStatus !== "approved") {
            user.deviceApprovalStatus = "approved";
            bumpTokenVersion(user);
          }
          approvedDeviceId = normalizedDeviceId;
          saveDb();
        } else if (user.registeredDeviceId) {
          return json(res, { message: "This employee account is registered to another device. Please contact HR." }, 403);
        } else {
          if (user.deviceApprovalStatus === "rejected") {
            return json(res, { message: "Your device approval request was rejected by HR. Please contact HR." }, 403);
          }
          if (user.deviceApprovalStatus === "pending" && user.pendingDeviceId && user.pendingDeviceId !== normalizedDeviceId) {
            return json(res, { message: "A device approval request is already pending for this employee. Please contact HR." }, 403);
          }
          if (user.deviceApprovalStatus === "pending" && user.pendingDeviceId === normalizedDeviceId) {
            return json(res, {
              requiresDeviceApproval: true,
              message: "Your device approval request is pending with HR. You can login after HR approves this device."
            }, 202);
          }
          user.pendingDeviceId = normalizedDeviceId;
          user.pendingDeviceName = normalizedDeviceName;
          user.deviceRequestedAt = new Date().toISOString();
          user.deviceApprovalStatus = "pending";
          delete user.deviceRejectedAt;
          delete user.deviceRejectedBy;
          saveDb();
          logInfo("device_approval_requested", { userId: user._id });
          return json(res, {
            requiresDeviceApproval: true,
            message: "Your device approval request has been sent to HR. You can login after HR approves this device."
          }, 202);
        }
      }

      logInfo("login_succeeded", { role: user.role, userId: user._id });
      return json(res, {
        user: sanitizeUser(user),
        token: generateToken(user, user.role === "employee" ? approvedDeviceId : "")
      });
    })
  );

  app.post(
    "/api/auth/register",
    protect,
    authorize("admin", "hr"),
    asyncRoute(async (req, res) => {
      if (!req.body.name || !req.body.email || !req.body.password) {
        return json(res, { message: "Name, email, and password are required" }, 400);
      }
      if (db.users.some((user) => user.email === String(req.body.email).toLowerCase())) {
        return json(res, { message: "email already exists" }, 400);
      }

      const user = {
        ...req.body,
        _id: newId(),
        email: String(req.body.email).toLowerCase(),
        password: await bcrypt.hash(req.body.password, 10),
        role: req.body.role || "employee",
        tokenVersion: 0,
        isActive: req.body.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(user);
      saveDb();
      return json(res, {
        user: sanitizeUser(user),
        token: user.role === "employee" ? undefined : generateToken(user)
      }, 201);
    })
  );

  app.post("/api/auth/forgot-password", (req, res) => {
    const resetToken = crypto.randomBytes(16).toString("hex");
    const user = db.users.find((item) => item.email === String(req.body.email || "").toLowerCase());
    if (user) {
      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = Date.now() + 1000 * 60 * 30;
      saveDb();
    }
    return json(res, { message: "Password reset token generated.", resetToken });
  });

  app.post(
    "/api/auth/reset-password",
    asyncRoute(async (req, res) => {
      const user = db.users.find(
        (item) => item.resetPasswordToken === req.body.token && item.resetPasswordExpires > Date.now()
      );
      if (!user) return json(res, { message: "Reset token is invalid or expired" }, 400);
      user.password = await bcrypt.hash(req.body.password, 10);
      bumpTokenVersion(user);
      delete user.resetPasswordToken;
      delete user.resetPasswordExpires;
      user.updatedAt = new Date().toISOString();
      saveDb();
      return json(res, { message: "Password reset successful" });
    })
  );

  app.get("/api/auth/me", protect, (req, res) => json(res, { user: sanitizeUser(req.user) }));

  app.put(
    "/api/auth/change-password",
    protect,
    asyncRoute(async (req, res) => {
      const { confirmNewPassword, currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return json(res, { message: "Current password, new password, and confirm password are required" }, 400);
      }
      if (newPassword !== confirmNewPassword) {
        return json(res, { message: "New password and confirm password do not match" }, 400);
      }
      if (!(await bcrypt.compare(currentPassword, req.user.password))) {
        return json(res, { message: "Current password is incorrect" }, 401);
      }
      req.user.password = await bcrypt.hash(newPassword, 10);
      bumpTokenVersion(req.user);
      req.user.updatedAt = new Date().toISOString();
      saveDb();
      return json(res, { message: "Password changed successfully" });
    })
  );

  app.post(
    "/api/uploads/image",
    protect,
    (req, _res, next) => {
      req.uploadFolder = "images";
      next();
    },
    upload.single("file"),
    asyncRoute(async (req, res) => {
      if (!req.file) return json(res, { message: "File is required" }, 400);
      return json(res, { file: toStoredFileResponse(req.file) }, 201);
    })
  );

  app.post(
    "/api/uploads/document",
    protect,
    (req, _res, next) => {
      req.uploadFolder = "documents";
      next();
    },
    upload.single("file"),
    asyncRoute(async (req, res) => {
      if (!req.file) return json(res, { message: "File is required" }, 400);
      return json(res, { file: toStoredFileResponse(req.file) }, 201);
    })
  );

  app.delete(
    "/api/uploads",
    protect,
    asyncRoute(async (req, res) => {
      if (
        req.body.publicId &&
        db.attendance.some((record) => record.checkInPhotoPublicId === req.body.publicId)
      ) {
        return json(res, { message: "This upload is already attached to an attendance record" }, 409);
      }
      const deleted = await deleteStoredFile({
        folder: req.body.folder || "images",
        provider: req.body.provider,
        publicId: req.body.publicId,
        resourceType: req.body.resourceType,
        userId: req.user._id
      });
      return json(res, { deleted });
    })
  );

  app.get("/api/employees", protect, authorize("admin", "hr"), (req, res) => {
    let employees = db.users.filter((user) => user.isActive);
    if (req.query.role) employees = employees.filter((user) => user.role === req.query.role);
    if (req.query.department) employees = employees.filter((user) => user.department === req.query.department);
    if (req.query.search) {
      const search = String(req.query.search).toLowerCase();
      employees = employees.filter((user) =>
        [user.name, user.email, user.employeeId].some((value) => String(value || "").toLowerCase().includes(search))
      );
    }
    return json(res, { employees: employees.map(sanitizeUser).reverse() });
  });

  app.post(
    "/api/employees",
    protect,
    authorize("admin", "hr"),
    asyncRoute(async (req, res) => {
      if (!req.body.name || !req.body.email || !req.body.password || !req.body.employeeId) {
        return json(res, { message: "Name, email, password, and employee ID are required" }, 400);
      }
      if (db.users.some((user) => user.email === String(req.body.email).toLowerCase())) {
        return json(res, { message: "email already exists" }, 400);
      }
      if (db.users.some((user) => user.employeeId === req.body.employeeId)) {
        return json(res, { message: "employeeId already exists" }, 400);
      }

      const employee = {
        ...req.body,
        _id: newId(),
        email: String(req.body.email).toLowerCase(),
        password: await bcrypt.hash(req.body.password, 10),
        role: req.body.role || "employee",
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(employee);
      saveDb();
      return json(res, { employee: sanitizeUser(employee) }, 201);
    })
  );

  app.get("/api/employees/:id", protect, (req, res) => {
    if (req.user.role === "employee" && req.user._id !== req.params.id) {
      return json(res, { message: "Employees can only view their own profile" }, 403);
    }
    const employee = matchUser(req.params.id);
    if (!employee) return json(res, { message: "Employee not found" }, 404);
    return json(res, { employee: sanitizeUser(employee) });
  });

  app.put(
    "/api/employees/:id",
    protect,
    asyncRoute(async (req, res) => {
      const employee = matchUser(req.params.id);
      if (!employee) return json(res, { message: "Employee not found" }, 404);
      if (req.user.role === "employee" && req.user._id !== employee._id) {
        return json(res, { message: "Employees can only update their own profile" }, 403);
      }

      const selfFields = ["name", "phone", "address", "emergencyContact", "profilePhoto"];
      const adminFields = [
        "name",
        "email",
        "password",
        "role",
        "employeeId",
        "department",
        "designation",
        "assignedShift",
        "weeklyWeekOffDay",
        "phone",
        "joiningDate",
        "address",
        "emergencyContact",
        "profilePhoto",
        "isActive"
      ];
      const fields = req.user.role === "employee" ? selfFields : adminFields;
      const invalidateSession =
        req.user.role !== "employee" &&
        ((Object.prototype.hasOwnProperty.call(req.body, "password") && Boolean(req.body.password)) ||
          (Object.prototype.hasOwnProperty.call(req.body, "role") && req.body.role !== employee.role));

      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          employee[field] = field === "password" && req.body[field] ? await bcrypt.hash(req.body[field], 10) : req.body[field];
        }
      }
      if (invalidateSession) bumpTokenVersion(employee);
      employee.updatedAt = new Date().toISOString();
      saveDb();
      return json(res, { employee: sanitizeUser(employee) });
    })
  );

  app.get("/api/employees/device-requests/pending", protect, authorize("hr"), (req, res) => {
    const requests = db.users
      .filter((user) => user.isActive && user.role === "employee" && user.deviceApprovalStatus === "pending")
      .map(sanitizeUser)
      .sort((a, b) => String(a.deviceRequestedAt).localeCompare(String(b.deviceRequestedAt)));
    return json(res, { requests });
  });

  app.patch("/api/employees/:id/device/approve", protect, authorize("hr"), (req, res) => {
    const employee = matchUser(req.params.id);
    if (!employee || employee.role !== "employee" || employee.deviceApprovalStatus !== "pending" || !employee.pendingDeviceId) {
      return json(res, { message: "Employee device request not found" }, 404);
    }
    employee.registeredDeviceId = employee.pendingDeviceId;
    employee.registeredDeviceName = employee.pendingDeviceName || "Unknown device";
    employee.deviceRegisteredAt = new Date().toISOString();
    employee.deviceApprovalStatus = "approved";
    employee.deviceApprovedAt = new Date().toISOString();
    employee.deviceApprovedBy = req.user._id;
    delete employee.deviceRejectedAt;
    delete employee.deviceRejectedBy;
    delete employee.pendingDeviceId;
    delete employee.pendingDeviceName;
    delete employee.deviceRequestedAt;
    bumpTokenVersion(employee);
    employee.updatedAt = new Date().toISOString();
    saveDb();
    logInfo("device_approved", { performedBy: req.user._id, userId: employee._id });
    return json(res, { employee: sanitizeUser(employee), message: "Employee device approved successfully" });
  });

  app.patch("/api/employees/:id/device/reject", protect, authorize("hr"), (req, res) => {
    const employee = matchUser(req.params.id);
    if (!employee || employee.role !== "employee" || employee.deviceApprovalStatus !== "pending") {
      return json(res, { message: "Employee device request not found" }, 404);
    }
    employee.deviceApprovalStatus = "rejected";
    employee.deviceRejectedAt = new Date().toISOString();
    employee.deviceRejectedBy = req.user._id;
    bumpTokenVersion(employee);
    employee.updatedAt = new Date().toISOString();
    saveDb();
    logInfo("device_rejected", { performedBy: req.user._id, userId: employee._id });
    return json(res, { employee: sanitizeUser(employee), message: "Employee device request rejected" });
  });

  app.patch("/api/employees/:id/reset-device", protect, authorize("hr"), (req, res) => {
    const employee = matchUser(req.params.id);
    if (!employee) return json(res, { message: "Employee not found" }, 404);
    if (employee.role !== "employee") {
      return json(res, { message: "Device reset is available only for employee accounts" }, 400);
    }
    delete employee.registeredDeviceId;
    delete employee.registeredDeviceName;
    delete employee.deviceRegisteredAt;
    delete employee.pendingDeviceId;
    delete employee.pendingDeviceName;
    delete employee.deviceRequestedAt;
    delete employee.deviceApprovedAt;
    delete employee.deviceApprovedBy;
    delete employee.deviceRejectedAt;
    delete employee.deviceRejectedBy;
    employee.deviceApprovalStatus = "none";
    employee.deviceResetAt = new Date().toISOString();
    employee.deviceResetBy = req.user._id;
    bumpTokenVersion(employee);
    employee.updatedAt = new Date().toISOString();
    saveDb();
    logInfo("device_reset", { performedBy: req.user._id, userId: employee._id });
    return json(res, { employee: sanitizeUser(employee), message: "Employee device reset successfully" });
  });

  app.delete("/api/employees/:id", protect, authorize("admin", "hr"), (req, res) => {
    const employee = matchUser(req.params.id);
    if (!employee) return json(res, { message: "Employee not found" }, 404);
    employee.isActive = false;
    employee.updatedAt = new Date().toISOString();
    saveDb();
    return json(res, { message: "Employee deactivated" });
  });

  app.get("/api/office-location", protect, (req, res) => {
    const activeOffice = activeOfficeLocation() || null;
    if (["admin", "hr"].includes(req.user.role)) {
      return json(res, { activeOffice, locations: [...db.officeLocations].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))) });
    }
    return json(res, { activeOffice });
  });

  app.get("/api/office-location/distance", protect, (req, res) => {
    try {
      const coordinates = validateCoordinates(req.query);
      const activeOffice = activeOfficeLocation();
      if (!activeOffice) return json(res, { message: "No active office location is configured" }, 400);
      return json(res, {
        activeOffice,
        decision: buildLocationDecision({ ...coordinates, office: activeOffice })
      });
    } catch (error) {
      return json(res, { message: error.message }, error.statusCode || 400);
    }
  });

  app.post("/api/office-location", protect, authorize("admin"), (req, res) => {
    try {
      const coordinates = validateCoordinates(req.body);
      const radiusMeters = Number(req.body.radiusMeters ?? req.body.radius_meters);
      const officeName = String(req.body.officeName || req.body.office_name || "").trim();
      if (!officeName) return json(res, { message: "Office name is required" }, 400);
      if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
        return json(res, { message: "Allowed radius must be a positive number" }, 400);
      }
      if (req.body.status !== "inactive") {
        db.officeLocations.forEach((office) => {
          if (office.status === "active") office.status = "inactive";
        });
      }
      const officeLocation = {
        _id: newId(),
        officeName,
        ...coordinates,
        radiusMeters,
        status: req.body.status === "inactive" ? "inactive" : "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.officeLocations.push(officeLocation);
      saveDb();
      return json(res, { officeLocation }, 201);
    } catch (error) {
      return json(res, { message: error.message }, error.statusCode || 400);
    }
  });

  app.put("/api/office-location/:id", protect, authorize("admin"), (req, res) => {
    try {
      const officeLocation = db.officeLocations.find((office) => office._id === req.params.id);
      if (!officeLocation) return json(res, { message: "Office location not found" }, 404);
      const coordinates = validateCoordinates(req.body);
      const radiusMeters = Number(req.body.radiusMeters ?? req.body.radius_meters);
      const officeName = String(req.body.officeName || req.body.office_name || "").trim();
      if (!officeName) return json(res, { message: "Office name is required" }, 400);
      if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
        return json(res, { message: "Allowed radius must be a positive number" }, 400);
      }
      if (req.body.status !== "inactive") {
        db.officeLocations.forEach((office) => {
          if (office._id !== req.params.id && office.status === "active") office.status = "inactive";
        });
      }
      Object.assign(officeLocation, {
        officeName,
        ...coordinates,
        radiusMeters,
        status: req.body.status === "inactive" ? "inactive" : "active",
        updatedAt: new Date().toISOString()
      });
      saveDb();
      return json(res, { officeLocation });
    } catch (error) {
      return json(res, { message: error.message }, error.statusCode || 400);
    }
  });

  app.post(
    "/api/attendance/check-in",
    protect,
    authorize("employee", "hr", "admin", "dri"),
    asyncRoute(async (req, res) => {
      try {
        const date = toDateKey();
        if (db.attendance.some((record) => record.employee === req.user._id && record.date === date)) {
          return json(res, { message: "You have already checked in today" }, 409);
        }
        const now = new Date();
        const location = normalizeAttendanceLocation(req.body, now);
        const attendanceSite = normalizeAttendanceSite(req.body.attendanceSite);
        if (!attendanceSite) return json(res, { message: "Select a valid attendance site: Chennai or Hosur" }, 400);
        const attendancePhoto = String(req.body.attendancePhoto || "").trim();
        if (!attendancePhoto) return json(res, { message: "Attendance photo is required for check-in" }, 400);
        if (!isAllowedAttendancePhotoUrl({
          provider: req.body.attendancePhotoProvider,
          publicId: req.body.attendancePhotoPublicId,
          url: attendancePhoto,
          userId: req.user._id
        })) {
          return json(res, { message: "Attendance photo must be uploaded before check-in" }, 400);
        }
        const requestedCaptureTime = new Date(req.body.attendancePhotoCapturedAt || now);
        if (
          Number.isNaN(requestedCaptureTime.getTime()) ||
          requestedCaptureTime.getTime() > now.getTime() + 5 * 60 * 1000 ||
          requestedCaptureTime.getTime() < now.getTime() - 24 * 60 * 60 * 1000
        ) {
          return json(res, { message: "Attendance photo capture time is invalid" }, 400);
        }
        const shiftName = getShiftFromCheckIn(now, req.user.assignedShift);
        const attendance = {
          _id: newId(),
          employee: req.user._id,
          employeeId: req.user.employeeId || req.user._id,
          date,
          checkIn: now.toISOString(),
          shiftName,
          checkInLatitude: location.latitude,
          checkInLongitude: location.longitude,
          checkInAccuracy: location.accuracy,
          checkInLocationStatus: location.locationStatus,
          checkInLocationCapturedAt: location.capturedAt.toISOString(),
          checkInDistanceMeters: null,
          attendanceSite,
          checkInPhoto: attendancePhoto,
          checkInPhotoProvider: req.body.attendancePhotoProvider || "",
          checkInPhotoPublicId: req.body.attendancePhotoPublicId || "",
          checkInPhotoResourceType: req.body.attendancePhotoResourceType || "image",
          checkInPhotoDevice: normalizeDeviceName(req.body.attendancePhotoDevice),
          checkInPhotoCapturedAt: requestedCaptureTime.toISOString(),
          checkOut: null,
          checkOutLatitude: null,
          checkOutLongitude: null,
          checkOutAccuracy: null,
          checkOutLocationStatus: "Location not available",
          checkOutLocationCapturedAt: null,
          checkOutDistanceMeters: null,
          workingHours: 0,
          status: isLateCheckIn(now) ? "Late" : "Present",
          locationNote: req.body.locationNote || "",
          remarks: req.body.remarks || "",
          createdAt: now.toISOString(),
          updatedAt: now.toISOString()
        };
        db.attendance.push(attendance);
        saveDb();
        logInfo("attendance_check_in_succeeded", { site: attendanceSite, userId: req.user._id });
        return json(res, { attendance, location, message: "Check-in marked successfully." }, 201);
      } catch (error) {
        logError("attendance_check_in_failed", { message: error.message, userId: req.user._id });
        const referencedUpload = req.body.attendancePhotoPublicId
          ? db.attendance.some((record) => record.checkInPhotoPublicId === req.body.attendancePhotoPublicId)
          : false;
        if (!referencedUpload) {
          await deleteStoredFile({
            folder: "images",
            provider: req.body.attendancePhotoProvider,
            publicId: req.body.attendancePhotoPublicId,
            resourceType: req.body.attendancePhotoResourceType,
            userId: req.user._id
          });
        }
        throw error;
      }
    })
  );

  app.post("/api/attendance/check-out", protect, authorize("employee", "hr", "admin", "dri"), (req, res) => {
    const date = toDateKey();
    const attendance = db.attendance.find((record) => record.employee === req.user._id && record.date === date);
    if (!attendance?.checkIn) return json(res, { message: "You must check in before checking out" }, 400);
    if (attendance.checkOut) return json(res, { message: "You have already checked out today" }, 409);
    const now = new Date();
    const location = normalizeAttendanceLocation(req.body, now);
    attendance.checkOut = now.toISOString();
    attendance.checkOutLatitude = location.latitude;
    attendance.checkOutLongitude = location.longitude;
    attendance.checkOutAccuracy = location.accuracy;
    attendance.checkOutLocationStatus = location.locationStatus;
    attendance.checkOutLocationCapturedAt = location.capturedAt.toISOString();
    attendance.checkOutDistanceMeters = null;
    attendance.workingHours = getWorkingHours(attendance.checkIn, now);
    attendance.status = attendance.workingHours < 4 ? "Half Day" : attendance.status;
    attendance.updatedAt = now.toISOString();
    saveDb();
    return json(res, { attendance, location, message: "Check-out marked successfully." });
  });

  app.get("/api/attendance/today", protect, (req, res) => {
    const attendance = db.attendance.find((record) => record.employee === req.user._id && record.date === toDateKey());
    return json(res, { attendance: attendance || null });
  });

  app.get(
    "/api/attendance/:id/photo",
    protect,
    asyncRoute(async (req, res) => {
      const attendance = db.attendance.find((record) => record._id === req.params.id);
      if (!attendance) return json(res, { message: "Attendance record not found" }, 404);
      if (!canViewAttendancePhoto(attendance, req.user)) {
        return json(res, { message: "You are not allowed to view this attendance photo" }, 403);
      }
      await sendAttendancePhoto(attendance, res);
    })
  );

  app.get("/api/attendance/my-history", protect, (req, res) => {
    const attendance = db.attendance
      .filter((record) => record.employee === req.user._id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return json(res, { attendance });
  });

  app.get("/api/attendance/my-attendance", protect, (req, res) => {
    const attendance = db.attendance
      .filter((record) => record.employee === req.user._id)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return json(res, { attendance });
  });

  app.get("/api/attendance/all", protect, authorize("admin", "hr"), (req, res) => {
    return json(res, { attendance: filteredAttendance(req.query).map(populateAttendance) });
  });

  app.get("/api/attendance/report", protect, authorize("admin", "hr"), (req, res) => {
    const attendance = filteredAttendance(req.query).map(populateAttendance);
    const summary = attendance.reduce(
      (acc, record) => {
        acc.total += 1;
        acc[record.status] = (acc[record.status] || 0) + 1;
        return acc;
      },
      { total: 0, Present: 0, Late: 0, "Half Day": 0, Absent: 0 }
    );
    return json(res, { attendance, summary });
  });

  app.get("/api/attendance/export-csv", protect, authorize("admin", "hr"), (req, res) => {
    const attendance = filteredAttendance(req.query).map(populateAttendance);
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
        "Site",
        "Working Hours",
        "Status",
        "Check-in Latitude",
        "Check-in Longitude",
        "Check-in Accuracy",
        "Check-in Location Status",
        "Check-out Latitude",
        "Check-out Longitude",
        "Check-out Accuracy",
        "Check-out Location Status"
      ],
      ...attendance.map((record) => [
        record.date,
        record.employeeId,
        record.employee?.name || "",
        record.employee?.department || "",
        record.employee?.designation || "",
        record.checkIn || "",
        record.checkOut || "",
        record.shiftName || getShiftFromCheckIn(record.checkIn, record.employee?.assignedShift),
        record.attendanceSite || "-",
        record.workingHours,
        record.status,
        record.checkInLatitude ?? "",
        record.checkInLongitude ?? "",
        record.checkInAccuracy ?? "",
        record.checkInLocationStatus || "",
        record.checkOutLatitude ?? "",
        record.checkOutLongitude ?? "",
        record.checkOutAccuracy ?? "",
        record.checkOutLocationStatus || "",
      ])
    ];
    res.header("Content-Type", "text/csv");
    res.attachment(`attendance-report-${toDateKey()}.csv`);
    return res.send(toCsv(rows));
  });

  app.post("/api/leave/apply", protect, authorize("employee", "dri"), (req, res) => {
    const { leaveType, fromDate, toDate, reason, attachment } = req.body;
    if (!leaveType || !fromDate || !toDate || !reason) {
      return json(res, { message: "Leave type, from date, to date, and reason are required" }, 400);
    }
    if (new Date(toDate) < new Date(fromDate)) {
      return json(res, { message: "To date cannot be before from date" }, 400);
    }
    const requestedDays = dateRangeDays(fromDate, toDate);
    const balance = localLeaveBalance(req.user._id, fromDate);
    const allowance = splitPaidAllowance(requestedDays, balance.remaining);
    const leave = {
      _id: newId(),
      employee: req.user._id,
      leaveType,
      fromDate,
      toDate,
      reason,
      attachment: attachment || "",
      requestedDays,
      paidDays: allowance.paid,
      unpaidDays: allowance.unpaid,
      yearlyPaidLeaveUsed: balance.used,
      yearlyPaidLeaveRemaining: Math.max(balance.remaining - allowance.paid, 0),
      limitExceeded: allowance.limitExceeded,
      status: "Pending",
      adminRemarks: "",
      approvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.leaves.push(leave);
    notifyUsers({
      userIds: db.users.filter((user) => user.isActive && ["admin", "hr"].includes(user.role)).map((user) => user._id),
      title: "New leave request",
      message: `${req.user.name} requested ${leaveType} from ${fromDate} to ${toDate}.`,
      type: "leave",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, {
      balance: { ...balance, remainingAfterRequest: Math.max(balance.remaining - allowance.paid, 0) },
      leave,
      warning: allowance.limitExceeded
        ? "Yearly paid leave limit exceeded. Extra leave will be unpaid or requires special approval."
        : ""
    }, 201);
  });

  app.get("/api/leave/my-requests", protect, (req, res) => {
    return json(res, {
      balance: localLeaveBalance(req.user._id),
      leaves: db.leaves.filter((leave) => leave.employee === req.user._id).map(populateDecision).reverse()
    });
  });

  app.get("/api/leave/all", protect, authorize("admin", "hr", "dri"), (req, res) => {
    let leaves = [...db.leaves];
    if (req.query.status) leaves = leaves.filter((leave) => leave.status === req.query.status);
    const balances = {};
    leaves.forEach((leave) => {
      if (!balances[leave.employee]) balances[leave.employee] = localLeaveBalance(leave.employee, leave.fromDate);
    });
    return json(res, { balances, leaves: leaves.map(populateDecision).reverse() });
  });

  const decideLeave = (status) => (req, res) => {
    const leave = db.leaves.find((item) => item._id === req.params.id);
    if (!leave) return json(res, { message: "Leave request not found" }, 404);
    const requestedDays = Number(leave.requestedDays || dateRangeDays(leave.fromDate, leave.toDate));
    const used = approvedLeaveDaysForYear(leave.employee, leave.fromDate, leave._id);
    const balance = {
      limit: PAID_LEAVE_DAYS_PER_YEAR,
      remaining: Math.max(PAID_LEAVE_DAYS_PER_YEAR - used, 0),
      used
    };
    const allowance = status === "Approved" ? splitPaidAllowance(requestedDays, balance.remaining) : { paid: leave.paidDays || 0, unpaid: leave.unpaidDays || 0, limitExceeded: leave.limitExceeded };
    leave.status = status;
    leave.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    leave.approvedBy = req.user._id;
    leave.decidedAt = new Date().toISOString();
    leave.requestedDays = requestedDays;
    leave.paidDays = allowance.paid;
    leave.unpaidDays = allowance.unpaid;
    leave.yearlyPaidLeaveUsed = balance.used;
    leave.yearlyPaidLeaveRemaining = Math.max(balance.remaining - allowance.paid, 0);
    leave.limitExceeded = allowance.limitExceeded;
    leave.updatedAt = new Date().toISOString();
    notifyUsers({
      userIds: [leave.employee, ...hrNotificationRecipients()],
      title: `Leave ${status.toLowerCase()}`,
      message: `Your leave request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "leave",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, {
      leave: populateDecision(leave),
      warning: allowance.limitExceeded
        ? "Yearly paid leave limit exceeded. Extra leave will be unpaid or requires special approval."
        : ""
    });
  };
  app.put("/api/leave/:id/approve", protect, authorize("admin", "hr", "dri"), decideLeave("Approved"));
  app.put("/api/leave/:id/reject", protect, authorize("admin", "hr", "dri"), decideLeave("Rejected"));

  app.post("/api/permission/apply", protect, authorize("employee", "dri"), (req, res) => {
    const { permissionType, date, fromTime, toTime, reason } = req.body;
    if (!permissionType || !date || !fromTime || !toTime || !reason) {
      return json(res, { message: "Permission type, date, from time, to time, and reason are required" }, 400);
    }
    const requestedHours = permissionHours(fromTime, toTime);
    if (requestedHours <= 0) return json(res, { message: "To time must be after from time" }, 400);
    const balance = localPermissionBalance(req.user._id, date);
    const allowance = splitPaidAllowance(requestedHours, balance.remaining);
    const permission = {
      _id: newId(),
      employee: req.user._id,
      permissionType,
      date,
      fromTime,
      toTime,
      reason,
      requestedHours,
      paidHours: allowance.paid,
      unpaidHours: allowance.unpaid,
      monthlyPaidPermissionUsed: balance.used,
      monthlyPaidPermissionRemaining: Math.max(balance.remaining - allowance.paid, 0),
      limitExceeded: allowance.limitExceeded,
      status: "Pending",
      adminRemarks: "",
      approvedBy: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.permissions.push(permission);
    notifyUsers({
      userIds: db.users.filter((user) => user.isActive && ["admin", "hr"].includes(user.role)).map((user) => user._id),
      title: "New permission request",
      message: `${req.user.name} requested ${permissionType} on ${date}.`,
      type: "permission",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, {
      balance: { ...balance, remainingAfterRequest: Math.max(balance.remaining - allowance.paid, 0) },
      permission,
      warning: allowance.limitExceeded
        ? "Monthly paid permission limit exceeded. Extra permission will be unpaid or requires special approval."
        : ""
    }, 201);
  });

  app.get("/api/permission/my-requests", protect, (req, res) => {
    return json(res, {
      balance: localPermissionBalance(req.user._id),
      permissions: db.permissions.filter((permission) => permission.employee === req.user._id).map(populateDecision).reverse()
    });
  });

  app.get("/api/permission/all", protect, authorize("admin", "hr", "dri"), (req, res) => {
    let permissions = [...db.permissions];
    if (req.query.status) permissions = permissions.filter((permission) => permission.status === req.query.status);
    const balances = {};
    permissions.forEach((permission) => {
      if (!balances[permission.employee]) balances[permission.employee] = localPermissionBalance(permission.employee, permission.date);
    });
    return json(res, { balances, permissions: permissions.map(populateDecision).reverse() });
  });

  const decidePermission = (status) => (req, res) => {
    const permission = db.permissions.find((item) => item._id === req.params.id);
    if (!permission) return json(res, { message: "Permission request not found" }, 404);
    const requestedHours = Number(permission.requestedHours || permissionHours(permission.fromTime, permission.toTime));
    const used = approvedPermissionHoursForMonth(permission.employee, permission.date, permission._id);
    const balance = {
      limit: PAID_PERMISSION_HOURS_PER_MONTH,
      remaining: Math.max(PAID_PERMISSION_HOURS_PER_MONTH - used, 0),
      used
    };
    const allowance = status === "Approved" ? splitPaidAllowance(requestedHours, balance.remaining) : { paid: permission.paidHours || 0, unpaid: permission.unpaidHours || 0, limitExceeded: permission.limitExceeded };
    permission.status = status;
    permission.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    permission.approvedBy = req.user._id;
    permission.decidedAt = new Date().toISOString();
    permission.requestedHours = requestedHours;
    permission.paidHours = allowance.paid;
    permission.unpaidHours = allowance.unpaid;
    permission.monthlyPaidPermissionUsed = balance.used;
    permission.monthlyPaidPermissionRemaining = Math.max(balance.remaining - allowance.paid, 0);
    permission.limitExceeded = allowance.limitExceeded;
    permission.updatedAt = new Date().toISOString();
    notifyUsers({
      userIds: [permission.employee, ...hrNotificationRecipients()],
      title: `Permission ${status.toLowerCase()}`,
      message: `Your permission request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "permission",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, {
      permission: populateDecision(permission),
      warning: allowance.limitExceeded
        ? "Monthly paid permission limit exceeded. Extra permission will be unpaid or requires special approval."
        : ""
    });
  };
  app.put("/api/permission/:id/approve", protect, authorize("admin", "hr", "dri"), decidePermission("Approved"));
  app.put("/api/permission/:id/reject", protect, authorize("admin", "hr", "dri"), decidePermission("Rejected"));

  app.get("/api/visitors", protect, authorize("admin", "hr"), (req, res) => {
    let visitors = [...db.visitors];
    if (req.query.date) {
      visitors = visitors.filter((visitor) => String(visitor.visitDate || "").slice(0, 10) === req.query.date);
    }
    visitors.sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    return json(res, { visitors });
  });

  app.post("/api/visitors", protect, authorize("admin", "hr"), (req, res) => {
    const { visitorName, mobileNumber, purposeOfVisit, personToMeet, visitDate } = req.body;
    if (!visitorName || !mobileNumber || !purposeOfVisit || !personToMeet || !visitDate) {
      return json(res, { message: "Visitor name, mobile number, purpose, person to meet, and visit date are required" }, 400);
    }
    const now = new Date().toISOString();
    const visitor = {
      _id: newId(),
      checkInTime: req.body.checkInTime || null,
      checkOutTime: req.body.checkOutTime || null,
      companyName: req.body.companyName || "",
      createdAt: now,
      createdBy: req.user._id,
      mobileNumber,
      personToMeet,
      purposeOfVisit,
      remarks: req.body.remarks || "",
      updatedAt: now,
      updatedBy: req.user._id,
      visitDate,
      visitorImage: req.body.visitorImage || "",
      visitorName
    };
    db.visitors.push(visitor);
    saveDb();
    return json(res, { visitor }, 201);
  });

  app.put("/api/visitors/:id", protect, authorize("admin", "hr"), (req, res) => {
    const visitor = db.visitors.find((item) => item._id === req.params.id);
    if (!visitor) return json(res, { message: "Visitor record not found" }, 404);
    [
      "checkInTime",
      "checkOutTime",
      "companyName",
      "mobileNumber",
      "personToMeet",
      "purposeOfVisit",
      "remarks",
      "visitDate",
      "visitorImage",
      "visitorName"
    ].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) visitor[field] = req.body[field];
    });
    visitor.updatedAt = new Date().toISOString();
    visitor.updatedBy = req.user._id;
    saveDb();
    return json(res, { visitor });
  });

  app.delete("/api/visitors/:id", protect, authorize("admin", "hr"), (req, res) => {
    const existing = db.visitors.find((item) => item._id === req.params.id);
    if (!existing) return json(res, { message: "Visitor record not found" }, 404);
    db.visitors = db.visitors.filter((item) => item._id !== req.params.id);
    saveDb();
    return json(res, { message: "Visitor record deleted" });
  });

  app.post("/api/od/apply", protect, authorize("employee", "dri"), (req, res) => {
    const { odDate, fromTime, toTime, reason, location } = req.body;
    if (!odDate || !fromTime || !toTime || !reason || !location) {
      return json(res, { message: "OD date, from time, to time, reason, and location are required" }, 400);
    }
    const now = new Date().toISOString();
    const od = {
      _id: newId(),
      adminRemarks: "",
      approvedBy: null,
      attachment: req.body.attachment || "",
      createdAt: now,
      employee: req.user._id,
      fromTime,
      location,
      odDate,
      reason,
      status: "Pending",
      toTime,
      updatedAt: now
    };
    db.odRequests.push(od);
    notifyUsers({
      userIds: db.users.filter((user) => user.isActive && ["admin", "hr"].includes(user.role)).map((user) => user._id),
      title: "New OD request",
      message: `${req.user.name} requested OD on ${odDate}.`,
      type: "od",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, { od }, 201);
  });

  app.get("/api/od/my-requests", protect, (req, res) => {
    return json(res, {
      requests: db.odRequests.filter((request) => request.employee === req.user._id).map(populateDecision).reverse()
    });
  });

  app.get("/api/od/all", protect, authorize("admin", "hr", "dri"), (req, res) => {
    let requests = [...db.odRequests];
    if (req.query.status) requests = requests.filter((request) => request.status === req.query.status);
    return json(res, { requests: requests.map(populateDecision).reverse() });
  });

  const decideOd = (status) => (req, res) => {
    const od = db.odRequests.find((item) => item._id === req.params.id);
    if (!od) return json(res, { message: "OD request not found" }, 404);
    od.status = status;
    od.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    od.approvedBy = req.user._id;
    od.decidedAt = new Date().toISOString();
    od.updatedAt = new Date().toISOString();

    if (status === "Approved") {
      const employee = employeeSummary(od.employee);
      const date = toDateKey(new Date(od.odDate));
      let attendance = db.attendance.find((record) => record.employee === od.employee && record.date === date);
      if (!attendance) {
        attendance = {
          _id: newId(),
          employee: od.employee,
          employeeId: employee?.employeeId || od.employee,
          date,
          checkIn: `${date}T${od.fromTime}:00.000Z`,
          checkOut: `${date}T${od.toTime}:00.000Z`,
          shiftName: "OD",
          checkInLatitude: null,
          checkInLongitude: null,
          checkInAccuracy: null,
          checkInLocationStatus: "Location not available",
          checkOutLatitude: null,
          checkOutLongitude: null,
          checkOutAccuracy: null,
          checkOutLocationStatus: "Location not available",
          workingHours: 0,
          createdAt: new Date().toISOString()
        };
        db.attendance.push(attendance);
      }
      attendance.status = "OD";
      attendance.remarks = `OD Approved: ${od.location} - ${od.reason}`;
      attendance.updatedAt = new Date().toISOString();
    }

    notifyUsers({
      userIds: [od.employee, ...hrNotificationRecipients()],
      title: `OD ${status.toLowerCase()}`,
      message: `Your OD request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "od",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, { od: populateDecision(od) });
  };

  app.put("/api/od/:id/approve", protect, authorize("admin", "hr", "dri"), decideOd("Approved"));
  app.put("/api/od/:id/reject", protect, authorize("admin", "hr", "dri"), decideOd("Rejected"));

  app.get("/api/announcements", protect, (req, res) => {
    const announcements = db.announcements
      .filter((announcement) => ["all", req.user.role].includes(announcement.targetRole))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return json(res, { announcements });
  });

  app.post("/api/announcements", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.body.title || !req.body.message) return json(res, { message: "Title and message are required" }, 400);
    const announcement = {
      _id: newId(),
      title: req.body.title,
      message: req.body.message,
      targetRole: req.body.targetRole || "all",
      createdBy: req.user._id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.announcements.push(announcement);
    notifyUsers({
      userIds: notificationRecipients(announcement.targetRole),
      title: announcement.title,
      message: announcement.message,
      type: "announcement",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, { announcement }, 201);
  });

  app.put("/api/announcements/:id", protect, authorize("admin", "hr"), (req, res) => {
    const announcement = db.announcements.find((item) => item._id === req.params.id);
    if (!announcement) return json(res, { message: "Announcement not found" }, 404);
    announcement.title = req.body.title ?? announcement.title;
    announcement.message = req.body.message ?? announcement.message;
    announcement.targetRole = req.body.targetRole ?? announcement.targetRole;
    announcement.updatedAt = new Date().toISOString();
    saveDb();
    return json(res, { announcement });
  });

  app.delete("/api/announcements/:id", protect, authorize("admin", "hr"), (req, res) => {
    db.announcements = db.announcements.filter((item) => item._id !== req.params.id);
    saveDb();
    return json(res, { message: "Announcement deleted" });
  });

  app.get("/api/notifications", protect, (req, res) => {
    const notifications = db.notifications
      .filter((notification) => notification.user === req.user._id)
      .filter((notification) => !req.query.type || notification.type === req.query.type)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, Number(req.query.limit) || 50)
      .map(populateNotification);

    return json(res, {
      notifications,
      unreadCount: notifications.filter((notification) => !notification.isRead).length
    });
  });

  app.get("/api/notifications/counts", protect, (req, res) => {
    if (["admin", "hr"].includes(req.user.role)) {
      return json(res, {
        odUpdateCount: db.notifications.filter(
          (notification) => notification.user === req.user._id && notification.type === "od" && !notification.isRead
        ).length,
        pendingODCount: db.odRequests.filter((request) => request.status === "Pending").length,
        pendingLeaveCount: db.leaves.filter((leave) => leave.status === "Pending").length,
        pendingPermissionCount: db.permissions.filter((permission) => permission.status === "Pending").length,
        leaveUpdateCount: db.notifications.filter(
          (notification) => notification.user === req.user._id && notification.type === "leave" && !notification.isRead
        ).length,
        permissionUpdateCount: db.notifications.filter(
          (notification) => notification.user === req.user._id && notification.type === "permission" && !notification.isRead
        ).length
      });
    }

    return json(res, {
      odUpdateCount: db.notifications.filter(
        (notification) => notification.user === req.user._id && notification.type === "od" && !notification.isRead
      ).length,
      pendingODCount: 0,
      pendingLeaveCount: 0,
      pendingPermissionCount: 0,
      leaveUpdateCount: db.notifications.filter(
        (notification) => notification.user === req.user._id && notification.type === "leave" && !notification.isRead
      ).length,
      permissionUpdateCount: db.notifications.filter(
        (notification) => notification.user === req.user._id && notification.type === "permission" && !notification.isRead
      ).length
    });
  });

  app.put("/api/notifications/mark-all-read", protect, (req, res) => {
    db.notifications.forEach((notification) => {
      if (notification.user === req.user._id && (!req.query.type || notification.type === req.query.type)) {
        notification.isRead = true;
        notification.updatedAt = new Date().toISOString();
      }
    });
    saveDb();
    return json(res, { message: "All notifications marked as read" });
  });

  app.put("/api/notifications/:id/read", protect, (req, res) => {
    const notification = db.notifications.find(
      (item) => item._id === req.params.id && item.user === req.user._id
    );
    if (!notification) return json(res, { message: "Notification not found" }, 404);
    notification.isRead = true;
    notification.updatedAt = new Date().toISOString();
    saveDb();
    return json(res, { notification: populateNotification(notification) });
  });

  app.delete("/api/notifications/:id", protect, (req, res) => {
    const existing = db.notifications.find(
      (item) => item._id === req.params.id && item.user === req.user._id
    );
    if (!existing) return json(res, { message: "Notification not found" }, 404);
    db.notifications = db.notifications.filter((item) => item._id !== existing._id);
    saveDb();
    return json(res, { message: "Notification deleted" });
  });

  app.get("/api/dashboard/admin", protect, authorize("admin"), (req, res) => json(res, orgDashboard()));
  app.get("/api/dashboard/hr", protect, authorize("hr", "admin"), (req, res) => json(res, orgDashboard()));
  app.get("/api/dashboard/employee", protect, (req, res) => {
    const today = toDateKey();
    const attendance = db.attendance.find((record) => record.employee === req.user._id && record.date === today);
    const leaveBalance = localLeaveBalance(req.user._id);
    const permissionBalance = localPermissionBalance(req.user._id);
    return json(res, {
      todayStatus: attendance?.status || "Absent",
      attendance: attendance || null,
      workingHoursToday: attendance?.workingHours || 0,
      leaveBalance: leaveBalance.remaining,
      leaveBalanceDetails: leaveBalance,
      permissionBalance,
      pendingRequests:
        db.leaves.filter((leave) => leave.employee === req.user._id && leave.status === "Pending").length +
        db.permissions.filter((permission) => permission.employee === req.user._id && permission.status === "Pending").length +
        db.odRequests.filter((request) => request.employee === req.user._id && request.status === "Pending").length,
      attendanceHistory: db.attendance
        .filter((record) => record.employee === req.user._id)
        .sort((a, b) => String(b.date).localeCompare(String(a.date))),
      announcements: db.announcements
        .filter((announcement) => ["all", "employee"].includes(announcement.targetRole))
        .slice(-5)
        .reverse()
    });
  });

  app.get("/api/reports/employee/:employeeId", protect, (req, res) => {
    if (!req.query.from || !req.query.to) return json(res, { message: "from and to query parameters are required" }, 400);
    return json(res, {
      report: localEmployeeReport({
        employeeId: req.params.employeeId,
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      })
    });
  });

  app.get("/api/reports/employee/:employeeId/pdf", protect, (req, res) => {
    if (!req.query.from || !req.query.to) return json(res, { message: "from and to query parameters are required" }, 400);
    const report = localEmployeeReport({
      employeeId: req.params.employeeId,
      from: req.query.from,
      to: req.query.to,
      generatedBy: req.user
    });
    return sendReportPdf(res, report, `employee-attendance-${report.employee.employeeId}.pdf`);
  });

  app.get("/api/reports/employee/:employeeId/excel", protect, (req, res) => {
    if (!req.query.from || !req.query.to) return json(res, { message: "from and to query parameters are required" }, 400);
    const report = localEmployeeReport({
      employeeId: req.params.employeeId,
      from: req.query.from,
      to: req.query.to,
      generatedBy: req.user
    });
    return sendReportExcel(res, report, `employee-attendance-${report.employee.employeeId}.xlsx`);
  });

  app.get("/api/reports/monthly", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.query.month || !req.query.year) return json(res, { message: "month and year query parameters are required" }, 400);
    return json(res, {
      report: localMonthlyReport({
        month: req.query.month,
        year: req.query.year,
        generatedBy: req.user
      })
    });
  });

  app.get("/api/reports/monthly/pdf", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.query.month || !req.query.year) return json(res, { message: "month and year query parameters are required" }, 400);
    const report = localMonthlyReport({
      month: req.query.month,
      year: req.query.year,
      generatedBy: req.user
    });
    return sendReportPdf(res, report, `monthly-attendance-${req.query.year}-${req.query.month}.pdf`);
  });

  app.get("/api/reports/monthly/excel", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.query.month || !req.query.year) return json(res, { message: "month and year query parameters are required" }, 400);
    const report = localMonthlyReport({
      month: req.query.month,
      year: req.query.year,
      generatedBy: req.user
    });
    return sendReportExcel(res, report, `monthly-attendance-${req.query.year}-${req.query.month}.xlsx`);
  });

  app.get("/api/reports/department/:department", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.query.from || !req.query.to) return json(res, { message: "from and to query parameters are required" }, 400);
    return json(res, {
      report: localDepartmentReport({
        department: req.params.department,
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      })
    });
  });

  app.get("/api/reports/department/:department/pdf", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.query.from || !req.query.to) return json(res, { message: "from and to query parameters are required" }, 400);
    const report = localDepartmentReport({
      department: req.params.department,
      from: req.query.from,
      to: req.query.to,
      generatedBy: req.user
    });
    return sendReportPdf(res, report, `department-attendance-${req.params.department}.pdf`);
  });

  app.get("/api/reports/department/:department/excel", protect, authorize("admin", "hr"), (req, res) => {
    if (!req.query.from || !req.query.to) return json(res, { message: "from and to query parameters are required" }, 400);
    const report = localDepartmentReport({
      department: req.params.department,
      from: req.query.from,
      to: req.query.to,
      generatedBy: req.user
    });
    return sendReportExcel(res, report, `department-attendance-${req.params.department}.xlsx`);
  });

  app.get("/api/reports/custom", protect, authorize("admin", "hr"), (req, res) => {
    if (req.query.type === "employee") {
      return json(res, {
        report: localEmployeeReport({
          employeeId: req.query.employeeId,
          from: req.query.from,
          to: req.query.to,
          generatedBy: req.user
        })
      });
    }
    if (req.query.type === "department") {
      return json(res, {
        report: localDepartmentReport({
          department: req.query.department,
          from: req.query.from,
          to: req.query.to,
          generatedBy: req.user
        })
      });
    }
    if (req.query.type === "all") {
      return json(res, {
        report: localAllRangeReport({
          from: req.query.from,
          to: req.query.to,
          generatedBy: req.user
        })
      });
    }
    return json(res, {
      report: localMonthlyReport({
        month: req.query.month,
        year: req.query.year,
        generatedBy: req.user
      })
    });
  });

  app.get("/api/reports/custom/pdf", protect, authorize("admin", "hr"), (req, res) => {
    if (req.query.type === "employee") {
      const report = localEmployeeReport({
        employeeId: req.query.employeeId,
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      });
      return sendReportPdf(res, report, `employee-attendance-${report.employee.employeeId}.pdf`);
    }
    if (req.query.type === "department") {
      const report = localDepartmentReport({
        department: req.query.department,
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      });
      return sendReportPdf(res, report, `department-attendance-${req.query.department}.pdf`);
    }
    if (req.query.type === "all") {
      const report = localAllRangeReport({
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      });
      return sendReportPdf(res, report, `attendance-${req.query.from}-to-${req.query.to}.pdf`);
    }
    const report = localMonthlyReport({
      month: req.query.month,
      year: req.query.year,
      generatedBy: req.user
    });
    return sendReportPdf(res, report, `monthly-attendance-${req.query.year}-${req.query.month}.pdf`);
  });

  app.get("/api/reports/custom/excel", protect, authorize("admin", "hr"), (req, res) => {
    if (req.query.type === "employee") {
      const report = localEmployeeReport({
        employeeId: req.query.employeeId,
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      });
      return sendReportExcel(res, report, `employee-attendance-${report.employee.employeeId}.xlsx`);
    }
    if (req.query.type === "department") {
      const report = localDepartmentReport({
        department: req.query.department,
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      });
      return sendReportExcel(res, report, `department-attendance-${req.query.department}.xlsx`);
    }
    if (req.query.type === "all") {
      const report = localAllRangeReport({
        from: req.query.from,
        to: req.query.to,
        generatedBy: req.user
      });
      return sendReportExcel(res, report, `attendance-${req.query.from}-to-${req.query.to}.xlsx`);
    }
    const report = localMonthlyReport({
      month: req.query.month,
      year: req.query.year,
      generatedBy: req.user
    });
    return sendReportExcel(res, report, `monthly-attendance-${req.query.year}-${req.query.month}.xlsx`);
  });

  console.log(`Local development data store active: ${DATA_FILE}`);
};

module.exports = mountLocalDevApi;
