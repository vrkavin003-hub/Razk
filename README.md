# Razk Automation Attendance App

Full-stack Razk Automation attendance and HRMS application built with React, Vite, Tailwind CSS, Express, JWT authentication, MongoDB/local development fallback, SQL Server production API modules, and Capacitor Android.

## What Is Included

- Role-based login for Admin, HR, and Employee users.
- JWT-protected dashboards and APIs.
- Attendance check-in and check-out with optional location capture.
- Backend stores GPS details when available but does not block attendance by office radius.
- Admin office location settings.
- Attendance history, reports, CSV/PDF report support, leave, permission, announcements, and notifications.
- Android mobile app shell using Capacitor.

## Project Structure

```text
client/
  android/                 Capacitor Android project
  src/
    config/api.js          API URL selection for web and mobile
    context/AuthContext.jsx
    pages/
    services/api.js
    utils/geolocation.js   Browser + Capacitor GPS helper
server/
  controllers/
  middleware/
  models/
  routes/
  sql/
  utils/
```

## Environment Files

Create `server/.env` from `server/.env.example`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/razk-automation-hrms
JWT_SECRET=replace-with-a-long-random-secret
JWT_REFRESH_SECRET=replace-with-a-different-long-random-secret
PORT=5000
CLIENT_ORIGIN=http://localhost:5174
ALLOW_LOCAL_STORE=true
```

Production deployment should set `NODE_ENV=production`, `ALLOW_LOCAL_STORE=false`, and one database mode explicitly:

- MongoDB mode: set `MONGO_URI`
- SQL Server mode: set `DB_CLIENT=sqlserver` plus `DATABASE_URL` or the `SQLSERVER_*` fields

Create `client/.env` from `client/.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

For Android emulator local testing:

```env
VITE_API_URL=http://10.0.2.2:5000/api
```

For a real Android device or production APK:

```env
VITE_API_URL=https://your-deployed-backend.com/api
```

Do not use `localhost` inside a production mobile build. A physical phone treats `localhost` as the phone itself, not your backend server.

## Backend

From `server/`:

```bash
npm install
npm run dev
```

The backend runs on `http://localhost:5000` by default.

If MongoDB is unavailable and `ALLOW_LOCAL_STORE` is not `false`, the server starts with a local JSON development store at `server/data/local-dev-db.json`. This is useful for immediate local login testing.

In production, the server now fails fast if required environment variables are missing or if local fallback is still enabled.

Health check:

```bash
curl http://localhost:5000/api/health
```

The health response includes server status, database status, configured environment variable status, allowed web origins, and mobile WebView origins.

Production hardening, Cloudinary, Atlas backups, Render/Vercel deployment, rollback, and k6 staging instructions:

- [Production hardening and deployment runbook](docs/production-hardening.md)
- [50-user k6 load test](tests/load/README.md)

## Frontend

From `client/`:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5174
```

Build the web app:

```bash
npm run build
```

## Test Login

Default admin:

```text
Email: admin@razkautomation.com
Password: Admin@12345
```

Demo HR:

```text
Email: hr@razkautomation.com
Password: HR@12345
```

Demo employee:

```text
Email: employee@razkautomation.com
Password: Employee@123
```

Login API test:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@razkautomation.com\",\"password\":\"Admin@12345\"}"
```

Protected route test:

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Attendance API Test

Check-in with captured coordinates:

```bash
curl -X POST http://localhost:5000/api/attendance/check-in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -d "{\"latitude\":12.740912,\"longitude\":77.825292}"
```

```bash
curl -X POST http://localhost:5000/api/attendance/check-out \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -d "{\"latitude\":12.740912,\"longitude\":77.825292}"
```

If location permission is denied or GPS is unavailable, attendance is still marked and the location status is stored as `Permission denied` or `Location not available`.

## Capacitor Android

Capacitor is configured in `client/capacitor.config.json`:

```json
{
  "appId": "com.razkautomation.attendance",
  "appName": "Razk Automation",
  "webDir": "dist"
}
```

Android permissions are configured in `client/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

The Android project also includes a narrow local development network security config for `10.0.2.2`, `localhost`, and `127.0.0.1`. Use HTTPS for deployed backends.

Install Capacitor packages from `client/` if needed:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/geolocation
```

Build and sync Android:

```bash
cd client
npm run build
npx cap sync android
npx cap open android
```

If adding Android from a fresh clone:

```bash
cd client
npx cap add android
npx cap sync android
npx cap open android
```

Build an APK from Android Studio:

```text
Build > Build Bundle(s) / APK(s) > Build APK(s)
```

Or from the Android project folder:

```bash
cd client/android
./gradlew assembleDebug
```

On Windows PowerShell:

```powershell
cd client/android
.\gradlew.bat assembleDebug
```

## Mobile Location Flow

- Web uses `navigator.geolocation`.
- Android uses `@capacitor/geolocation`.
- The app requests precise location permission when possible.
- Check-in/check-out is not blocked when location is missing or denied.
- The backend still enforces authentication, duplicate check-in prevention, and check-out sequencing.

## Production Deployment Notes

Backend deployment:

```bash
cd server
npm install
npm start
```

Required backend environment variables:

```env
MONGO_URI=
JWT_SECRET=
CLIENT_ORIGIN=https://your-frontend-domain.com
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
ALLOW_LOCAL_STORE=false
SENTRY_DSN=
```

If you use SQL Server in production, set:

```env
DB_CLIENT=sqlserver
DATABASE_URL=sqlserver://SERVER_NAME;database=DATABASE_NAME;user=USERNAME;password=PASSWORD;trustServerCertificate=true
SQLSERVER_USER=
SQLSERVER_PASSWORD=
SQLSERVER_DATABASE=
```

Frontend deployment:

```bash
cd client
npm install
npm run build
```

Set:

```env
VITE_API_URL=https://your-deployed-backend.com/api
```

For Android production, rebuild and sync after setting the deployed backend URL:

```bash
cd client
npm run build
npx cap sync android
npx cap open android
```

## SQL Backend Documents

- MySQL schema: `server/database/schema.sql`
- SQL Server schema: `server/database/sqlserver-schema.sql`
- Schema diagram: `docs/sql-database-schema.md`
- API reference: `docs/sql-api-reference.md`
- Setup and deployment: `docs/sql-setup-and-deployment.md`
- Migration plan: `docs/sql-migration-plan.md`
- Location attendance guide: `docs/location-attendance.md`

To create the SQL Server database for this app without installing `sqlcmd`, run:

```bash
cd server
npm run db:sqlserver:schema
```

The script reads `server/.env`, creates `razk_automation_hrms` if it does not exist, and then creates the tables from `server/database/sqlserver-schema.sql`. You can also run the schema manually in SQL Server Management Studio.
