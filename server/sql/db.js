const mysql = require("mysql2/promise");

let pool;

const required = (name, fallback = "") => {
  const value = process.env[name] || fallback;
  if (!value) throw new Error(`${name} is required for MySQL mode`);
  return value;
};

const createPool = () => {
  if (pool) return pool;

  pool = mysql.createPool({
    host: required("MYSQL_HOST", "127.0.0.1"),
    port: Number(process.env.MYSQL_PORT || 3306),
    user: required("MYSQL_USER"),
    password: required("MYSQL_PASSWORD"),
    database: required("MYSQL_DATABASE", "hyatech_db"),
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    namedPlaceholders: true,
    timezone: "Z",
    charset: "utf8mb4"
  });

  return pool;
};

const connectSql = async () => {
  const connection = await createPool().getConnection();
  try {
    await connection.ping();
    console.log(`MySQL connected: ${process.env.MYSQL_HOST || "127.0.0.1"}/${process.env.MYSQL_DATABASE || "hyatech_db"}`);
  } finally {
    connection.release();
  }
};

const query = async (sql, params = {}) => {
  const [rows] = await createPool().execute(sql, params);
  return rows;
};

const transaction = async (handler) => {
  const connection = await createPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  connectSql,
  createPool,
  query,
  transaction
};
