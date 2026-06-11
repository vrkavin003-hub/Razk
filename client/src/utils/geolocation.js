import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

const locationPermissionMessage = "Location permission was not allowed.";

const assertValidCoordinates = ({ latitude, longitude, accuracy }) => {
  const normalized = {
    accuracy: Math.round(Number(accuracy) || 0),
    latitude: Number(latitude),
    longitude: Number(longitude)
  };

  if (!Number.isFinite(normalized.latitude) || !Number.isFinite(normalized.longitude)) {
    throw new Error("Location could not be captured.");
  }

  return normalized;
};

const browserLocationError = (error) => {
  if (error?.code === 1) return locationPermissionMessage;
  if (error?.code === 2) return "Location is turned off or unavailable.";
  if (error?.code === 3) return "Location request timed out.";
  return "Location could not be captured.";
};

export const getBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Location could not be captured on this device."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve(assertValidCoordinates({
          accuracy: position.coords.accuracy,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
      },
      (error) => reject(new Error(browserLocationError(error))),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  });

const ensureCapacitorLocationPermission = async () => {
  const permission = await Geolocation.checkPermissions();
  if (permission.location === "granted") return;

  if (permission.location === "denied") {
    throw new Error(locationPermissionMessage);
  }

  const requested = await Geolocation.requestPermissions();
  if (requested.location !== "granted") {
    throw new Error(locationPermissionMessage);
  }
};

export const getCurrentLocation = async () => {
  if (!Capacitor.isNativePlatform()) {
    return getBrowserLocation();
  }

  try {
    await ensureCapacitorLocationPermission();
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15000
    });

    return assertValidCoordinates({
      accuracy: position.coords.accuracy,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude
    });
  } catch (error) {
    const message = String(error?.message || "");
    if (/denied|permission/i.test(message)) throw new Error(locationPermissionMessage);
    if (/location|disabled|unavailable/i.test(message)) {
      throw new Error("Location is turned off or unavailable.");
    }
    throw new Error(message || "Location could not be captured.");
  }
};

export const attendanceLocationFromError = (error) => {
  const message = String(error?.message || "");
  const permissionDenied = /denied|permission|allow precise location/i.test(message);

  return {
    accuracy: null,
    latitude: null,
    locationError: message || "Location could not be captured.",
    locationStatus: permissionDenied ? "Permission denied" : "Location not available",
    longitude: null
  };
};

export const getAttendanceLocationPayload = async () => {
  try {
    const coordinates = await getCurrentLocation();
    return {
      ...coordinates,
      locationError: "",
      locationStatus: "Captured"
    };
  } catch (error) {
    return attendanceLocationFromError(error);
  }
};

export const googleMapsUrl = (latitude, longitude) => {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return "";
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
};
