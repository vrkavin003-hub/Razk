const crypto = require("crypto");
const path = require("path");
const { pipeline } = require("stream");
const { getCloudinaryClient } = require("../config/cloudinary");
const { logError, logInfo, logWarn } = require("../utils/structuredLogger");
const {
  cloudPrefix,
  safeFilename
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

const requestIdFor = (req) => {
  const requestId = String(req.requestId || req.get?.("x-request-id") || crypto.randomUUID()).slice(0, 100);
  req.requestId = requestId;
  return requestId;
};

const createCloudinaryStreamStorage = ({
  getClient = getCloudinaryClient,
  maxBytes = Number(process.env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024),
  timeoutMs = Number(process.env.UPLOAD_TIMEOUT_MS || 30000)
} = {}) => ({
  _handleFile(req, file, callback) {
    const done = once(callback);
    const startedAt = Date.now();
    const requestId = requestIdFor(req);
    const folder = req.uploadFolder || "images";
    const userId = String(req.user?._id || "");
    if (!userId) {
      done(uploadError("Authenticated upload owner is required", 401));
      return;
    }

    const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
    const rawExtension = resourceType === "raw" ? path.extname(safeFilename(file.originalname)).toLowerCase() : "";
    const publicId = `${cloudPrefix({ folder, userId })}${crypto.randomUUID()}${rawExtension}`;
    const validator = new ValidatedUploadStream({
      maxBytes,
      mimeType: file.mimetype,
      originalName: file.originalname
    });
    let cloudinaryStream;
    let failed = false;
    let cloudinaryCompleted = false;
    let cleanupAttempts = 0;

    const cleanupAsset = ({ force = false } = {}) => {
      if (!cloudinaryStream || (cleanupAttempts && !force)) return;
      cleanupAttempts += 1;
      getClient().uploader.destroy(publicId, {
        invalidate: true,
        resource_type: resourceType
      }).catch((error) => {
        logError("upload_orphan_cleanup_failed", {
          message: error.message,
          provider: "cloudinary",
          publicId,
          requestId,
          userId
        });
      });
    };

    const fail = (error, event = "upload_failed") => {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      req.off("aborted", onAborted);
      validator.destroy();
      cloudinaryStream?.destroy?.();
      cleanupAsset();
      logWarn(event, {
        durationMs: Date.now() - startedAt,
        message: error.message,
        mimeType: file.mimetype,
        provider: "cloudinary",
        requestId,
        size: validator.byteCount,
        userId
      });
      done(error);
    };

    const onAborted = () => fail(uploadError("Upload was aborted by the client", 499, "UPLOAD_ABORTED"), "upload_aborted");
    req.once("aborted", onAborted);
    const timer = setTimeout(
      () => fail(uploadError("Upload timed out", 504, "UPLOAD_TIMEOUT"), "upload_timed_out"),
      timeoutMs
    );

    try {
      const client = getClient();
      cloudinaryStream = client.uploader.upload_stream(
        {
          overwrite: false,
          public_id: publicId,
          resource_type: resourceType
        },
        (error, result) => {
          if (error) {
            fail(error);
            return;
          }
          if (cloudinaryCompleted) return;
          cloudinaryCompleted = true;
          if (failed) {
            cleanupAsset({ force: true });
            return;
          }
          clearTimeout(timer);
          req.off("aborted", onAborted);
          const storedFile = {
            filename: result.public_id.split("/").pop(),
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: validator.byteCount,
            url: result.secure_url,
            provider: "cloudinary",
            publicId: result.public_id,
            resourceType
          };
          logInfo("upload_succeeded", {
            durationMs: Date.now() - startedAt,
            folder,
            mimeType: file.mimetype,
            provider: storedFile.provider,
            requestId,
            size: storedFile.size,
            userId
          });
          done(null, storedFile);
        }
      );

      pipeline(file.stream, validator, cloudinaryStream, (error) => {
        if (error) fail(error);
      });
    } catch (error) {
      fail(error);
    }
  },

  _removeFile(_req, file, callback) {
    if (!file?.publicId || file.provider !== "cloudinary") {
      callback(null);
      return;
    }
    getClient().uploader.destroy(file.publicId, {
      invalidate: true,
      resource_type: file.resourceType === "raw" ? "raw" : "image"
    }).then(() => callback(null), callback);
  }
});

module.exports = {
  createCloudinaryStreamStorage
};
