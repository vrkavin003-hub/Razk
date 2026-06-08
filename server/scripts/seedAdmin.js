const dotenv = require("dotenv");
const connectDB = require("../config/db");
const User = require("../models/User");

dotenv.config();

const seedAdmin = async () => {
  await connectDB();

  const adminEmail = "admin@hyatech.com";
  const existing = await User.findOne({ email: adminEmail });

  if (existing) {
    console.log("Default admin already exists");
    process.exit(0);
  }

  await User.create({
    name: "HYA Tech Admin",
    email: adminEmail,
    password: "Admin@12345",
    role: "admin",
    employeeId: "HYA-ADMIN-001",
    department: "Administration",
    designation: "System Administrator",
    phone: "9000000000",
    joiningDate: new Date(),
    address: "HYA Tech Manufacturing Office",
    emergencyContact: "9000000001"
  });

  console.log("Default admin created");
  console.log("Email: admin@hyatech.com");
  console.log("Password: Admin@12345");
  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
