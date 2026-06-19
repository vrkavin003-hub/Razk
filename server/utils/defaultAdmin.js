const User = require("../models/User");

const DEFAULT_ADMIN_EMAIL = "admin@razkautomation.com";

const ensureDefaultAdmin = async () => {
  const existing = await User.findOne({ email: DEFAULT_ADMIN_EMAIL });
  if (existing) return false;

  const isProduction = process.env.NODE_ENV === "production";
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || (isProduction ? "" : "Admin@12345"));
  if (isProduction && password.length < 12) {
    throw new Error(
      "No admin account exists. Set a temporary DEFAULT_ADMIN_PASSWORD of at least 12 characters for the first deployment."
    );
  }

  await User.create({
    name: "Razk Automation Admin",
    email: DEFAULT_ADMIN_EMAIL,
    password,
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
