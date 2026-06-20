const fs = require("fs");
const path = require("path");
const {
  getCloudinaryClient,
  getCloudinaryConfiguration,
  isCloudinaryConfigured
} = require("../config/cloudinary");

const cloudRoot = "razk-hrms";

const safeSegment = (value, fallback = "unknown") =>
  String(value || fallback).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 100) || fallback;

const safeFilename = (value = "upload") =>
  String(value).replace(/[^a-zA-Z0-9._-]/g, "-").slice(-160) || "upload";

const storageOwner = (userId) => safeSegment(userId);
const storageFolder = (folder) => safeSegment(folder, "files");
const cloudPrefix = ({ folder, userId }) => `${cloudRoot}/${storageFolder(folder)}/${storageOwner(userId)}/`;
const localPrefix = ({ folder, userId }) => `/uploads/${storageFolder(folder)}/${storageOwner(userId)}/`;
const getUploadRoot = () => process.env.UPLOAD_ROOT
  ? path.resolve(process.env.UPLOAD_ROOT)
  : path.join(__dirname, "..", "uploads");

const useCloudStorage = () => isCloudinaryConfigured();
const toStoredFileResponse = (file = {}) => ({
  filename: file.filename,
  originalName: file.originalName || file.originalname,
  mimeType: file.mimeType || file.mimetype,
  size: file.size,
  url: file.url,
  provider: file.provider,
  publicId: file.publicId,
  resourceType: file.resourceType
});

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
  const absolutePath = path.resolve(getUploadRoot(), relativePath);
  const resolvedRoot = path.resolve(getUploadRoot());
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
  cloudPrefix,
  deleteStoredFile,
  getUploadRoot,
  isAllowedAttendancePhotoUrl,
  localPrefix,
  resolveLocalUploadPath,
  safeFilename,
  storageFolder,
  storageOwner,
  toStoredFileResponse,
  useCloudStorage
};
