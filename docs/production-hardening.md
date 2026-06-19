# Production hardening and deployment runbook

## Required backend variables

Set these on Render. Values belong only in Render's secret environment, never in Vercel or source control.

```env
NODE_ENV=production
PORT=10000
MONGO_URI=mongodb+srv://...
JWT_SECRET=<at-least-32-random-bytes>
CLIENT_ORIGIN=https://your-production-frontend.vercel.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ALLOW_LOCAL_STORE=false
```

Optional:

```env
DEFAULT_ADMIN_PASSWORD=<first-deploy-only; at least 12 characters>
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
SENTRY_TRACES_SAMPLE_RATE=0
MONGO_POOL_SIZE=25
MONGO_MIN_POOL_SIZE=2
MONGO_SERVER_SELECTION_TIMEOUT_MS=3000
MONGO_CREATE_INDEXES=true
MAX_UPLOAD_BYTES=5242880
```

`CLOUDINARY_API_SECRET`, `JWT_SECRET`, `MONGO_URI`, and `SENTRY_DSN` are backend-only. Do not create `VITE_` variables for them.

On a brand-new production database only, set `DEFAULT_ADMIN_PASSWORD` for the first successful deploy. Login as `admin@razkautomation.com`, change the password immediately, then remove `DEFAULT_ADMIN_PASSWORD` from Render. Existing databases do not need this variable.

## MongoDB Atlas

1. Create a dedicated production project and an M10-or-better replica-set cluster for sustained business use. A free/shared cluster can be used for staging but has tighter performance and backup limits.
2. Create a database user with read/write access only to the Razk production database. Use a generated password and place the resulting SRV connection string in `MONGO_URI`.
3. In Network Access, allow Render's documented outbound addresses when the selected Render plan supplies stable ranges. If temporary `0.0.0.0/0` access is unavoidable, require a strong database password and schedule restriction of the rule.
4. Keep TLS enabled. Do not add options that disable certificate validation.
5. Deploy once with `MONGO_CREATE_INDEXES=true`. Startup safely creates the attendance employee/date unique index, attendance date index, employee ID index, and device status/request-date index without rewriting records.
6. Enable Atlas continuous cloud backup or scheduled snapshots. Retain daily backups for at least 7 days and monthly backups according to company policy.
7. Test a restore into a separate staging cluster at least quarterly. Never test restores over the live production database.

The server refuses local JSON fallback in production and fails startup when `MONGO_URI` is absent.

## Cloudinary

1. Create a Cloudinary product environment dedicated to Razk production.
2. Copy Cloud name, API key, and API secret into the Render variables above.
3. Keep unsigned browser uploads disabled; all uploads pass through the authenticated backend.
4. The backend stores assets under `razk-hrms/<type>/<user-id>/`, validates size, declared MIME type, and file signatures, and returns HTTPS URLs.
5. Configure Cloudinary retention/backup policy appropriate to attendance evidence. Cloudinary storage and bandwidth are metered.

Local filesystem uploads remain available only when running outside production without Cloudinary credentials.

## Render backend

1. Create a Web Service from the repository.
2. Root directory: `server`.
3. Runtime: Node.
4. Build command: `npm ci`.
5. Start command: `npm start`.
6. Health check path: `/api/health`.
7. Add all required backend variables and deploy.
8. Confirm the health JSON reports `status: "ok"`, `database.ready: true`, `database.mode: "mongodb"`, and `services.attendanceImageStorage: "cloudinary"`.
9. Use at least one paid instance for predictable service availability. If scaling beyond one instance, the current in-memory rate limiter is per instance; use a shared rate-limit store before relying on global cross-instance limits.

## Vercel frontend

1. Import the same repository and set Root Directory to `client`.
2. Framework preset: Vite.
3. Build command: `npm run build`.
4. Output directory: `dist`.
5. Set only:

```env
VITE_API_URL=https://your-render-service.onrender.com/api
```

6. Set `CLIENT_ORIGIN` on Render to the exact production Vercel origin. Multiple allowed origins can be comma-separated.
7. Deploy and verify login, camera, watermark, PWA install, report downloads, and a hard refresh of a nested route.

## Sentry

Create a Node/Express Sentry project and set `SENTRY_DSN` on Render. `SENTRY_TRACES_SAMPLE_RATE=0` keeps tracing disabled while retaining exception reporting. Raise sampling gradually only after reviewing cost and privacy. The app runs normally when `SENTRY_DSN` is absent.

## Health and monitoring

- Render probe: `GET /api/health`.
- Alert when the endpoint fails, `status` is not `ok`, or `database.ready` is false.
- Logs are structured JSON for login failures, device approval/rejection/reset, upload failures, and attendance check-in failures.
- The health response exposes readiness and configuration booleans only; it never returns credentials or connection strings.

## Backup and rollback

Before each production release:

1. Confirm the latest Atlas snapshot completed.
2. Record the current Render deploy ID and Vercel deployment URL.
3. Run staging smoke tests and the k6 test without attendance writes first.

Application rollback:

1. In Render, select the previous successful deploy and use Rollback.
2. In Vercel, promote the previous known-good deployment.
3. Recheck `/api/health`, admin/HR login, employee device login, attendance, and exports.

Data rollback:

1. Do not delete collections or drop indexes during an application rollback.
2. Restore an Atlas snapshot to a new cluster.
3. Validate record counts and attendance/report behavior.
4. During a maintenance window, point `MONGO_URI` to the validated restored cluster and redeploy.

Cloudinary assets are independent of application rollback. Avoid bulk deletion; restore or re-link individual assets according to the Cloudinary plan.

## Release verification checklist

- Frontend production build succeeds.
- Every backend JavaScript file passes `node --check`.
- New employee device request can be approved; approved-device login succeeds.
- A different device is rejected.
- Existing employee token is rejected after HR device reset.
- Admin and HR can login from multiple devices.
- Production upload returns a Cloudinary HTTPS URL; development without Cloudinary returns `/uploads/...`.
- Attendance check-in stores site, watermarked photo URL, device, and capture time.
- PDF, Excel, and CSV exports download successfully.
- `client/android/gradlew.bat assembleDebug` succeeds; do not commit the APK.
- `k6 inspect -e K6_VALIDATE_ONLY=true tests/load/razk-50-users.js` succeeds.
- Final `git diff` contains only intended source, configuration examples, tests, and documentation.

## Costs and limits

- Atlas continuous backup and production-grade cluster capacity are paid features.
- Cloudinary charges depend on stored assets, transformations, and delivery bandwidth.
- Render paid instances avoid free-tier sleep and provide more predictable concurrency.
- Sentry tracing and event volume can incur cost; keep sampling conservative.
- Rate limits use process memory. They are suitable for the current single-instance Render deployment, but a multi-instance deployment needs a shared Redis-compatible store for globally consistent limits.
- The server audit retains a moderate transitive `uuid` advisory through ExcelJS 4.x. npm offers only a breaking forced change; replace or upgrade the report dependency in a separate regression-tested change rather than risking PDF/Excel behavior during this hardening release.
