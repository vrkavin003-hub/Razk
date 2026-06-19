import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const validationOnly = String(__ENV.K6_VALIDATE_ONLY || "").toLowerCase() === "true";
const enableAttendanceWrite = String(__ENV.K6_ENABLE_ATTENDANCE_WRITE || "").toLowerCase() === "true";
const baseUrl = String(__ENV.K6_BASE_URL || "https://staging.example.invalid/api").replace(/\/+$/, "");
const employeeCount = 50;

const placeholderEmployees = Array.from({ length: employeeCount }, (_, index) => ({
  deviceId: `validation-device-${index + 1}`,
  loginId: `VALIDATION-${String(index + 1).padStart(3, "0")}`,
  password: "not-a-real-password"
}));

const employeeCredentials = validationOnly
  ? placeholderEmployees
  : JSON.parse(__ENV.K6_EMPLOYEE_CREDENTIALS || "[]");
const hrCredential = validationOnly
  ? { loginId: "validation@example.invalid", password: "not-a-real-password" }
  : JSON.parse(__ENV.K6_HR_CREDENTIAL || "{}");

if (employeeCredentials.length < employeeCount) {
  throw new Error("K6_EMPLOYEE_CREDENTIALS must contain at least 50 approved staging employee accounts.");
}
if (!hrCredential.loginId || !hrCredential.password) {
  throw new Error("K6_HR_CREDENTIAL must contain loginId and password.");
}
if (enableAttendanceWrite && !__ENV.K6_IMAGE_FILE) {
  throw new Error("K6_IMAGE_FILE is required when K6_ENABLE_ATTENDANCE_WRITE=true.");
}

const attendanceImage = enableAttendanceWrite ? open(__ENV.K6_IMAGE_FILE, "b") : null;
const apiErrors = new Rate("api_errors");
const uploadErrors = new Rate("upload_errors");
const scenarios = {
  concurrent_logins: {
    executor: "per-vu-iterations",
    exec: "concurrentLogin",
    vus: employeeCount,
    iterations: 1,
    maxDuration: "2m"
  },
  employee_history: {
    executor: "constant-vus",
    exec: "employeeHistory",
    vus: employeeCount,
    duration: __ENV.K6_DURATION || "1m",
    startTime: "10s"
  },
  hr_reads: {
    executor: "constant-vus",
    exec: "hrReadFlow",
    vus: Number(__ENV.K6_HR_VUS || 5),
    duration: __ENV.K6_DURATION || "1m",
    startTime: "10s"
  }
};

if (enableAttendanceWrite) {
  scenarios.attendance_check_in = {
    executor: "per-vu-iterations",
    exec: "attendanceCheckIn",
    vus: employeeCount,
    iterations: 1,
    startTime: "1m20s",
    maxDuration: "5m"
  };
}

export const options = {
  scenarios,
  thresholds: {
    api_errors: ["rate<0.01"],
    upload_errors: ["rate<0.01"],
    "http_req_duration{request_type:api}": ["p(95)<1000"],
    "http_req_duration{request_type:image_upload}": ["p(95)<5000"]
  }
};

const responseOk = (response, expectedStatuses, label, errorMetric = apiErrors) => {
  const passed = check(response, {
    [label]: (result) => expectedStatuses.includes(result.status)
  });
  errorMetric.add(!passed);
  return passed;
};

const login = (credential) => {
  const response = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({
      deviceId: credential.deviceId || "k6-hr-multi-device",
      deviceName: "k6 staging load test",
      email: credential.loginId,
      password: credential.password
    }),
    {
      headers: { "Content-Type": "application/json" },
      tags: { endpoint: "login", request_type: "api" }
    }
  );
  if (!responseOk(response, [200], "login succeeds")) return null;
  const body = response.json();
  return {
    deviceId: credential.deviceId || "k6-hr-multi-device",
    token: body.token,
    user: body.user
  };
};

const authParams = (session, endpoint, requestType = "api") => ({
  headers: {
    Authorization: `Bearer ${session.token}`,
    "X-Device-Id": session.deviceId
  },
  tags: { endpoint, request_type: requestType }
});

const employeeCredential = () => employeeCredentials[(__VU - 1) % employeeCredentials.length];
let employeeSession;
let hrSession;

export function concurrentLogin() {
  login(employeeCredential());
}

export function employeeHistory() {
  if (!employeeSession) employeeSession = login(employeeCredential());
  if (!employeeSession) return;
  const response = http.get(
    `${baseUrl}/attendance/my-history?limit=60`,
    authParams(employeeSession, "employee_history")
  );
  responseOk(response, [200], "employee history succeeds");
  sleep(1);
}

export function hrReadFlow() {
  if (!hrSession) hrSession = login(hrCredential);
  if (!hrSession) return;

  const employees = http.get(`${baseUrl}/employees`, authParams(hrSession, "hr_employee_list"));
  responseOk(employees, [200], "HR employee list succeeds");

  const devices = http.get(
    `${baseUrl}/employees/device-requests/pending`,
    authParams(hrSession, "hr_device_requests")
  );
  responseOk(devices, [200], "HR device request list succeeds");

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const report = http.get(
    `${baseUrl}/reports/custom?type=all&from=${monthStart}&to=${today}`,
    authParams(hrSession, "report_preview")
  );
  responseOk(report, [200], "report preview succeeds");
  sleep(2);
}

export function attendanceCheckIn() {
  const session = login(employeeCredential());
  if (!session) return;

  const upload = http.post(
    `${baseUrl}/uploads/image`,
    { file: http.file(attendanceImage, "k6-attendance.jpg", "image/jpeg") },
    authParams(session, "attendance_image_upload", "image_upload")
  );
  if (!responseOk(upload, [201], "attendance image upload succeeds", uploadErrors)) return;

  const stored = upload.json("file");
  const checkIn = http.post(
    `${baseUrl}/attendance/check-in`,
    JSON.stringify({
      attendancePhoto: stored.url,
      attendancePhotoCapturedAt: new Date().toISOString(),
      attendancePhotoDevice: "k6 staging load test",
      attendancePhotoProvider: stored.provider,
      attendancePhotoPublicId: stored.publicId,
      attendancePhotoResourceType: stored.resourceType,
      attendanceSite: __ENV.K6_ATTENDANCE_SITE || "Chennai",
      latitude: Number(__ENV.K6_LATITUDE || 13.0827),
      longitude: Number(__ENV.K6_LONGITUDE || 80.2707)
    }),
    {
      ...authParams(session, "attendance_check_in"),
      headers: {
        ...authParams(session, "attendance_check_in").headers,
        "Content-Type": "application/json"
      }
    }
  );
  responseOk(checkIn, [201], "attendance check-in succeeds");
}
