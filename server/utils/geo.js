const toCoordinate = (value, name) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    const error = new Error(`${name} is required and must be a valid number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
};

const assertLatitude = (value) => {
  const latitude = toCoordinate(value, "latitude");
  if (latitude < -90 || latitude > 90) {
    const error = new Error("latitude must be between -90 and 90");
    error.statusCode = 400;
    throw error;
  }
  return latitude;
};

const assertLongitude = (value) => {
  const longitude = toCoordinate(value, "longitude");
  if (longitude < -180 || longitude > 180) {
    const error = new Error("longitude must be between -180 and 180");
    error.statusCode = 400;
    throw error;
  }
  return longitude;
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const calculateDistanceMeters = (fromLatitude, fromLongitude, toLatitude, toLongitude) => {
  const earthRadiusMeters = 6371000;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const fromLatRadians = toRadians(fromLatitude);
  const toLatRadians = toRadians(toLatitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatRadians) * Math.cos(toLatRadians) * Math.sin(deltaLongitude / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const validateCoordinates = ({ latitude, longitude }) => ({
  latitude: assertLatitude(latitude),
  longitude: assertLongitude(longitude)
});

const optionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeAttendanceLocation = (body = {}, capturedAt = new Date()) => {
  const latitude = optionalNumber(body.latitude);
  const longitude = optionalNumber(body.longitude);
  const accuracy = optionalNumber(body.accuracy);
  const requestedStatus = String(body.locationStatus || body.location_status || "").trim();
  const hasValidCoordinates =
    latitude !== null && longitude !== null && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

  let locationStatus = requestedStatus;
  if (!locationStatus) {
    locationStatus = hasValidCoordinates ? "Captured" : "Location not available";
  }

  if (!hasValidCoordinates) {
    return {
      accuracy: null,
      capturedAt,
      latitude: null,
      longitude: null,
      locationStatus
    };
  }

  return {
    accuracy,
    capturedAt,
    latitude,
    longitude,
    locationStatus: locationStatus === "Permission denied" ? "Permission denied" : "Captured"
  };
};

const buildLocationDecision = ({ office, latitude, longitude }) => {
  if (!office) {
    const error = new Error("No active office location is configured");
    error.statusCode = 400;
    throw error;
  }
  const officeLatitude = Number(office.latitude);
  const officeLongitude = Number(office.longitude);
  const radiusMeters = Number(office.radiusMeters ?? office.radius_meters);
  const distanceMeters = calculateDistanceMeters(latitude, longitude, officeLatitude, officeLongitude);
  const inside = distanceMeters <= radiusMeters;

  return {
    distanceMeters: Math.round(distanceMeters),
    inside,
    officeName: office.officeName || office.office_name,
    radiusMeters,
    status: inside ? "Inside" : "Outside"
  };
};

module.exports = {
  assertLatitude,
  assertLongitude,
  buildLocationDecision,
  calculateDistanceMeters,
  normalizeAttendanceLocation,
  validateCoordinates
};
