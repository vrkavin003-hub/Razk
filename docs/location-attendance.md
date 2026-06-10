# Location-Based Attendance

HYA Tech attendance now validates employee check-in and check-out against the active office GPS location.

Default office:

```text
Office: HYA Tech
Latitude: 12.740912
Longitude: 77.825292
Allowed Radius: 100 meters
```

## Admin Setup

Open:

```text
Settings -> Office Location Settings
```

Admin can save:

- Office name
- Latitude
- Longitude
- Allowed radius in meters
- Active/inactive status

Only one active office is used for attendance validation. Saving a new active office deactivates the previous active office.

## Employee Flow

Before check-in or check-out:

1. Browser asks for location permission.
2. Current GPS coordinates are captured with high accuracy.
3. Frontend shows:
   - GPS status
   - Distance from office
   - GPS accuracy
   - Allowed radius
4. Backend receives latitude/longitude and validates again.
5. Attendance is saved only when distance is within the configured radius.

Outside-radius error:

```text
You are outside the allowed company location. Attendance cannot be marked.
```

## Security Rules

- Frontend location checks are user guidance only.
- Backend is the final authority.
- Haversine distance is calculated server-side.
- Employees cannot check in twice on the same date.
- Employees cannot check out without check-in.
- Employees cannot check out twice.
- Exact check-in/check-out latitude and longitude are stored.
- Location status and distance from office are stored for reporting.

## Browser Production Requirement

Browser geolocation works reliably only on:

```text
HTTPS production domains
localhost development
```

Deploy frontend and backend behind HTTPS before live employee use.
