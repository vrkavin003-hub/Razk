const mysql = require("mysql2/promise");
const mssql = require("mssql");
const { getDatabaseMode } = require("../config/runtime");

let mysqlPool;
let sqlServerPoolPromise;

const UPDATED_AT_TABLES = new Set([
  "admin_users",
  "announcements",
  "attendance",
  "career_applications",
  "contact_messages",
  "office_locations"
]);

const isTruthyFlag = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const parseServerPort = (value) => {
  const clean = String(value || "").trim();
  if (!clean) return { port: undefined, server: "" };

  const withoutTcp = clean.replace(/^tcp:/i, "");
  const commaMatch = withoutTcp.match(/^(.+),(\d+)$/);
  if (commaMatch) {
    return { port: Number(commaMatch[2]), server: commaMatch[1].trim() };
  }

  const colonMatch = withoutTcp.match(/^(.+):(\d+)$/);
  if (colonMatch && !colonMatch[1].includes("]")) {
    return { port: Number(colonMatch[2]), server: colonMatch[1].trim() };
  }

  return { port: undefined, server: withoutTcp };
};

const parseSqlServerConnectionUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return {};

  const normalized = raw.replace(/^sqlserver:\/\//i, "").replace(/^mssql:\/\//i, "");
  const segments = normalized.split(";").map((segment) => segment.trim()).filter(Boolean);
  const data = {};

  if (segments[0] && !segments[0].includes("=")) {
    data.server = segments.shift();
  }

  for (const segment of segments) {
    const index = segment.indexOf("=");
    if (index === -1) continue;
    const key = segment.slice(0, index).trim().toLowerCase();
    const segmentValue = segment.slice(index + 1).trim();
    data[key] = segmentValue;
  }

  const serverSource = data.server || data.host || data["data source"] || data.datasource || data.addr || data.address || "";
  const { server, port } = parseServerPort(serverSource);

  return {
    database: data.database || data.initialcatalog || process.env.SQLSERVER_DATABASE || "",
    encrypt: data.encrypt,
    password: data.password || data.pwd || process.env.SQLSERVER_PASSWORD || "",
    port: port ?? Number(data.port || process.env.SQLSERVER_PORT || 1433),
    server: server || process.env.SQLSERVER_HOST || "",
    trustServerCertificate: data.trustservercertificate,
    user: data.user || data.username || data["user id"] || data.uid || process.env.SQLSERVER_USER || ""
  };
};

const buildSqlServerConfig = () => {
  const parsed = parseSqlServerConnectionUrl(process.env.DATABASE_URL);
  const server = parsed.server || process.env.SQLSERVER_HOST || process.env.MYSQL_HOST || "127.0.0.1";
  const port = Number(parsed.port || process.env.SQLSERVER_PORT || process.env.MYSQL_PORT || 1433);
  const database = parsed.database || process.env.SQLSERVER_DATABASE || process.env.MYSQL_DATABASE || "razk_automation_hrms";
  const user = parsed.user || process.env.SQLSERVER_USER || process.env.MYSQL_USER || "";
  const password = parsed.password || process.env.SQLSERVER_PASSWORD || process.env.MYSQL_PASSWORD || "";

  if (!user) throw new Error("SQLSERVER_USER is required for SQL Server mode");
  if (!password) throw new Error("SQLSERVER_PASSWORD is required for SQL Server mode");
  if (!database) throw new Error("SQLSERVER_DATABASE is required for SQL Server mode");

  return {
    database,
    password,
    pool: {
      max: Number(process.env.SQLSERVER_POOL_MAX || process.env.MYSQL_CONNECTION_LIMIT || process.env.SQL_POOL_MAX || 10),
      min: Number(process.env.SQLSERVER_POOL_MIN || 0),
      idleTimeoutMillis: Number(process.env.SQLSERVER_POOL_IDLE_MS || 30000)
    },
    port,
    requestTimeout: Number(process.env.SQLSERVER_REQUEST_TIMEOUT_MS || process.env.MYSQL_REQUEST_TIMEOUT_MS || 15000),
    server,
    user,
    options: {
      appName: process.env.SQLSERVER_APP_NAME || "Razk Automation HRMS",
      enableArithAbort: true,
      encrypt: isTruthyFlag(process.env.SQLSERVER_ENCRYPT ?? process.env.MYSQL_SSL ?? parsed.encrypt),
      trustServerCertificate: isTruthyFlag(
        process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE ?? process.env.MYSQL_SSL_REJECT_UNAUTHORIZED ?? parsed.trustServerCertificate ?? true
      )
    }
  };
};

