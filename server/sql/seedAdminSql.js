const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const { connectSql, query } = require("./db");

dotenv.config();

const seed = async () => {
  await connectSql();

  const username = process.env.SEED_ADMIN_USERNAME || "razk-admin";
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@razkautomation.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await query(`SELECT id FROM admin_users WHERE email = :email LIMIT 1`, { email });
  if (existing.length) {
    console.log(`SQL admin already exists: ${email}`);
  } else {
    await query(
      `INSERT INTO admin_users (username, email, password_hash, role, status)
       VALUES (:username, :email, :passwordHash, 'super_admin', 'active')`,
      { email, passwordHash, username }
    );
    console.log(`SQL super admin created: ${email}`);
  }

  const offices = await query(`SELECT id FROM office_locations WHERE status = 'active' LIMIT 1`);
  if (!offices.length) {
    await query(
      `INSERT INTO office_locations (office_name, latitude, longitude, radius_meters, status)
       VALUES ('Razk Automation', 12.740912, 77.825292, 100, 'active')`
    );
    console.log("Default SQL office location created: Razk Automation");
  }

  process.exit(0);
};

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
