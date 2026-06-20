const path = require("path");
const { Transform } = require("stream");

const MIME_EXTENSIONS = {
  "application/msword": new Set([".doc"]),
  "application/pdf": new Set([".pdf"]),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": new Set([".docx"]),
  "image/gif": new Set([".gif"]),
  "image/jpeg": new Set([".jpeg", ".jpg"]),
  "image/png": new Set([".png"]),
  "image/webp": new Set([".webp"])
};

const signatureMatches = (mimeType, bytes) => {
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mimeType === "image/webp") {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  if (mimeType === "image/gif") {
    return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
  }
  if (mimeType === "application/pdf") {
    return bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (mimeType === "application/msword") {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    );
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  }
  return false;
};

const uploadError = (message, statusCode = 400, code = "INVALID_UPLOAD") => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const validateExtension = (originalName, mimeType) => {
  const extension = path.extname(String(originalName || "")).toLowerCase();
  const allowed = MIME_EXTENSIONS[mimeType];
  if (extension && !allowed?.has(extension)) {
    throw uploadError("Uploaded file extension does not match its declared type");
  }
};

class ValidatedUploadStream extends Transform {
  constructor({ maxBytes, mimeType, originalName }) {
    super();
    this.byteCount = 0;
    this.maxBytes = maxBytes;
    this.mimeType = mimeType;
    this.originalName = originalName;
    this.prefix = Buffer.alloc(0);
    this.validated = false;
  }

  validatePrefix() {
    if (this.validated) return;
    if (!this.byteCount) throw uploadError("Uploaded file is empty");
    validateExtension(this.originalName, this.mimeType);
    if (!signatureMatches(this.mimeType, this.prefix)) {
      throw uploadError("Uploaded file content does not match its declared type");
    }
    this.validated = true;
  }

  _transform(chunk, _encoding, callback) {
    this.byteCount += chunk.length;
    if (this.byteCount > this.maxBytes) {
      callback(uploadError("File is too large", 413, "LIMIT_FILE_SIZE"));
      return;
    }

    if (this.validated) {
      callback(null, chunk);
      return;
    }

    const needed = Math.max(12 - this.prefix.length, 0);
    this.prefix = Buffer.concat([this.prefix, chunk.subarray(0, needed)]);
    const remainder = chunk.subarray(needed);
    if (this.prefix.length < 12) {
      callback();
      return;
    }

    try {
      this.validatePrefix();
      const prefix = this.prefix;
      this.prefix = Buffer.alloc(0);
      callback(null, remainder.length ? Buffer.concat([prefix, remainder]) : prefix);
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    if (this.validated) {
      callback();
      return;
    }
    try {
      this.validatePrefix();
      const prefix = this.prefix;
      this.prefix = Buffer.alloc(0);
      callback(null, prefix);
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = {
  MIME_EXTENSIONS,
  ValidatedUploadStream,
  signatureMatches,
  uploadError,
  validateExtension
};