const createMySqlPool = () => {
  if (mysqlPool) return mysqlPool;

  mysqlPool = mysql.createPool({
    charset: "utf8mb4",
    connectionLimit: Number(process.env.MYSQL_CONNECTION_LIMIT || 10),
    database: process.env.MYSQL_DATABASE || "razkautomation_db",
    host: process.env.MYSQL_HOST || "127.0.0.1",
    namedPlaceholders: true,
    password: process.env.MYSQL_PASSWORD || "",
    port: Number(process.env.MYSQL_PORT || 3306),
    queueLimit: 0,
    ssl: isTruthyFlag(process.env.MYSQL_SSL)
      ? {
          rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED !== "false"
        }
      : undefined,
    timezone: "Z",
    user: process.env.MYSQL_USER || "",
    waitForConnections: true
  });

  return mysqlPool;
};

const createSqlServerPool = async () => {
  if (sqlServerPoolPromise) return sqlServerPoolPromise;

  const config = buildSqlServerConfig();
  sqlServerPoolPromise = new mssql.ConnectionPool(config)
    .connect()
    .then((pool) => pool)
    .catch((error) => {
      sqlServerPoolPromise = null;
      throw error;
    });

  return sqlServerPoolPromise;
};

const createPool = async () => {
  const mode = getDatabaseMode();
  if (mode === "sqlserver") return createSqlServerPool();
  if (mode === "mysql") return createMySqlPool();
  throw new Error("SQL mode is not configured");
};

const translateSqlServerQuery = (sqlText) => {
  let translated = String(sqlText || "").trim();

  translated = translated.replace(/;+\s*$/g, "");
  translated = translated.replace(/\bNOW\s*\(\s*\)/gi, "GETDATE()");
  translated = translated.replace(/\bDATE\s*\(\s*([^)]+?)\s*\)/gi, "CAST($1 AS date)");
  translated = translated.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, "@$1");

  translated = translated.replace(/^(\s*UPDATE\s+([^\s]+)\s+SET\s+)([\s\S]+)$/i, (full, prefix, tableName, remainder) => {
    const normalizedTable = String(tableName || "").replace(/[\[\]]/g, "").toLowerCase();
    if (!UPDATED_AT_TABLES.has(normalizedTable) || /updated_at\s*=/i.test(full)) {
      return full;
    }

    const whereIndex = remainder.search(/\s+WHERE\s+/i);
    const assignments = whereIndex >= 0 ? remainder.slice(0, whereIndex).trimEnd() : remainder.trimEnd();
    const tail = whereIndex >= 0 ? remainder.slice(whereIndex) : "";
    const cleanedAssignments = assignments.replace(/,\s*$/g, "");

    return `${prefix}${cleanedAssignments}${cleanedAssignments ? ", " : ""}updated_at = GETDATE()${tail}`;
  });

  const offsetLimitMatch = translated.match(/\s+LIMIT\s+(@?[A-Za-z_][A-Za-z0-9_]*|\d+)\s+OFFSET\s+(@?[A-Za-z_][A-Za-z0-9_]*|\d+)\s*$/i);
  if (offsetLimitMatch) {
    const [fragment, limitValue, offsetValue] = offsetLimitMatch;
    translated = `${translated.slice(0, -fragment.length)} OFFSET ${offsetValue} ROWS FETCH NEXT ${limitValue} ROWS ONLY`;
    return translated;
  }

  const limitMatch = translated.match(/\s+LIMIT\s+(@?[A-Za-z_][A-Za-z0-9_]*|\d+)\s*$/i);
  if (limitMatch) {
    const [fragment, limitValue] = limitMatch;
    translated = translated.slice(0, -fragment.length).trimEnd();

    if (/^\s*SELECT\s+/i.test(translated)) {
      translated = translated.replace(/^\s*SELECT\s+(DISTINCT\s+)?/i, (match, distinct = "") => `SELECT ${distinct || ""}TOP (${limitValue}) `);
    }
  }

  return translated;
};

const isSelectLike = (sqlText) => /^\s*(SELECT|WITH)\b/i.test(sqlText);
const isInsertLike = (sqlText) => /^\s*INSERT\b/i.test(sqlText);

const inferSqlType = (value) => {
  if (value === null || value === undefined) return mssql.NVarChar(mssql.MAX);
  if (value instanceof Date) return mssql.DateTime2;
  if (Buffer.isBuffer(value)) return mssql.VarBinary(mssql.MAX);

  switch (typeof value) {
    case "boolean":
      return mssql.Bit;
    case "number":
      if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) return mssql.Int;
      if (Number.isInteger(value)) return mssql.BigInt;
      return mssql.Float;
    case "object":
      return mssql.NVarChar(mssql.MAX);
    default:
      return mssql.NVarChar(mssql.MAX);
  }
};

