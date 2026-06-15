const User = require("../models/User");

const DEFAULT_ADMIN_EMAIL = "admin@razkautomation.com";

const ensureDefaultAdmin = async () => {
  const existing = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });
  if (existing) return false;

  await User.create({
    name: "Razk Automation Admin",
    email: DEFAULT_ADMIN_EMAIL,
    password: "Admin@12345",
    role: "admin",
    employeeId: "RAZK-ADMIN-001",
    department: "Administration",
    designation: "System Administrator",
    phone: "9000000000",
    joiningDate: new Date(),
    address: "Razk Automation Manufacturing Office",
    emergencyContact: "9000000001"
  });

  return true;
};

module.exports = {
  DEFAULT_ADMIN_EMAIL,
  ensureDefaultAdmin
};
