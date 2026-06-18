const MAX_DEVICE_ID_LENGTH = 200;
const MAX_DEVICE_NAME_LENGTH = 120;

const normalizeDeviceId = (value) => {
  const deviceId = String(value || "").trim();
  if (
    !deviceId ||
    deviceId.length > MAX_DEVICE_ID_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(deviceId)
  ) {
    return "";
  }
  return deviceId;
};

const normalizeDeviceName = (value) =>
  String(value || "Unknown device")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DEVICE_NAME_LENGTH) || "Unknown device";

module.exports = {
  normalizeDeviceId,
  normalizeDeviceName
};
