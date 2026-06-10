const OfficeLocation = require("../models/OfficeLocation");
const asyncHandler = require("../utils/asyncHandler");
const { buildLocationDecision, validateCoordinates } = require("../utils/geo");

const badRequest = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  throw error;
};

const normalizePayload = (body) => {
  const officeName = String(body.officeName || body.office_name || "").trim();
  const { latitude, longitude } = validateCoordinates(body);
  const radiusMeters = Number(body.radiusMeters ?? body.radius_meters);

  if (!officeName) badRequest("Office name is required");
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    badRequest("Allowed radius must be a positive number");
  }

  return {
    officeName,
    latitude,
    longitude,
    radiusMeters,
    status: body.status === "inactive" ? "inactive" : "active"
  };
};

const getOfficeLocations = asyncHandler(async (req, res) => {
  const activeOffice = await OfficeLocation.findOne({ status: "active" }).sort({ updatedAt: -1 });

  if (["admin", "hr"].includes(req.user.role)) {
    const locations = await OfficeLocation.find().sort({ updatedAt: -1 });
    res.json({ activeOffice, locations });
    return;
  }

  res.json({ activeOffice });
});

const createOfficeLocation = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);

  if (payload.status === "active") {
    await OfficeLocation.updateMany({ status: "active" }, { status: "inactive" });
  }

  const officeLocation = await OfficeLocation.create(payload);
  res.status(201).json({ officeLocation });
});

const updateOfficeLocation = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);

  if (payload.status === "active") {
    await OfficeLocation.updateMany({ _id: { $ne: req.params.id }, status: "active" }, { status: "inactive" });
  }

  const officeLocation = await OfficeLocation.findByIdAndUpdate(req.params.id, payload, {
    new: true,
    runValidators: true
  });

  if (!officeLocation) {
    res.status(404);
    throw new Error("Office location not found");
  }

  res.json({ officeLocation });
});

const previewOfficeDistance = asyncHandler(async (req, res) => {
  const { latitude, longitude } = validateCoordinates(req.query);
  const activeOffice = await OfficeLocation.findOne({ status: "active" }).sort({ updatedAt: -1 });
  const decision = buildLocationDecision({ latitude, longitude, office: activeOffice });
  res.json({ activeOffice, decision });
});

module.exports = {
  createOfficeLocation,
  getOfficeLocations,
  previewOfficeDistance,
  updateOfficeLocation
};
