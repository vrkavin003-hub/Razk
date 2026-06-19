const { logError, logWarn } = require("../utils/structuredLogger");

const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const isUploadLimitError = err?.name === "MulterError";
  const isDuplicateKeyError = err?.code === 11000;
  const statusCode =
    err.statusCode ||
    (isDuplicateKeyError ? 409 : 0) ||
    (isUploadLimitError ? 400 : 0) ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);
  const duplicateField = err.code === 11000 ? Object.keys(err.keyValue || {})[0] : null;
  if (req.originalUrl?.startsWith("/api/uploads")) {
    logWarn("upload_failed", {
      message: err.code === "LIMIT_FILE_SIZE" ? "Upload exceeds the configured size limit" : err.message,
      statusCode,
      userId: req.user?._id ? String(req.user._id) : undefined
    });
  }
  if (statusCode >= 500) {
    logError("request_failed", {
      message: err.message,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      userId: req.user?._id ? String(req.user._id) : undefined
    });
  }

  res.status(statusCode).json({
    message: duplicateField
      ? err.message || `${duplicateField} already exists`
      : err.code === "LIMIT_FILE_SIZE"
        ? "File is too large"
        : err.message || "Server error",
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
};

module.exports = { errorHandler, notFound };
