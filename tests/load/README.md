# k6 staging load test

This suite performs 50 concurrent employee logins, employee history reads, HR employee/device-request reads, report preview, and an optional upload plus attendance check-in.

Use staging only. Create 50 dedicated employee accounts, approve one dedicated device ID for each account, and ensure those accounts have not checked in on the test date. Never put credentials or test photos in Git.

PowerShell setup:

```powershell
$env:K6_BASE_URL = "https://your-staging-api.onrender.com/api"
$env:K6_EMPLOYEE_CREDENTIALS = Get-Content ".\tests\load\employees.local.json" -Raw
$env:K6_HR_CREDENTIAL = '{"loginId":"staging-hr@example.com","password":"from-secret-manager"}'
k6 inspect -e K6_VALIDATE_ONLY=true .\tests\load\razk-50-users.js
k6 run .\tests\load\razk-50-users.js
```

The ignored `employees.local.json` format is:

```json
[
  {
    "loginId": "STAGE-EMP-001",
    "password": "from-secret-manager",
    "deviceId": "approved-k6-device-001"
  }
]
```

To validate actual attendance upload/check-in, use a temporary JPEG outside Git and dedicated clean staging accounts:

```powershell
$env:K6_ENABLE_ATTENDANCE_WRITE = "true"
$env:K6_IMAGE_FILE = "C:\secure-test-data\attendance.jpg"
$env:K6_ATTENDANCE_SITE = "Chennai"
k6 run .\tests\load\razk-50-users.js
```

Thresholds are API p95 below 1 second excluding uploads, overall API error rate below 1%, upload error rate below 1%, and image-upload p95 below 5 seconds.
