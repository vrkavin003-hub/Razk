const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mssql = require("mssql");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const isTruthyFlag = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const parseServerPort = (value) => {
  const clean = String(value || "").trim().replace(/^tcp:/i, "");
  const commaMatch = clean.match(/^(.+),(\d+)$/);
  if (commaMatch) return { port: Number(commaMatch[2]), server: commaMatch[1].trim() };

  const colonMatch = clean.match(/^(.+):(\d+)$/);
  if (colonMatch && !colonMatch[1].includes("]")) return { port: Number(colonMatch[2]), server: colonMatch[1].trim() };

  return { port: undefined, server: clean };
};

const parseDatabaseUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return {};

  const normalized = raw.replace(/^sqlserver:\/\//i, "").replace(/^mssql:\/\//i, "");
  const segments = normalized.split(";").map((segment) => segment.trim()).filter(Boolean);
  const data = {};

  if (segments[0] && !segments[0].includes("=")) data.server = segments.shift();

  for (const segment of segments) {
    const index = segment.indexOf("=");
    if (index === -1) continue;
    data[segment.slice(0, index).trim().toLowerCase()] = segment.slice(index + 1).trim();
  }

  const { server, port } = parseServerPort(data.server || data.host || data["data source"] || "");
  return {
    database: data.database || data.initialcatalog,
    password: data.password || data.pwd,
    port: port || Number(data.port || 1433),
    server,
    trustServerCertificate: data.trustservercertificate,
    user: data.user || data.username || data["user id"] || data.uid
  };
};

const buildConfig = (database) => {
  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  const server = parsed.server || process.env.SQLSERVER_HOST || process.env.MYSQL_HOST || "127.0.0.1";
  const { server: normalizedServer, port: parsedPort } = parseServerPort(server);
  const user = parsed.user || process.env.SQLSERVER_USER || process.env.MYSQL_USER;
  const password = parsed.password || process.env.SQLSERVER_PASSWORD || process.env.MYSQL_PASSWORD;

  if (!user) throw new Error("SQLSERVER_USER is missing.");
  if (!password) throw new Error("SQLSERVER_PASSWORD is missing.");

  return {
    database,
    password,
    port: Number(parsed.port || parsedPort || process.env.SQLSERVER_PORT || process.env.MYSQL_PORT || 1433),
    server: normalizedServer,
    user,
    options: {
      enableArithAbort: true,
      encrypt: isTruthyFlag(process.env.SQLSERVER_ENCRYPT || false),
      trustServerCertificate: isTruthyFlag(
        process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE ?? parsed.trustServerCertificate ?? true
      )
    }
  };
};

const splitBatches = (sqlText) =>
  sqlText
    .split(/^\s*GO\s*;?\s*$/gim)
    .map((batch) => batch.trim())
    .filter(Boolean)
    .filter((batch) => !/^IF\s+DB_ID\b/i.test(batch))
    .filter((batch) => !/^USE\s+/i.test(batch));

const main = async () => {
  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  const databaseName = parsed.database || process.env.SQLSERVER_DATABASE || process.env.MYSQL_DATABASE || "razk_automation_hrms";
  const schemaPath = path.join(__dirname, "..", "database", "sqlserver-schema.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");

  const masterPool = await new mssql.ConnectionPool(buildConfig("master")).connect();
  try {
    await masterPool
      .request()
      .input("databaseName", mssql.NVarChar(128), databaseName)
      .query("IF DB_ID(@databaseName) IS NULL EXEC('CREATE DATABASE [' + @databaseName + ']')");
  } finally {
    await masterPool.close();
  }

  const appPool = await new mssql.ConnectionPool(buildConfig(databaseName)).connect();
  try {
    for (const batch of splitBatches(schemaSql)) {
      await appPool.request().query(batch);
    }
  } finally {
    await appPool.close();
  }

  console.log(`SQL Server database is ready: ${databaseName}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
