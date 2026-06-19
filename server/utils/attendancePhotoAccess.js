const fs = require("fs");
const { Readable } = require("stream");
const { resolveLocalUploadPath } = require("./uploadStorage");

const canViewAttendancePhoto = (attendance, user) => {
  if (!attendance || !user) return false;
  if (["admin", "hr"].includes(user.role)) return true;
  return String(attendance.employee?._id || attendance.employee) === String(user._id);
};

const cloudinaryUrl = (value) => {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com" ? url : null;
  } catch {
    return null;
  }
};

const sendAttendancePhoto = async (attendance, res) => {
  const photoUrl = String(attendance?.checkInPhoto || "").trim();
  if (!photoUrl) {
    const error = new Error("Attendance photo not found");
    error.statusCode = 404;
    throw error;
  }

  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (
    attendance.checkInPhotoProvider === "local" ||
    photoUrl.startsWith("/uploads/")
  ) {
    const absolutePath = resolveLocalUploadPath(
      attendance.checkInPhotoPublicId || photoUrl
    );
    try {
      await fs.promises.access(absolutePath, fs.constants.R_OK);
    } catch {
      const error = new Error("Attendance photo is unavailable");
      error.statusCode = 404;
      throw error;
    }
    res.sendFile(absolutePath);
    return;
  }

  const url = cloudinaryUrl(photoUrl);
  if (!url) {
    const error = new Error("Attendance photo URL is invalid");
    error.statusCode = 404;
    throw error;
  }

  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(Number(process.env.ATTENDANCE_PHOTO_TIMEOUT_MS || 10000))
  });
  if (!response.ok || !response.body) {
    const error = new Error("Attendance photo is unavailable");
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }

  const contentType = String(response.headers.get("content-type") || "");
  if (!contentType.startsWith("image/")) {
    const error = new Error("Attendance photo response is not an image");
    error.statusCode = 502;
    throw error;
  }

  res.status(200);
  res.setHeader("Content-Type", contentType);
  const contentLength = response.headers.get("content-length");
  if (contentLength) res.setHeader("Content-Length", contentLength);
  Readable.fromWeb(response.body).pipe(res);
};

module.exports = {
  canViewAttendancePhoto,
  sendAttendancePhoto
};
