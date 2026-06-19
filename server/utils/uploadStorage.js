const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  getCloudinaryClient,
  getCloudinaryConfiguration,
  isCloudinaryConfigured
} = require("../config/cloudinary");

const uploadRoot = process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, "..", "uploads");
const cloudRoot = "razk-hrms";

const safeSegment = (value, fallback = "unknown") =>
  String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || fallback;

const safeFilename = (value = "upload") =>
  String(value).replace(/[^a-zA-Z0-9._-]/g, "-").slice(-160) || "upload";

const storageOwner = (userId) => safeSegment(userId);
const storageFolder = (folder) => safeSegment(folder, "files");
const cloudPrefix = ({ folder, userId }) => `${cloudRoot}/${storageFolder(folder)}/${storageOwner(userId)}/`;
const localPrefix = ({ folder, userId }) => `/uploads/${storageFolder(folder)}/${storageOwner(userId)}/`;

const useCloudStorage = () => isCloudinaryConfigured();

const validateFileContent = (file) => {
  const bytes = file?.buffer;
  const valid =
    (file?.mimetype === "image/jpeg" &&
      bytes?.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (file?.mimetype === "image/png" &&
      bytes?.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (file?.mimetype === "image/webp" &&
      bytes?.length >= 12 &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
    (file?.mimetype === "image/gif" &&
      bytes?.length >= 6 &&
      ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) ||
    (file?.mimetype === "application/pdf" &&
      bytes?.length >= 5 &&
      bytes.subarray(0, 5).toString("ascii") === "%PDF-") ||
    (file?.mimetype === "application/msword" &&
      bytes?.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) ||
    (file?.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      bytes?.length >= 4 &&
      bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])));

  if (!valid) {
    const error = new Error("Uploaded file content does not match its declared type");
    error.statusCode = 400;
    throw error;
  }
};

const uploadToCloudinary = ({ file, folder, userId }) =>
  new Promise((resolve, reject) => {
    const client = getCloudinaryClient();
    const resourceType = file.mimetype.startsWith("image/") ? "image" : "raw";
    const rawExtension = resourceType === "raw" ? path.extname(safeFilename(file.originalname)).toLowerCase() : "";
    const publicId = `${cloudPrefix({ folder, userId })}${crypto.randomUUID()}${rawExtension}`;
    const stream = client.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: resourceType,
        overwrite: false
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({
          filename: result.public_id.split("/").pop(),
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: result.secure_url,
          publicId: result.public_id,
          provider: "cloudinary",
          resourceType
        });
      }
    );
    stream.end(file.buffer);
  });

const uploadToLocalStorage = async ({ file, folder, userId }) => {
  const owner = storageOwner(userId);
  const normalizedFolder = storageFolder(folder);
  const directory = path.join(uploadRoot, normalizedFolder, owner);
  await fs.promises.mkdir(directory, { recursive: true });
  const filename = `${Date.now()}-${crypto.randomUUID()}-${safeFilename(file.originalname)}`;
  const absolutePath = path.join(directory, filename);
  await fs.promises.writeFile(absolutePath, file.buffer);
  const publicId = `${localPrefix({ folder: normalizedFolder, userId: owner })}${filename}`;

  return {
    filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: publicId,
    publicId,
    provider: "local",
    resourceType: file.mimetype.startsWith("image/") ? "image" : "raw"
  };
};

const storeUploadedFile = ({ file, folder, userId }) => {
  validateFileContent(file);
  return useCloudStorage()
    ? uploadToCloudinary({ file, folder, userId })
    : uploadToLocalStorage({ file, folder, userId });
};

const deleteCloudinaryAsset = async ({ publicId, resourceType }) => {
  const client = getCloudinaryClient();
  await client.uploader.destroy(publicId, {
    invalidate: true,
    resource_type: resourceType === "raw" ? "raw" : "image"
  });
};

const deleteLocalAsset = async ({ publicId }) => {
  const absolutePath = resolveLocalUploadPath(publicId);
  await fs.promises.rm(absolutePath, { force: true });
};

const resolveLocalUploadPath = (publicId) => {
  const relativePath = String(publicId || "").replace(/^\/uploads\//, "");
  const absolutePath = path.resolve(uploadRoot, relativePath);
  const resolvedRoot = path.resolve(uploadRoot);
  if (!absolutePath.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Invalid local upload path");
  return absolutePath;
};

const deleteStoredFile = async ({ folder = "images", provider, publicId, resourceType = "image", userId }) => {
  if (!publicId || !provider || !userId) return false;
  if (provider === "cloudinary") {
    if (!String(publicId).startsWith(cloudPrefix({ folder, userId }))) {
      throw new Error("Upload does not belong to this user");
    }
    await deleteCloudinaryAsset({ publicId, resourceType });
    return true;
  }
  if (provider === "local") {
    if (!String(publicId).startsWith(localPrefix({ folder, userId }))) {
      throw new Error("Upload does not belong to this user");
    }
    await deleteLocalAsset({ publicId });
    return true;
  }
  return false;
};

const isAllowedAttendancePhotoUrl = ({ provider, publicId, url: value, userId }) => {
  const photoUrl = String(value || "").trim();
  const expectedProvider = String(provider || "").trim();
  const expectedPublicId = String(publicId || "").trim();
  const expectedLocalPrefix = localPrefix({ folder: "images", userId });
  const expectedCloudPrefix = cloudPrefix({ folder: "images", userId });

  if (photoUrl.startsWith(expectedLocalPrefix)) {
    return expectedProvider === "local" && expectedPublicId === photoUrl;
  }

  try {
    const url = new URL(photoUrl);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com") return false;
    const decodedPath = decodeURIComponent(url.pathname);
    const cloudName = getCloudinaryConfiguration().cloudName;
    return (
      expectedProvider === "cloudinary" &&
      Boolean(cloudName) &&
      decodedPath.startsWith(`/${cloudName}/`) &&
      decodedPath.includes(`/${expectedCloudPrefix}`) &&
      expectedPublicId.startsWith(expectedCloudPrefix) &&
      decodedPath.includes(`/${expectedPublicId}`)
    );
  } catch {
    return false;
  }
};

module.exports = {
  deleteStoredFile,
  isAllowedAttendancePhotoUrl,
  resolveLocalUploadPath,
  storeUploadedFile,
  useCloudStorage
};
