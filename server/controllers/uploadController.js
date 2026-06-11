const asyncHandler = require("../utils/asyncHandler");
const { fileUrl } = require("../middleware/uploadMiddleware");

const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("File is required");
  }

  res.status(201).json({
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: fileUrl(req.file, req.uploadFolder || "images")
    }
  });
});

module.exports = {
  uploadFile
};
