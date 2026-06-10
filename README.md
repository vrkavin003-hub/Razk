# HYA Tech Employee Management System

Full-stack HRMS attendance application for HYA Tech, built with React, Vite, Tailwind CSS, Express, MongoDB, Mongoose, JWT authentication, and bcrypt password hashing.

## Core Workflow

1. Admin logs in.
2. Admin adds an employee with login credentials.
3. Employee logs in.
4. Employee checks in.
5. Employee checks out.
6. Employee applies for leave.
7. Admin or HR approves or rejects the leave request.

## Branding And Notifications

- Official logo asset: `client/src/assets/hya-logo.png`
- Browser icon asset: `client/public/hya-logo.png`
- Backend PDF logo asset: `server/assets/hya-logo.png`
- Top navigation includes the HYA Tech logo, live India date/time, notification bell, unread badge, and user profile.
- Top bar bell shows announcement notifications only.
- Leave and permission request counts appear as sidebar menu badges.
- Announcements create role-based bell notifications.
- Leave and permission requests update sidebar badges for Admin/HR.
- Approval or rejection creates employee sidebar update counts.
- Notification APIs:
  - `GET /api/notifications`
  - `GET /api/notifications/counts`
  - `PUT /api/notifications/:id/read`
  - `PUT /api/notifications/mark-all-read`
  - `DELETE /api/notifications/:id`

## Attendance Reports And PDF Export

Admin and HR can open `Reports` from the sidebar and generate:

- Single employee date-range report
- All employees monthly report
- Department-wise date-range report
- Custom all-employees date-range report

Report APIs:

```text
GET /api/reports/employee/:employeeId?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/reports/monthly?month=MM&year=YYYY
GET /api/reports/department/:department?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/reports/custom?type=all&from=YYYY-MM-DD&to=YYYY-MM-DD
```

PDF APIs:

```text
GET /api/reports/employee/:employeeId/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/reports/monthly/pdf?month=MM&year=YYYY
GET /api/reports/department/:department/pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
GET /api/reports/custom/pdf?type=all&from=YYYY-MM-DD&to=YYYY-MM-DD
```

## Project Structure

```text
client/
  src/
    components/
    context/
    layouts/
    pages/
    services/
    utils/
server/
  config/
  controllers/
  middleware/
  models/
  routes/
  scripts/
  utils/
```

## SQL Production Backend

This app now supports a production SQL backend using MySQL 8. Enable it with:

```env
DB_CLIENT=mysql
```

SQL deliverables:

- Complete schema: `server/database/schema.sql`
- Schema diagram: `docs/sql-database-schema.md`
- API reference: `docs/sql-api-reference.md`
- Setup and deployment: `docs/sql-setup-and-deployment.md`
- Migration plan: `docs/sql-migration-plan.md`
- Location attendance guide: `docs/location-attendance.md`

Create the SQL database:

```bash
mysql -u root -p < server/database/schema.sql
```

Seed the first SQL admin:

```bash
npm --prefix server run seed:sql
```

Use these production server variables:

```env
DB_CLIENT=mysql
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=hyatech_user
MYSQL_PASSWORD=replace-with-strong-password
MYSQL_DATABASE=hyatech_db
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=https://your-frontend-domain.com
ALLOW_LOCAL_STORE=false
```

## MongoDB Setup

MongoDB remains available for the original HRMS development workflow. For production SQL deployment, use the SQL setup above.

Use a local MongoDB instance or MongoDB Atlas.

Local example:

```bash
mongod
```

Create `server/.env` from `server/.env.example`:

```env
MONGO_URI=mongodb://127.0.0.1:27017/hya-tech-hrms
JWT_SECRET=replace-with-a-long-random-secret
PORT=5000
CLIENT_URL=http://localhost:5174
EMAIL_USER=
EMAIL_PASS=
```

Create `client/.env` from `client/.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

## Backend

From the project root, you can start both frontend and backend together:

```bash
npm run dev
```

Restart this command after code changes so the backend reloads the latest API routes.

Or run them separately:

```bash
cd server
npm install
npm run dev
```

If MongoDB is not installed locally, the API automatically starts with a local development data store at `server/data/local-dev-db.json`. This lets you log in and test the full workflow immediately. For production, use MongoDB and set `ALLOW_LOCAL_STORE=false`.

Default admin account:

```text
Email: admin@hyatech.com
Password: Admin@12345
```

Demo HR account:

```text
Email: hr@hyatech.com
Password: HR@12345
```

Demo employee account:

```text
Email: employee@hyatech.com
Password: Employee@123
Employee ID: HYA-DEMO-EMP
```

## Frontend

```bash
cd client
npm install
npm run dev
```

Open `http://localhost:5174`.

## API Testing

Health check:

```bash
curl http://localhost:5000/api/health
```

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@hyatech.com\",\"password\":\"Admin@12345\"}"
```

Add employee:

```bash
curl -X POST http://localhost:5000/api/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d "{\"employeeId\":\"HYA-EMP-001\",\"name\":\"Demo Employee\",\"email\":\"employee@hyatech.com\",\"password\":\"Welcome@123\",\"role\":\"employee\",\"department\":\"Production\",\"designation\":\"Operator\"}"
```

Employee check-in:

```bash
curl -X POST http://localhost:5000/api/attendance/check-in \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

Employee check-out:

```bash
curl -X POST http://localhost:5000/api/attendance/check-out \
  -H "Authorization: Bearer EMPLOYEE_TOKEN"
```

Apply leave:

```bash
curl -X POST http://localhost:5000/api/leave/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer EMPLOYEE_TOKEN" \
  -d "{\"leaveType\":\"Casual Leave\",\"fromDate\":\"2026-06-10\",\"toDate\":\"2026-06-11\",\"reason\":\"Family work\"}"
```

Approve leave:

```bash
curl -X PUT http://localhost:5000/api/leave/LEAVE_ID/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -d "{\"adminRemarks\":\"Approved\"}"
```

## Deployment

### Frontend on Vercel

1. Set project root to `client`.
2. Build command: `npm run build`.
3. Output directory: `dist`.
4. Add environment variable `VITE_API_URL=https://your-backend-host/api`.

### Backend on Render or Railway

1. Set project root to `server`.
2. Install command: `npm install`.
3. Start command: `npm start`.
4. Add environment variables from `server/.env.example`.
5. Set `CLIENT_URL` to your Vercel frontend URL.
6. Run the seed command once from the platform shell:

```bash
npm run seed
```

## Notes

- Passwords are hashed with bcrypt before storage.
- JWT protects all private routes.
- Admin and HR can manage employees, attendance, leave, permission, reports, and announcements.
- Employees can only access their own attendance, requests, and profile data.
