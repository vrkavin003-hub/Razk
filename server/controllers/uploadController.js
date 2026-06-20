const asyncHandler = require("../utils/asyncHandler");
const { deleteStoredFile, toStoredFileResponse } = require("../utils/uploadStorage");
const Attendance = require("../models/Attendance");

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("File is required");
  }

  res.status(201).json({ file: toStoredFileResponse(req.file) });
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
