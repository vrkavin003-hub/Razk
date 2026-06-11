const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "..", "uploads");

const ensureDirectory = (directory) => {
  fs.mkdirSync(directory, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = req.uploadFolder || "images";
    const destination = path.join(uploadRoot, folder);
    ensureDirectory(destination);
    cb(null, destination);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "-");
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024)
  },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      cb(new Error("Only image, PDF, DOC, and DOCX files are allowed"));
      return;
    }
    cb(null, true);
  }
});

const fileUrl = (file, folder = "images") => (file ? `/uploads/${folder}/${file.filename}` : "");

module.exports = {
  fileUrl,
  upload
};
