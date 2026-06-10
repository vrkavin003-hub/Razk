const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const path = require("path");
const toCsv = require("./csv");
const { daysBetweenInclusive, getWorkingHours, isLateCheckIn, toDateKey } = require("./dates");
const { buildLocationDecision, validateCoordinates } = require("./geo");
const {
  buildDepartmentReport,
  buildEmployeeReport,
  buildMonthlyReport,
  sendReportPdf
} = require("./reportBuilder");

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "local-dev-db.json");

const json = (res, data, status = 200) => res.status(status).json(data);
const newId = () => crypto.randomUUID();

const clone = (value) => JSON.parse(JSON.stringify(value));

const createInitialData = () => ({
  users: [
    {
      _id: newId(),
      name: "HYA Tech Admin",
      email: "admin@hyatech.com",
      password: bcrypt.hashSync("Admin@12345", 10),
      role: "admin",
      employeeId: "HYA-ADMIN-001",
      department: "Administration",
      designation: "System Administrator",
      phone: "9000000000",
      joiningDate: new Date().toISOString(),
      address: "HYA Tech Manufacturing Office",
      emergencyContact: "9000000001",
      profilePhoto: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: newId(),
      name: "Demo HR",
      email: "hr@hyatech.com",
      password: bcrypt.hashSync("HR@12345", 10),
      role: "hr",
      employeeId: "HYA-DEMO-HR",
      department: "HR",
      designation: "HR Executive",
      phone: "9000000201",
      joiningDate: new Date().toISOString(),
      address: "HYA Tech Office",
      emergencyContact: "9000000202",
      profilePhoto: "",
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      _id: newId(),
      name: "Demo Employee",
      email: "employee@hyatech.com",
      password: bcrypt.hashSync("Employee@123", 10),
      role: "employee",
      employeeId: "HYA-DEMO-EMP",
      department: "Production",
      designation: "Machine Operator",
      phone: "9000000101",
      joiningDate: new Date().toISOString(),
      address: "HYA Tech Floor",
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
      officeName: "HYA Tech",
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
  notifications: [],
  announcements: [
    {
      _id: newId(),
      title: "Welcome to HYA Tech HRMS",
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
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    return initialData;
  }

  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
};

let db = loadDb();
db.notifications = db.notifications || [];
db.announcements = db.announcements || [];
db.attendance = db.attendance || [];
db.officeLocations = db.officeLocations || [
  {
    _id: newId(),
    officeName: "HYA Tech",
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
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const safe = clone(user);
  delete safe.password;
  delete safe.resetPasswordToken;
  delete safe.resetPasswordExpires;
  return safe;
};

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || "hya-tech-local-dev-secret", {
    expiresIn: "7d"
  });

const matchUser = (id) => db.users.find((user) => user._id === id && user.isActive);
const outsideLocationMessage = "You are outside the allowed company location. Attendance cannot be marked.";

const protect = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return json(res, { message: "Not authorized, token missing" }, 401);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "hya-tech-local-dev-secret");
    const user = matchUser(decoded.id);
    if (!user) return json(res, { message: "Not authorized, user inactive or missing" }, 401);
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
  const { name, email, employeeId, department, designation, role, isActive } = employee;
  return { _id: id, name, email, employeeId, department, designation, role, isActive };
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

const validateLocalAttendanceLocation = (body) => {
  let coordinates;
  try {
    coordinates = validateCoordinates(body);
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }

  const office = activeOfficeLocation();
  if (!office) {
    const error = new Error("No active office location is configured. Please contact admin.");
    error.statusCode = 400;
    throw error;
  }

  const decision = buildLocationDecision({ ...coordinates, office });
  if (!decision.inside) {
    const error = new Error(outsideLocationMessage);
    error.statusCode = 403;
    error.details = decision;
    throw error;
  }

  return { ...coordinates, decision };
};

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
      const { email, password } = req.body;
      const user = db.users.find((item) => item.email === String(email || "").toLowerCase() && item.isActive);

      if (!user || !(await bcrypt.compare(password || "", user.password))) {
        return json(res, { message: "Invalid email or password" }, 401);
      }

      return json(res, {
        user: sanitizeUser(user),
        token: generateToken(user._id)
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
        isActive: req.body.isActive ?? true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.users.push(user);
      saveDb();
      return json(res, { user: sanitizeUser(user), token: generateToken(user._id) }, 201);
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
      delete user.resetPasswordToken;
      delete user.resetPasswordExpires;
      user.updatedAt = new Date().toISOString();
      saveDb();
      return json(res, { message: "Password reset successful" });
    })
  );

  app.get("/api/auth/me", protect, (req, res) => json(res, { user: sanitizeUser(req.user) }));

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
        "phone",
        "joiningDate",
        "address",
        "emergencyContact",
        "profilePhoto",
        "isActive"
      ];
      const fields = req.user.role === "employee" ? selfFields : adminFields;

      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          employee[field] = field === "password" && req.body[field] ? await bcrypt.hash(req.body[field], 10) : req.body[field];
        }
      }
      employee.updatedAt = new Date().toISOString();
      saveDb();
      return json(res, { employee: sanitizeUser(employee) });
    })
  );

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

  app.post("/api/attendance/check-in", protect, (req, res) => {
    const date = toDateKey();
    if (db.attendance.some((record) => record.employee === req.user._id && record.date === date)) {
      return json(res, { message: "You have already checked in today" }, 409);
    }
    let location;
    try {
      location = validateLocalAttendanceLocation(req.body);
    } catch (error) {
      return json(res, { message: error.message, location: error.details }, error.statusCode || 400);
    }
    const now = new Date();
    const attendance = {
      _id: newId(),
      employee: req.user._id,
      employeeId: req.user.employeeId || req.user._id,
      date,
      checkIn: now.toISOString(),
      checkInLatitude: location.latitude,
      checkInLongitude: location.longitude,
      checkInLocationStatus: location.decision.status,
      checkInDistanceMeters: location.decision.distanceMeters,
      checkOut: null,
      checkOutLatitude: null,
      checkOutLongitude: null,
      checkOutLocationStatus: "Unknown",
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
    return json(res, { attendance, location: location.decision }, 201);
  });

  app.post("/api/attendance/check-out", protect, (req, res) => {
    const date = toDateKey();
    const attendance = db.attendance.find((record) => record.employee === req.user._id && record.date === date);
    if (!attendance?.checkIn) return json(res, { message: "You must check in before checking out" }, 400);
    if (attendance.checkOut) return json(res, { message: "You have already checked out today" }, 409);
    let location;
    try {
      location = validateLocalAttendanceLocation(req.body);
    } catch (error) {
      return json(res, { message: error.message, location: error.details }, error.statusCode || 400);
    }
    const now = new Date();
    attendance.checkOut = now.toISOString();
    attendance.checkOutLatitude = location.latitude;
    attendance.checkOutLongitude = location.longitude;
    attendance.checkOutLocationStatus = location.decision.status;
    attendance.checkOutDistanceMeters = location.decision.distanceMeters;
    attendance.workingHours = getWorkingHours(attendance.checkIn, now);
    attendance.status = attendance.workingHours < 4 ? "Half Day" : attendance.status;
    attendance.updatedAt = now.toISOString();
    saveDb();
    return json(res, { attendance, location: location.decision });
  });

  app.get("/api/attendance/today", protect, (req, res) => {
    const attendance = db.attendance.find((record) => record.employee === req.user._id && record.date === toDateKey());
    return json(res, { attendance: attendance || null });
  });

  app.get("/api/attendance/my-history", protect, (req, res) => {
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
        "Working Hours",
        "Status",
        "Check In Location",
        "Check In Distance (m)",
        "Check Out Location",
        "Check Out Distance (m)"
      ],
      ...attendance.map((record) => [
        record.date,
        record.employeeId,
        record.employee?.name || "",
        record.employee?.department || "",
        record.employee?.designation || "",
        record.checkIn || "",
        record.checkOut || "",
        record.workingHours,
        record.status,
        record.checkInLocationStatus || "",
        record.checkInDistanceMeters ?? "",
        record.checkOutLocationStatus || "",
        record.checkOutDistanceMeters ?? ""
      ])
    ];
    res.header("Content-Type", "text/csv");
    res.attachment(`attendance-report-${toDateKey()}.csv`);
    return res.send(toCsv(rows));
  });

  app.post("/api/leave/apply", protect, (req, res) => {
    const { leaveType, fromDate, toDate, reason, attachment } = req.body;
    if (!leaveType || !fromDate || !toDate || !reason) {
      return json(res, { message: "Leave type, from date, to date, and reason are required" }, 400);
    }
    const leave = {
      _id: newId(),
      employee: req.user._id,
      leaveType,
      fromDate,
      toDate,
      reason,
      attachment: attachment || "",
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
    return json(res, { leave }, 201);
  });

  app.get("/api/leave/my-requests", protect, (req, res) => {
    return json(res, {
      leaves: db.leaves.filter((leave) => leave.employee === req.user._id).map(populateDecision).reverse()
    });
  });

  app.get("/api/leave/all", protect, authorize("admin", "hr"), (req, res) => {
    let leaves = [...db.leaves];
    if (req.query.status) leaves = leaves.filter((leave) => leave.status === req.query.status);
    return json(res, { leaves: leaves.map(populateDecision).reverse() });
  });

  const decideLeave = (status) => (req, res) => {
    const leave = db.leaves.find((item) => item._id === req.params.id);
    if (!leave) return json(res, { message: "Leave request not found" }, 404);
    leave.status = status;
    leave.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    leave.approvedBy = req.user._id;
    leave.decidedAt = new Date().toISOString();
    leave.updatedAt = new Date().toISOString();
    notifyUsers({
      userIds: [leave.employee],
      title: `Leave ${status.toLowerCase()}`,
      message: `Your leave request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "leave",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, { leave: populateDecision(leave) });
  };
  app.put("/api/leave/:id/approve", protect, authorize("admin", "hr"), decideLeave("Approved"));
  app.put("/api/leave/:id/reject", protect, authorize("admin", "hr"), decideLeave("Rejected"));

  app.post("/api/permission/apply", protect, (req, res) => {
    const { permissionType, date, fromTime, toTime, reason } = req.body;
    if (!permissionType || !date || !fromTime || !toTime || !reason) {
      return json(res, { message: "Permission type, date, from time, to time, and reason are required" }, 400);
    }
    const permission = {
      _id: newId(),
      employee: req.user._id,
      permissionType,
      date,
      fromTime,
      toTime,
      reason,
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
    return json(res, { permission }, 201);
  });

  app.get("/api/permission/my-requests", protect, (req, res) => {
    return json(res, {
      permissions: db.permissions.filter((permission) => permission.employee === req.user._id).map(populateDecision).reverse()
    });
  });

  app.get("/api/permission/all", protect, authorize("admin", "hr"), (req, res) => {
    let permissions = [...db.permissions];
    if (req.query.status) permissions = permissions.filter((permission) => permission.status === req.query.status);
    return json(res, { permissions: permissions.map(populateDecision).reverse() });
  });

  const decidePermission = (status) => (req, res) => {
    const permission = db.permissions.find((item) => item._id === req.params.id);
    if (!permission) return json(res, { message: "Permission request not found" }, 404);
    permission.status = status;
    permission.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    permission.approvedBy = req.user._id;
    permission.decidedAt = new Date().toISOString();
    permission.updatedAt = new Date().toISOString();
    notifyUsers({
      userIds: [permission.employee],
      title: `Permission ${status.toLowerCase()}`,
      message: `Your permission request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "permission",
      createdBy: req.user._id
    });
    saveDb();
    return json(res, { permission: populateDecision(permission) });
  };
  app.put("/api/permission/:id/approve", protect, authorize("admin", "hr"), decidePermission("Approved"));
  app.put("/api/permission/:id/reject", protect, authorize("admin", "hr"), decidePermission("Rejected"));

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
        pendingLeaveCount: db.leaves.filter((leave) => leave.status === "Pending").length,
        pendingPermissionCount: db.permissions.filter((permission) => permission.status === "Pending").length,
        leaveUpdateCount: 0,
        permissionUpdateCount: 0
      });
    }

    return json(res, {
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
    const approvedLeaves = db.leaves.filter((leave) => leave.employee === req.user._id && leave.status === "Approved");
    const usedLeaves = approvedLeaves.reduce((total, leave) => total + daysBetweenInclusive(leave.fromDate, leave.toDate), 0);
    return json(res, {
      todayStatus: attendance?.status || "Absent",
      attendance: attendance || null,
      workingHoursToday: attendance?.workingHours || 0,
      leaveBalance: Math.max(12 - usedLeaves, 0),
      pendingRequests:
        db.leaves.filter((leave) => leave.employee === req.user._id && leave.status === "Pending").length +
        db.permissions.filter((permission) => permission.employee === req.user._id && permission.status === "Pending").length,
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

  console.log(`Local development data store active: ${DATA_FILE}`);
};

module.exports = mountLocalDevApi;
