const { v2: cloudinary } = require("cloudinary");

let configuredSignature = "";

const getCloudinaryConfiguration = () => ({
  apiKey: String(process.env.CLOUDINARY_API_KEY || "").trim(),
  apiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim(),
  cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim()
});

const isCloudinaryConfigured = () => {
  const config = getCloudinaryConfiguration();
  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
};

const getCloudinaryClient = () => {
  const config = getCloudinaryConfiguration();
  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  const signature = `${config.cloudName}:${config.apiKey}`;
  if (configuredSignature !== signature) {
    cloudinary.config({
      cloud_name: config.cloudName,
      api_key: config.apiKey,
      api_secret: config.apiSecret,
      secure: true
    });
    configuredSignature = signature;
  }
  return cloudinary;
};

module.exports = {
  getCloudinaryClient,
  getCloudinaryConfiguration,
  isCloudinaryConfigured
};
