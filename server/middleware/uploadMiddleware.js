const multer = require("multer");
const { createCloudinaryStreamStorage } = require("../storage/cloudinaryStreamStorage");
const { createLocalDiskStorage } = require("../storage/localDiskStorage");
const { useCloudStorage } = require("../utils/uploadStorage");

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const documentMimeTypes = new Set([
  ...imageMimeTypes,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const uploadValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const cloudinaryStorage = createCloudinaryStreamStorage();
const localStorage = createLocalDiskStorage();
const storage = {
  _handleFile(req, file, callback) {
    const selectedStorage = useCloudStorage() ? cloudinaryStorage : localStorage;
    selectedStorage._handleFile(req, file, callback);
  },
  _removeFile(req, file, callback) {
    const selectedStorage = file?.provider === "cloudinary" ? cloudinaryStorage : localStorage;
    selectedStorage._removeFile(req, file, callback);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = req.uploadFolder === "images" ? imageMimeTypes : documentMimeTypes;
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(uploadValidationError(req.uploadFolder === "images" ? "Only image files are allowed" : "Unsupported document type"));
      return;
    }
    cb(null, true);
  }
});

module.exports = {
  upload
};
