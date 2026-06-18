const asyncHandler = require("../utils/asyncHandler");
const User = require("../models/User");

const allowedEmployeeSelfFields = [
  "name",
  "phone",
  "address",
  "emergencyContact",
  "profilePhoto"
];

const getEmployees = asyncHandler(async (req, res) => {
  const { department, role, search } = req.query;
  const query = { isActive: true };

  if (department) query.department = department;
  if (role) query.role = role;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } }
    ];
  }

  const employees = await User.find(query).sort({ createdAt: -1 });
  res.json({ employees });
});

const getPendingDeviceRequests = asyncHandler(async (_req, res) => {
  const requests = await User.find({
    isActive: true,
    role: "employee",
    deviceApprovalStatus: "pending",
    pendingDeviceId: { $exists: true, $ne: "" }
  })
    .select("name employeeId department pendingDeviceName deviceRequestedAt deviceApprovalStatus")
    .sort({ deviceRequestedAt: 1 });

  res.json({ requests });
});

const getEmployeeById = asyncHandler(async (req, res) => {
  if (!["admin", "hr"].includes(req.user.role) && String(req.user._id) !== req.params.id) {
    res.status(403);
    throw new Error("Users can only view their own profile");
  }

  const employee = await User.findById(req.params.id);
  if (!employee || !employee.isActive) {
    res.status(404);
    throw new Error("Employee not found");
  }

  res.json({ employee });
});

const createEmployee = asyncHandler(async (req, res) => {
  const payload = req.body;

  if (!payload.name || !payload.email || !payload.password || !payload.employeeId) {
    res.status(400);
    throw new Error("Name, email, password, and employee ID are required");
  }

  const employee = await User.create({
    ...payload,
    role: payload.role || "employee"
  });

  res.status(201).json({ employee });
});

const updateEmployee = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.params.id).select("+password");

  if (!employee || !employee.isActive) {
    res.status(404);
    throw new Error("Employee not found");
  }

  if (!["admin", "hr"].includes(req.user.role)) {
    if (String(req.user._id) !== String(employee._id)) {
      res.status(403);
      throw new Error("Users can only update their own profile");
    }

    allowedEmployeeSelfFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        employee[field] = req.body[field];
      }
    });
  } else {
    const updatableFields = [
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

    updatableFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        employee[field] = req.body[field];
      }
    });
  }

  const updated = await employee.save();
  res.json({ employee: updated });
});

const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.params.id);

  if (!employee || !employee.isActive) {
    res.status(404);
    throw new Error("Employee not found");
  }

  employee.isActive = false;
  await employee.save();
  res.json({ message: "Employee deactivated" });
});

const resetEmployeeDevice = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.params.id);

  if (!employee || !employee.isActive) {
    res.status(404);
    throw new Error("Employee not found");
  }

  if (employee.role !== "employee") {
    res.status(400);
    throw new Error("Device reset is available only for employee accounts");
  }

  employee.registeredDeviceId = undefined;
  employee.registeredDeviceName = undefined;
  employee.deviceRegisteredAt = undefined;
  employee.pendingDeviceId = undefined;
  employee.pendingDeviceName = undefined;
  employee.deviceRequestedAt = undefined;
  employee.deviceApprovalStatus = "none";
  employee.deviceApprovedAt = undefined;
  employee.deviceApprovedBy = undefined;
  employee.deviceRejectedAt = undefined;
  employee.deviceRejectedBy = undefined;
  employee.deviceResetAt = new Date();
  employee.deviceResetBy = req.user._id;
  await employee.save();

  res.json({ employee, message: "Employee device reset successfully" });
});

const approveEmployeeDevice = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee || !employee.isActive || employee.role !== "employee") {
    res.status(404);
    throw new Error("Employee device request not found");
  }
  if (employee.deviceApprovalStatus !== "pending" || !employee.pendingDeviceId) {
    res.status(400);
    throw new Error("This employee has no pending device approval request");
  }

  employee.registeredDeviceId = employee.pendingDeviceId;
  employee.registeredDeviceName = employee.pendingDeviceName || "Unknown device";
  employee.deviceRegisteredAt = new Date();
  employee.deviceApprovalStatus = "approved";
  employee.deviceApprovedAt = new Date();
  employee.deviceApprovedBy = req.user._id;
  employee.deviceRejectedAt = undefined;
  employee.deviceRejectedBy = undefined;
  employee.pendingDeviceId = undefined;
  employee.pendingDeviceName = undefined;
  employee.deviceRequestedAt = undefined;
  await employee.save();

  res.json({ employee, message: "Employee device approved successfully" });
});

const rejectEmployeeDevice = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.params.id);
  if (!employee || !employee.isActive || employee.role !== "employee") {
    res.status(404);
    throw new Error("Employee device request not found");
  }
  if (employee.deviceApprovalStatus !== "pending") {
    res.status(400);
    throw new Error("This employee has no pending device approval request");
  }

  employee.deviceApprovalStatus = "rejected";
  employee.deviceApprovedAt = undefined;
  employee.deviceApprovedBy = undefined;
  employee.deviceRejectedAt = new Date();
  employee.deviceRejectedBy = req.user._id;
  await employee.save();

  res.json({ employee, message: "Employee device request rejected" });
});

module.exports = {
  approveEmployeeDevice,
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  getPendingDeviceRequests,
  rejectEmployeeDevice,
  resetEmployeeDevice,
  updateEmployee
};
