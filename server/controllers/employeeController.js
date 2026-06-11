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

const getEmployeeById = asyncHandler(async (req, res) => {
  if (req.user.role === "employee" && String(req.user._id) !== req.params.id) {
    res.status(403);
    throw new Error("Employees can only view their own profile");
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

  if (req.user.role === "employee") {
    if (String(req.user._id) !== String(employee._id)) {
      res.status(403);
      throw new Error("Employees can only update their own profile");
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

module.exports = {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  updateEmployee
};
