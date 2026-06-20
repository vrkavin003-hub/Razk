const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pipeline } = require("stream");
const { logInfo, logWarn } = require("../utils/structuredLogger");
const {
  getUploadRoot,
  localPrefix,
  safeFilename,
  storageFolder,
  storageOwner
} = require("../utils/uploadStorage");
const { ValidatedUploadStream, uploadError } = require("./streamValidation");

const once = (callback) => {
  let called = false;
  return (...args) => {
    if (called) return;
    called = true;
    callback(...args);
  };
};

const createLocalDiskStorage = ({
  maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
  timeoutMs = Number(process.env.UPLOAD_TIMEOUT_MS || 30000)
} = {}) => ({
  _handleFile(req, file, callback) {
    const done = once(callback);
    const startedAt = Date.now();
    req.requestId = String(req.requestId || req.get?.("x-request-id") || crypto.randomUUID());
    const folder = storageFolder(req.uploadFolder || "images");
    const userId = String(req.user?._id || "");
    if (!userId) {
      done(uploadError("Authenticated upload owner is required", 401));
      return;
    }

    const owner = storageOwner(userId);
    const directory = path.join(getUploadRoot(), folder, owner);
    const filename = `${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.originalname)}`;
    const absolutePath = path.join(directory, filename);
    const publicId = `${localPrefix({ folder, userId })}${filename}`;
    const validator = new ValidatedUploadStream({
      maxBytes,
      mimeType: file.mimetype,
      originalName: file.originalname
    });
    let output;
    let finished = false;

    const removePartial = () => fs.promises.rm(absolutePath, { force: true }).catch(() => {});
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      req.off("aborted", onAborted);
      if (error) {
        validator.destroy();
        output?.destroy?.();
        removePartial();
        logWarn(error.code === "UPLOAD_ABORTED" ? "upload_aborted" : error.code === "UPLOAD_TIMEOUT" ? "upload_timed_out" : "upload_failed", {
          durationMs: Date.now() - startedAt,
          message: error.message,
          mimeType: file.mimetype,
          provider: "local",
          requestId: req.requestId,
          size: validator.byteCount,
          userId
        });
        done(error);
        return;
      }

      const storedFile = {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: validator.byteCount,
        url: publicId,
        provider: "local",
        publicId,
        resourceType: file.mimetype.startsWith("image/") ? "image" : "raw"
      };
      logInfo("upload_succeeded", {
        durationMs: Date.now() - startedAt,
        folder,
        mimeType: file.mimetype,
        provider: "local",
        requestId: req.requestId,
        size: storedFile.size,
        userId
      });
      done(null, storedFile);
    };

    const onAborted = () => finish(uploadError("Upload was aborted by the client", 499, "UPLOAD_ABORTED"));
    req.once("aborted", onAborted);
    const timer = setTimeout(
      () => finish(uploadError("Upload timed out", 504, "UPLOAD_TIMEOUT")),
      timeoutMs
    );

    fs.promises.mkdir(directory, { recursive: true }).then(() => {
      if (finished) return;
      output = fs.createWriteStream(absolutePath, { flags: "wx" });
      pipeline(file.stream, validator, output, finish);
    }).catch(finish);
  },

  _removeFile(_req, file, callback) {
    if (!file?.publicId || file.provider !== "local") {
      callback(null);
      return;
    }
    const relativePath = String(file.publicId).replace(/^\/uploads\//, "");
    const absolutePath = path.resolve(getUploadRoot(), relativePath);
    const root = path.resolve(getUploadRoot());
    if (!absolutePath.startsWith(`${root}${path.sep}`)) {
      callback(uploadError("Invalid local upload path"));
      return;
    }
    fs.rm(absolutePath, { force: true }, callback);
  }
});

module.exports = {
  createLocalDiskStorage
};
