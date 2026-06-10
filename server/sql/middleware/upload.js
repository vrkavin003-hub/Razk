const path = require("path");
const multer = require("multer");
const HttpError = require("../utils/httpError");

const resumeStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, "..", "..", "uploads", "resumes"));
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const resumeUpload = multer({
  storage: resumeStorage,
  limits: {
    fileSize: Number(process.env.MAX_RESUME_BYTES || 5 * 1024 * 1024)
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || ![".pdf", ".doc", ".docx"].includes(ext)) {
      cb(new HttpError("Resume must be a PDF, DOC, or DOCX file", 400));
      return;
    }
    cb(null, true);
  }
});

module.exports = {
  resumeUpload
};
