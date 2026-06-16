const DEFAULT_CLIENT_ORIGIN = "http://localhost:5174";
const MOBILE_WEB_VIEW_ORIGINS = ["capacitor://localhost", "ionic://localhost", "https://localhost"];

const parseList = (value, fallback = "") =>
  String(value || fallback)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const isTruthyFlag = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());

const getDatabaseMode = () => {
  const configured = String(process.env.DB_CLIENT || process.env.USE_SQL || "").trim().toLowerCase();
  const databaseUrl = String(process.env.DATABASE_URL || "").trim().toLowerCase();

  if (["sqlserver", "mssql", "sql server", "microsoft sql server"].includes(configured)) return "sqlserver";
  if (configured === "mysql" || configured === "mariadb" || process.env.USE_SQL === "true") return "mysql";
  if (databaseUrl.startsWith("sqlserver://") || databaseUrl.startsWith("mssql://")) return "sqlserver";
  if (databaseUrl.startsWith("mysql://") || databaseUrl.startsWith("mariadb://")) return "mysql";
  return "mongodb";
};

const getAllowedClientOrigins = () => {
  const origins = parseList(process.env.CLIENT_ORIGIN || process.env.CLIENT_URL || DEFAULT_CLIENT_ORIGIN);
  return origins.length ? origins : [DEFAULT_CLIENT_ORIGIN];
};

const isAllowedVercelPreviewOrigin = (origin) => {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      protocol === "https:" &&
      (hostname === "razk.vercel.app" ||
        hostname === "razk-eta.vercel.app" ||
        /^razk-[a-z0-9-]+-kavin-v-projects\.vercel\.app$/.test(hostname))
    );
  } catch {
    return false;
  }
};

const isAllowedClientOrigin = (origin, startupConfig) =>
  startupConfig.allowedClientOrigins.includes(origin) ||
  startupConfig.mobileWebViewOrigins.includes(origin) ||
  isAllowedVercelPreviewOrigin(origin);

const getStartupConfig = () => {
  const databaseMode = getDatabaseMode();
  return {
    allowLocalStore: isTruthyFlag(process.env.ALLOW_LOCAL_STORE),
    allowedClientOrigins: getAllowedClientOrigins(),
    databaseMode,
    isProduction: process.env.NODE_ENV === "production",
    mobileWebViewOrigins: MOBILE_WEB_VIEW_ORIGINS,
    port: Number(process.env.PORT || 5000),
    useSql: databaseMode === "mysql" || databaseMode === "sqlserver"
  };
};

const getEnvironmentStatus = () => ({
  CLIENT_ORIGIN: Boolean(process.env.CLIENT_ORIGIN || process.env.CLIENT_URL),
  DATABASE_URL: Boolean(process.env.DATABASE_URL),
  JWT_REFRESH_SECRET: Boolean(process.env.JWT_REFRESH_SECRET),
  JWT_SECRET: Boolean(process.env.JWT_SECRET),
  MONGO_URI: Boolean(process.env.MONGO_URI),
  MYSQL_DATABASE: Boolean(process.env.MYSQL_DATABASE),
  MYSQL_HOST: Boolean(process.env.MYSQL_HOST),
  MYSQL_PASSWORD: Boolean(process.env.MYSQL_PASSWORD),
  MYSQL_USER: Boolean(process.env.MYSQL_USER),
  SQLSERVER_DATABASE: Boolean(process.env.SQLSERVER_DATABASE),
  SQLSERVER_HOST: Boolean(process.env.SQLSERVER_HOST),
  SQLSERVER_PASSWORD: Boolean(process.env.SQLSERVER_PASSWORD),
  SQLSERVER_PORT: Boolean(process.env.SQLSERVER_PORT),
  SQLSERVER_TRUST_SERVER_CERTIFICATE: Boolean(process.env.SQLSERVER_TRUST_SERVER_CERTIFICATE),
  SQLSERVER_USER: Boolean(process.env.SQLSERVER_USER),
  PORT: Boolean(process.env.PORT)
});

const validateStartupConfiguration = (startupConfig) => {
  const missing = [];

  if (!process.env.PORT) missing.push("PORT");

  if (startupConfig.databaseMode === "sqlserver") {
    if (
      !process.env.DATABASE_URL &&
      !process.env.SQLSERVER_HOST &&
      !process.env.MYSQL_HOST
    ) {
      missing.push("DATABASE_URL");
    }
  } else if (startupConfig.databaseMode === "mysql") {
    if (!process.env.MYSQL_USER) missing.push("MYSQL_USER");
    if (!process.env.MYSQL_PASSWORD) missing.push("MYSQL_PASSWORD");
    if (!process.env.MYSQL_DATABASE) missing.push("MYSQL_DATABASE");
  } else if (!process.env.MONGO_URI && !startupConfig.allowLocalStore) {
    missing.push("MONGO_URI");
  }

  if (startupConfig.isProduction && startupConfig.allowLocalStore) {
    missing.push("ALLOW_LOCAL_STORE");
  }

  if (missing.length) {
    const error = new Error(`Missing required environment variables: ${[...new Set(missing)].join(", ")}`);
    error.statusCode = 500;
    error.missingEnv = [...new Set(missing)];
    throw error;
  }
};

module.exports = {
  isAllowedClientOrigin,
  getAllowedClientOrigins,
  getDatabaseMode,
  getEnvironmentStatus,
  getStartupConfig,
  validateStartupConfiguration
};
