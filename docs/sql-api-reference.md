# Razk Automation SQL API Reference

Base URL:

```text
http://localhost:5000/api
```

Production mode requires:

```env
DB_CLIENT=mysql
```

## Authentication

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/auth/login` | Public | Login with email/password |
| POST | `/auth/refresh` | Public | Issue a new access token from refresh token |
| POST | `/auth/logout` | Authenticated | Revoke refresh token |
| POST | `/auth/forgot-password` | Public | Generate password reset token structure |
| GET | `/auth/me` | Authenticated | Current user profile |

Login response:

```json
{
  "token": "jwt-access-token",
  "refreshToken": "opaque-refresh-token",
  "user": {
    "id": 1,
    "username": "razk-admin",
    "email": "admin@razkautomation.com",
    "role": "super_admin",
    "status": "active"
  }
}
```

## Contact Messages

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/contact` | Public | Submit contact form |
| GET | `/contact` | Admin/HR/Manager | List, search, filter, paginate messages |
| PATCH | `/contact/:id/status` | Admin/HR/Manager | Update status |
| DELETE | `/contact/:id` | Super Admin/Admin | Delete message |

Query params:

```text
search, status, from, to, page, limit
```

## Office Location

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/office-location` | Authenticated | Get active office; admins also get all locations |
| GET | `/office-location/distance?latitude=12.7&longitude=77.8` | Authenticated | Preview distance from active office |
| POST | `/office-location` | Admin | Create office location |
| PUT | `/office-location/:id` | Admin | Update office location |

Payload:

```json
{
  "officeName": "Razk Automation",
  "latitude": 12.740912,
  "longitude": 77.825292,
  "radiusMeters": 100,
  "status": "active"
}
```

## Location Attendance

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/attendance/check-in` | Authenticated employee/user | Check-in with optional location capture |
| POST | `/attendance/check-out` | Authenticated employee/user | Check-out with optional location capture |
| GET | `/attendance/my-attendance` | Authenticated | Own attendance history |
| GET | `/attendance/my-history` | Authenticated | Compatibility alias for own history |
| GET | `/attendance/all` | Admin/HR/Manager | All attendance records |
| GET | `/attendance/export-csv` | Admin/HR/Manager | CSV attendance export |

Check-in/check-out payload:

```json
{
  "employee_id": "RAZK-DEMO-EMP",
  "latitude": 12.740912,
  "longitude": 77.825292
}
```

Location is stored when provided. If permission is denied or coordinates are unavailable, attendance is still marked with a location status:

```json
{
  "locationStatus": "Permission denied",
  "latitude": null,
  "longitude": null
}
```

## Careers

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/careers/apply` | Public | Submit application with `resume` file |
| GET | `/careers/applications` | Admin/HR/Manager | List applications |
| PATCH | `/careers/applications/:id/status` | Admin/HR/Manager | Update application status |
| DELETE | `/careers/applications/:id` | Super Admin/Admin | Delete application |

Multipart field for resume:

```text
resume
```

Accepted types:

```text
PDF, DOC, DOCX
```

## Admin

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/admin/dashboard` | Admin roles | Dashboard counts and recent activities |
| GET | `/admin/users` | Super Admin/Admin/HR | List admin users |
| POST | `/admin/users` | Super Admin/Admin | Create admin user |
| PATCH | `/admin/users/:id` | Super Admin/Admin | Update admin user |
| DELETE | `/admin/users/:id` | Super Admin | Delete admin user |

## Announcements

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/announcements` | Authenticated | List announcements |
| POST | `/announcements` | Super Admin/Admin/HR | Create announcement |
| PATCH | `/announcements/:id` | Super Admin/Admin/HR | Update announcement |
| DELETE | `/announcements/:id` | Super Admin/Admin | Delete announcement |

## Notifications

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/notifications` | Authenticated | List notifications |
| GET | `/notifications/counts` | Authenticated | Unread counts |
| PUT | `/notifications/:id/read` | Authenticated | Mark one as read |
| PUT | `/notifications/mark-all-read` | Authenticated | Mark all as read |

## Reports

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/reports/contact-messages?format=pdf` | Admin roles | Contact report |
| GET | `/reports/career-applications?format=excel` | Admin roles | Career report |
| GET | `/reports/weekly/contact-messages?format=csv` | Admin roles | Weekly contact report |
| GET | `/reports/monthly/career-applications?format=pdf` | Admin roles | Monthly career report |

Supported formats:

```text
pdf, excel, xlsx, csv
```

Supported filters:

```text
from=YYYY-MM-DD
to=YYYY-MM-DD
status=new
```
