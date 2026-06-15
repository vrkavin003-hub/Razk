# Attendance Location Capture

Razk Automation attendance can be marked from any location. The app still tries to capture GPS details during check-in and check-out for reporting.

## Admin Setup

Office location settings are kept for reference:

```text
Settings -> Office Location Settings
```

Admin can save office name, latitude, longitude, radius, and active/inactive status. These settings no longer block attendance.

## Employee Flow

Before check-in or check-out:

1. The app tries to capture GPS using browser geolocation or Capacitor Geolocation.
2. If GPS is available, latitude, longitude, accuracy, status, and capture time are sent to the backend.
3. If permission is denied or GPS is unavailable, attendance is still submitted with a location status such as `Permission denied` or `Location not available`.
4. Backend saves attendance after authentication and attendance sequence checks.

## Security Rules

- Employees cannot check in twice on the same date.
- Employees cannot check out without check-in.
- Employees cannot check out twice.
- Authentication and role-based access remain enforced.
- Location is captured for reporting, not used as a blocking rule.

## Browser And Mobile Notes

Browser geolocation works reliably only on HTTPS production domains or localhost. Android uses Capacitor Geolocation and keeps `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` permissions, but permission denial does not block attendance.
