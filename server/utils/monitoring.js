const Sentry = require("@sentry/node");
const { logInfo } = require("./structuredLogger");

let enabled = false;

const initializeMonitoring = () => {
  const dsn = String(process.env.SENTRY_DSN || "").trim();
  if (!dsn) {
    logInfo("monitoring_disabled", { provider: "sentry" });
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0)
  });
  enabled = true;
  logInfo("monitoring_enabled", { provider: "sentry" });
  return true;
};

const setupMonitoringErrorHandler = (app) => {
  if (!enabled) return;
  Sentry.setupExpressErrorHandler(app);
};

const isMonitoringEnabled = () => enabled;

module.exports = {
  initializeMonitoring,
  isMonitoringEnabled,
  setupMonitoringErrorHandler
};
