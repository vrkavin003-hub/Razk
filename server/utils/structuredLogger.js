const sanitizeMetadata = (metadata = {}) =>
  Object.fromEntries(
    Object.entries(metadata).filter(
      ([key, value]) =>
        value !== undefined &&
        value !== null &&
        !["password", "token", "deviceId", "registeredDeviceId", "pendingDeviceId"].includes(key)
    )
  );

const writeLog = (level, event, metadata = {}) => {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitizeMetadata(metadata)
  };
  const output = JSON.stringify(payload);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
};

module.exports = {
  logError: (event, metadata) => writeLog("error", event, metadata),
  logInfo: (event, metadata) => writeLog("info", event, metadata),
  logWarn: (event, metadata) => writeLog("warn", event, metadata)
};
