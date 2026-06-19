const DEVICE_ID_KEY = "razk_device_id";
const DEVICE_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;
let inMemoryDeviceId = "";

const createDeviceId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `razk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const readStorage = (storage) => {
  try {
    return storage?.getItem(DEVICE_ID_KEY) || "";
  } catch {
    return "";
  }
};

const readDeviceCookie = () => {
  try {
    const prefix = `${DEVICE_ID_KEY}=`;
    const match = String(document.cookie || "")
      .split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : "";
  } catch {
    return "";
  }
};

const persistDeviceId = (deviceId) => {
  try {
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {
    // Cookie and session storage remain available as recovery stores.
  }
  try {
    sessionStorage.setItem(DEVICE_ID_KEY, deviceId);
  } catch {
    // The in-memory value remains stable for the current page lifecycle.
  }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${DEVICE_ID_KEY}=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${DEVICE_ID_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Storage may be restricted; do not rotate the current in-memory identity.
  }
};

export const getDeviceInfo = () => {
  const deviceId =
    readStorage(globalThis.localStorage) ||
    readDeviceCookie() ||
    readStorage(globalThis.sessionStorage) ||
    inMemoryDeviceId ||
    createDeviceId();
  inMemoryDeviceId = deviceId;
  persistDeviceId(deviceId);

  const platform = navigator.userAgentData?.platform || navigator.platform || "Unknown platform";
  const userAgent = navigator.userAgent || "";
  const mobileLabel = /Android/i.test(userAgent)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(userAgent)
      ? "iOS"
      : /Windows/i.test(userAgent)
        ? "Windows"
        : "Browser";
  const browserLabel = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Safari\//.test(userAgent)
        ? "Safari"
        : "WebView";

  return {
    deviceId,
    deviceName: `${platform} / ${browserLabel} / ${mobileLabel}`
  };
};
