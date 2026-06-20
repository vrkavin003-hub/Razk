import { getDeviceInfo } from "./device.js";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;
export const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";

const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read attendance photo"));
    };
    image.src = url;
  });

export const attendanceWatermarkLines = ({
  capturedAt = new Date(),
  deviceName = "",
  location,
  site = ""
} = {}) => {
  const requestedCaptureDate = new Date(capturedAt);
  const captureDate = Number.isNaN(requestedCaptureDate.getTime()) ? new Date() : requestedCaptureDate;
  const dateText = captureDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: ATTENDANCE_TIME_ZONE,
    year: "numeric"
  });
  const timeText = captureDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: ATTENDANCE_TIME_ZONE
  });
  const hasCoordinates =
    location?.latitude !== null &&
    location?.latitude !== undefined &&
    location?.longitude !== null &&
    location?.longitude !== undefined;
  const gpsText = hasCoordinates
    ? `${Number(location.latitude).toFixed(5)}, ${Number(location.longitude).toFixed(5)}`
    : location?.locationStatus || "Not captured";

  return [
    "Razk Automation Attendance",
    `Site: ${site || "-"}`,
    `Date: ${dateText}`,
    `Time: ${timeText}`,
    `Device: ${deviceName || getDeviceInfo().deviceName}`,
    `GPS: ${gpsText}`
  ];
};

const drawAttendanceWatermark = (context, width, height, lines) => {
  const fontSize = Math.max(14, Math.round(width * 0.026));
  const padding = Math.max(14, Math.round(width * 0.025));
  const lineHeight = Math.round(fontSize * 1.35);
  const boxHeight = lineHeight * lines.length + padding;

  context.fillStyle = "rgba(0, 0, 0, 0.68)";
  context.fillRect(0, height - boxHeight, width, boxHeight);
  context.font = `700 ${fontSize}px Arial, sans-serif`;
  context.fillStyle = "#ffffff";
  lines.forEach((line, index) => {
    context.fillText(
      line,
      padding,
      height - boxHeight + padding / 1.4 + lineHeight * (index + 0.7),
      width - padding * 2
    );
  });
};

export const createWatermarkedAttendancePhoto = async (
  file,
  { capturedAt = new Date(), location, site = "" } = {}
) => {
  if (!file) return null;
  if (!file.type?.startsWith("image/")) {
    throw new Error("Attendance photo must be an image");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Attendance photo must be below 5 MB");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  if (!width || !height) {
    throw new Error("Attendance photo has invalid dimensions");
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare attendance photo");
  }

  context.drawImage(image, 0, 0, width, height);

  drawAttendanceWatermark(
    context,
    width,
    height,
    attendanceWatermarkLines({ capturedAt, location, site })
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to prepare attendance photo"));
          return;
        }
        resolve(new File([blob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY
    );
  });
};
