const dotenv = require("dotenv");
const connectDB = require("../config/db");
const { DEFAULT_ADMIN_EMAIL, ensureDefaultAdmin } = require("../utils/defaultAdmin");

dotenv.config();

const seedAdmin = async () => {
  await connectDB();

  if (!(await ensureDefaultAdmin())) {
    console.log("Default admin already exists");
    process.exit(0);
  }

  console.log("Default admin created");
  console.log(`Email: ${DEFAULT_ADMIN_EMAIL}`);
  console.log("Password: Admin@12345");
  process.exit(0);
};

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
