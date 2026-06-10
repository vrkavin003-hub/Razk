export const calculateDistanceMeters = (fromLatitude, fromLongitude, toLatitude, toLongitude) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(toLatitude - fromLatitude);
  const deltaLongitude = toRadians(toLongitude - fromLongitude);
  const fromLatRadians = toRadians(fromLatitude);
  const toLatRadians = toRadians(toLatitude);

  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatRadians) * Math.cos(toLatRadians) * Math.sin(deltaLongitude / 2) ** 2;

  return Math.round(earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
};

export const getBrowserLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS location is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          accuracy: Math.round(position.coords.accuracy || 0),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      () => reject(new Error("Location permission is required to mark attendance.")),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );
  });

export const evaluateOfficeLocation = (coordinates, office) => {
  if (!coordinates || !office) return null;
  const distanceMeters = calculateDistanceMeters(
    coordinates.latitude,
    coordinates.longitude,
    Number(office.latitude),
    Number(office.longitude)
  );
  const radiusMeters = Number(office.radiusMeters ?? office.radius_meters);

  return {
    distanceMeters,
    inside: distanceMeters <= radiusMeters,
    radiusMeters,
    status: distanceMeters <= radiusMeters ? "Inside" : "Outside"
  };
};