const bindParams = (request, params = {}) => {
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    request.input(key, inferSqlType(value), value);
  }
  return request;
};

const normalizeSqlServerResult = (sqlText, result) => {
  if (isSelectLike(sqlText)) return result.recordset || [];

  const normalized = {
    affectedRows: Array.isArray(result.rowsAffected) ? result.rowsAffected.reduce((total, count) => total + count, 0) : 0,
    rowsAffected: result.rowsAffected || []
  };

  if (isInsertLike(sqlText)) {
    const firstRow = result.recordset && result.recordset[0];
    if (firstRow) {
      if (firstRow.insertId !== undefined) {
        normalized.insertId = firstRow.insertId;
      } else if (firstRow.id !== undefined) {
        normalized.insertId = firstRow.id;
      } else {
        const firstKey = Object.keys(firstRow)[0];
        if (firstKey) normalized.insertId = firstRow[firstKey];
      }
    }
  }

  return normalized;
};

const executeSqlServer = async (target, sqlText, params = {}) => {
  const translated = translateSqlServerQuery(sqlText);
  const request = bindParams(target.request(), params);
  const result = await request.query(translated);
  const normalized = normalizeSqlServerResult(translated, result);

  if (isInsertLike(translated) && !normalized.insertId) {
    try {
      const identityResult = await target.request().query("SELECT CAST(SCOPE_IDENTITY() AS bigint) AS insertId");
      const identityRow = identityResult.recordset && identityResult.recordset[0];
      if (identityRow && identityRow.insertId !== null && identityRow.insertId !== undefined) {
        normalized.insertId = identityRow.insertId;
      }
    } catch (_error) {
      // Ignore scope identity lookup failures and keep the base insert result.
    }
  }

  return normalized;
};

const executeMySql = async (target, sqlText, params = {}) => {
  const result = await target.execute(sqlText, params);
  if (Array.isArray(result)) return result[0] || [];
  return result;
};

const execute = async (target, sqlText, params = {}) => {
  const mode = getDatabaseMode();
  if (mode === "sqlserver") return executeSqlServer(target, sqlText, params);
  return executeMySql(target, sqlText, params);
};

const connectSql = async () => {
  const mode = getDatabaseMode();

  if (mode === "sqlserver") {
    const pool = await createSqlServerPool();
    await pool.request().query("SELECT 1 AS ok");
    const parsed = parseSqlServerConnectionUrl(process.env.DATABASE_URL);
    const host = parsed.server || process.env.SQLSERVER_HOST || process.env.MYSQL_HOST || "127.0.0.1";
    const database = parsed.database || process.env.SQLSERVER_DATABASE || process.env.MYSQL_DATABASE || "razk_automation_hrms";
    console.log(`SQL Server connected: ${host}/${database}`);
    return;
  }

  if (mode === "mysql") {
    const connection = await createMySqlPool().getConnection();
    try {
      await connection.ping();
      console.log(`MySQL connected: ${process.env.MYSQL_HOST || "127.0.0.1"}/${process.env.MYSQL_DATABASE || "razkautomation_db"}`);
    } finally {
      connection.release();
    }
    return;
  }

  throw new Error("SQL mode is not configured");
};

const query = async (sqlText, params = {}) => {
  const mode = getDatabaseMode();
  if (mode === "sqlserver") {
    const pool = await createSqlServerPool();
    return executeSqlServer(pool, sqlText, params);
  }

  if (mode === "mysql") {
    const [rows] = await createMySqlPool().execute(sqlText, params);
    return rows;
  }

  throw new Error("SQL mode is not configured");
};

const transaction = async (handler) => {
  const mode = getDatabaseMode();

  if (mode === "sqlserver") {
    const pool = await createSqlServerPool();
    const tx = new mssql.Transaction(pool);
    await tx.begin();

    const connection = {
      execute: async (sqlText, params = {}) => [await executeSqlServer(tx, sqlText, params), []],
      query: async (sqlText, params = {}) => executeSqlServer(tx, sqlText, params)
    };

    try {
      const result = await handler(connection);
      await tx.commit();
      return result;
    } catch (error) {
      try {
        await tx.rollback();
      } catch (_rollbackError) {
        // Ignore rollback failures during abort.
      }
      throw error;
    }
  }

  if (mode === "mysql") {
    const connection = await createMySqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const adapter = {
        execute: async (sqlText, params = {}) => [await executeMySql(connection, sqlText, params), []],
        query: async (sqlText, params = {}) => executeMySql(connection, sqlText, params)
      };
      const result = await handler(adapter);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  throw new Error("SQL mode is not configured");
};

module.exports = {
  connectSql,
  createPool,
  query,
  transaction
};
