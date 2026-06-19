const asyncHandler = require("../utils/asyncHandler");
const { logError, logInfo } = require("../utils/structuredLogger");
const { deleteStoredFile, storeUploadedFile } = require("../utils/uploadStorage");
const Attendance = require("../models/Attendance");

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("File is required");
  }

  try {
    const storedFile = await storeUploadedFile({
      file: req.file,
      folder: req.uploadFolder || "images",
      userId: req.user._id
    });
    logInfo("upload_succeeded", {
      folder: req.uploadFolder || "images",
      provider: storedFile.provider,
      size: storedFile.size,
      userId: String(req.user._id)
    });
    res.status(201).json({ file: storedFile });
  } catch (error) {
    logError("upload_failed", {
      folder: req.uploadFolder || "images",
      message: error.message,
      userId: String(req.user._id)
    });
    throw error;
  }
});

const deleteUploadedFile = asyncHandler(async (req, res) => {
  if (
    req.body.publicId &&
    await Attendance.exists({ checkInPhotoPublicId: req.body.publicId })
  ) {
    res.status(409);
    throw new Error("This upload is already attached to an attendance record");
  }
  const deleted = await deleteStoredFile({
    folder: req.body.folder || "images",
    provider: req.body.provider,
    publicId: req.body.publicId,
    resourceType: req.body.resourceType,
    userId: req.user._id
  });
  res.json({ deleted });
});

module.exports = {
  deleteUploadedFile,
  uploadFile
};
