const DEVICE_ID_KEY = "razk_device_id";

const createDeviceId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `razk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getDeviceInfo = () => {
  let deviceId = "";
  try {
    deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = createDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
  } catch {
    deviceId = createDeviceId();
  }

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
