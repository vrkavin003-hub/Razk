const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..", "..");
const serverRoot = path.join(projectRoot, "server");
const port = Number(process.env.ATTENDANCE_TEST_PORT || 5091);
const baseUrl = `http://127.0.0.1:${port}/api`;
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "razk-attendance-"));
const localStoreFile = path.join(tempRoot, "local-store.json");
const uploadRoot = path.join(tempRoot, "uploads");
const serverLogs = [];

const server = spawn(process.execPath, ["server.js"], {
  cwd: serverRoot,
  env: {
    ...process.env,
    ALLOW_LOCAL_STORE: "true",
    CLIENT_ORIGIN: "http://localhost:5174",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    CLOUDINARY_CLOUD_NAME: "",
    GENERAL_RATE_LIMIT_MAX: "10000",
    JWT_SECRET: "attendance-local-integration-test-secret-2026",
    LOCAL_STORE_FILE: localStoreFile,
    LOGIN_RATE_LIMIT_MAX: "1000",
    MONGO_SERVER_SELECTION_TIMEOUT_MS: "200",
    MONGO_URI: "mongodb://127.0.0.1:1/razk-attendance-integration",
    NODE_ENV: "development",
    PORT: String(port),
    UPLOAD_RATE_LIMIT_MAX: "1000",
    UPLOAD_ROOT: uploadRoot
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

server.stdout.on("data", (chunk) => serverLogs.push(chunk.toString()));
server.stderr.on("data", (chunk) => serverLogs.push(chunk.toString()));

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const waitForServer = async () => {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Test API exited early.\n${serverLogs.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // The API is still starting or waiting for the MongoDB fallback timeout.
    }
    await wait(100);
  }
  throw new Error(`Timed out waiting for test API.\n${serverLogs.join("")}`);
};

const request = async (method, route, { body, deviceId, expected, token } = {}) => {
  const headers = {};
  let requestBody = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }
  if (token) headers.Authorization = `Bearer ${token}`;
  if (deviceId) headers["X-Device-Id"] = deviceId;

  const response = await fetch(`${baseUrl}${route}`, {
    body: requestBody,
    headers,
    method
  });
  const contentType = String(response.headers.get("content-type") || "");
  const data = contentType.includes("application/json")
    ? JSON.parse((await response.text()) || "{}")
    : Buffer.from(await response.arrayBuffer());
  if (expected !== undefined) {
    assert.equal(response.status, expected, `${method} ${route}: ${Buffer.isBuffer(data) ? contentType : JSON.stringify(data)}`);
  }
  return { data, response };
};

const login = (loginId, password, deviceId) =>
  request("POST", "/auth/login", {
    body: {
      deviceId,
      deviceName: `Integration device ${deviceId}`,
      email: loginId,
      password
    }
  });

const auth = (session) => ({
  deviceId: session.deviceId,
  token: session.token
});

const uploadImage = async (session, filename) => {
  const form = new FormData();
  const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xd9]);
  form.append("file", new Blob([jpegBytes], { type: "image/jpeg" }), filename);
  const { data } = await request("POST", "/uploads/image", {
    ...auth(session),
    body: form,
    expected: 201
  });
  assert.equal(data.file.provider, "local");
  assert.match(data.file.url, /^\/uploads\/images\//);
  assert.equal(data.file.publicId, data.file.url);
  return data.file;
};

const requestAndApproveDevice = async ({ employeeId, employeePassword, hr, deviceId }) => {
  const firstLogin = await login(employeeId, employeePassword, deviceId);
  assert.equal(firstLogin.response.status, 202);
  assert.equal(firstLogin.data.requiresDeviceApproval, true);

  const pending = await request("GET", "/employees/device-requests/pending", {
    ...auth(hr),
    expected: 200
  });
  const deviceRequest = pending.data.requests.find((item) => item.employeeId === employeeId);
  assert.ok(deviceRequest, `Pending device request was not found for ${employeeId}`);

  await request("PATCH", `/employees/${deviceRequest._id}/device/approve`, {
    ...auth(hr),
    expected: 200
  });

  const approvedLogin = await login(employeeId, employeePassword, deviceId);
  assert.equal(approvedLogin.response.status, 200);
  assert.ok(approvedLogin.data.token);
  return {
    deviceId,
    token: approvedLogin.data.token,
    user: approvedLogin.data.user
  };
};

const checkIn = async ({ locationStatus, latitude, longitude, photo, session, site }) => {
  const { data } = await request("POST", "/attendance/check-in", {
    ...auth(session),
    body: {
      accuracy: latitude === null ? null : 8,
      attendancePhoto: photo.url,
      attendancePhotoCapturedAt: new Date().toISOString(),
      attendancePhotoDevice: "Integration test camera",
      attendancePhotoProvider: photo.provider,
      attendancePhotoPublicId: photo.publicId,
      attendancePhotoResourceType: photo.resourceType,
      attendanceSite: site,
      latitude,
      locationStatus,
      longitude
    },
    expected: 201
  });
  return data.attendance;
};

const run = async () => {
  await waitForServer();

  const adminOne = await login("admin@razkautomation.com", "Admin@12345", "admin-device-one");
  const adminTwo = await login("admin@razkautomation.com", "Admin@12345", "admin-device-two");
  assert.equal(adminOne.response.status, 200);
  assert.equal(adminTwo.response.status, 200);

  const hrOne = await login("hr@razkautomation.com", "HR@12345", "hr-device-one");
  const hrTwo = await login("hr@razkautomation.com", "HR@12345", "hr-device-two");
  assert.equal(hrOne.response.status, 200);
  assert.equal(hrTwo.response.status, 200);
  const admin = { deviceId: "admin-device-one", token: adminOne.data.token, user: adminOne.data.user };
  const hr = { deviceId: "hr-device-one", token: hrOne.data.token, user: hrOne.data.user };

  const employee = await requestAndApproveDevice({
    deviceId: "employee-device-one",
    employeeId: "RAZK-DEMO-EMP",
    employeePassword: "Employee@123",
    hr
  });

  await request("GET", "/auth/me", { ...auth(employee), expected: 200 });
  const differentDevice = await login("RAZK-DEMO-EMP", "Employee@123", "employee-device-two");
  assert.equal(differentDevice.response.status, 403);

  const preResetToken = employee.token;
  await request("PATCH", `/employees/${employee.user._id}/reset-device`, {
    ...auth(hr),
    expected: 200
  });
  await request("GET", "/auth/me", {
    deviceId: employee.deviceId,
    expected: 401,
    token: preResetToken
  });

  const refreshedEmployee = await requestAndApproveDevice({
    deviceId: "employee-device-one",
    employeeId: "RAZK-DEMO-EMP",
    employeePassword: "Employee@123",
    hr
  });

  await request("POST", "/attendance/check-out", {
    ...auth(refreshedEmployee),
    body: { locationStatus: "Location not available" },
    expected: 400
  });

  const chennaiPhoto = await uploadImage(refreshedEmployee, "chennai-attendance.jpg");
  const chennaiAttendance = await checkIn({
    latitude: 13.0827,
    locationStatus: "Captured",
    longitude: 80.2707,
    photo: chennaiPhoto,
    session: refreshedEmployee,
    site: "Chennai"
  });
  assert.equal(chennaiAttendance.attendanceSite, "Chennai");
  assert.equal(chennaiAttendance.checkInPhoto, chennaiPhoto.url);
  assert.equal(chennaiAttendance.checkInPhotoProvider, "local");
  assert.equal(chennaiAttendance.checkInPhotoPublicId, chennaiPhoto.publicId);
  assert.equal(chennaiAttendance.checkInPhotoResourceType, "image");
  assert.equal(chennaiAttendance.checkInLocationStatus, "Captured");
  assert.equal(chennaiAttendance.checkInLatitude, 13.0827);
  assert.ok(chennaiAttendance.checkInPhotoCapturedAt);
  assert.ok(chennaiAttendance.checkInPhotoDevice);

  const employeePhoto = await request("GET", `/attendance/${chennaiAttendance._id}/photo`, {
    ...auth(refreshedEmployee),
    expected: 200
  });
  assert.match(employeePhoto.response.headers.get("content-type") || "", /^image\//);
  assert.ok(employeePhoto.data.length > 0);
  await request("GET", `/attendance/${chennaiAttendance._id}/photo`, {
    ...auth(hr),
    expected: 200
  });
  await request("GET", `/attendance/${chennaiAttendance._id}/photo`, {
    ...auth(admin),
    expected: 200
  });
  await request("GET", `/attendance/${chennaiAttendance._id}/photo`, {
    expected: 401
  });

  const today = await request("GET", "/attendance/today", {
    ...auth(refreshedEmployee),
    expected: 200
  });
  assert.equal(today.data.attendance._id, chennaiAttendance._id);

  await request("DELETE", "/uploads", {
    ...auth(refreshedEmployee),
    body: {
      folder: "images",
      provider: chennaiPhoto.provider,
      publicId: chennaiPhoto.publicId,
      resourceType: chennaiPhoto.resourceType
    },
    expected: 409
  });

  const duplicatePhoto = await uploadImage(refreshedEmployee, "duplicate-attendance.jpg");
  await request("POST", "/attendance/check-in", {
    ...auth(refreshedEmployee),
    body: {
      attendancePhoto: duplicatePhoto.url,
      attendancePhotoCapturedAt: new Date().toISOString(),
      attendancePhotoDevice: "Integration duplicate",
      attendancePhotoProvider: duplicatePhoto.provider,
      attendancePhotoPublicId: duplicatePhoto.publicId,
      attendancePhotoResourceType: duplicatePhoto.resourceType,
      attendanceSite: "Chennai",
      locationStatus: "Location not available"
    },
    expected: 409
  });
  await request("DELETE", "/uploads", {
    ...auth(refreshedEmployee),
    body: {
      folder: "images",
      provider: duplicatePhoto.provider,
      publicId: duplicatePhoto.publicId,
      resourceType: duplicatePhoto.resourceType
    },
    expected: 200
  });

  const checkedOut = await request("POST", "/attendance/check-out", {
    ...auth(refreshedEmployee),
    body: {
      accuracy: 12,
      latitude: 13.0828,
      locationStatus: "Captured",
      longitude: 80.2708
    },
    expected: 200
  });
  assert.equal(checkedOut.data.attendance._id, chennaiAttendance._id);
  assert.ok(checkedOut.data.attendance.checkOut);

  const history = await request("GET", "/attendance/my-history", {
    ...auth(refreshedEmployee),
    expected: 200
  });
  assert.ok(history.data.attendance.some((item) => item._id === chennaiAttendance._id));
  const dashboard = await request("GET", "/dashboard/employee", {
    ...auth(refreshedEmployee),
    expected: 200
  });
  assert.equal(dashboard.data.attendance._id, chennaiAttendance._id);

  const hosurEmployeeId = "RAZK-TEST-HOSUR";
  const hosurPassword = "HosurTest@123";
  const created = await request("POST", "/employees", {
    ...auth(hr),
    body: {
      department: "Testing",
      email: "hosur.integration@example.invalid",
      employeeId: hosurEmployeeId,
      name: "Hosur Integration Employee",
      password: hosurPassword,
      role: "employee"
    },
    expected: 201
  });
  assert.equal(created.data.employee.employeeId, hosurEmployeeId);

  const hosurEmployee = await requestAndApproveDevice({
    deviceId: "hosur-device-one",
    employeeId: hosurEmployeeId,
    employeePassword: hosurPassword,
    hr
  });
  const hosurPhoto = await uploadImage(hosurEmployee, "hosur-attendance.jpg");
  const hosurAttendance = await checkIn({
    latitude: null,
    locationStatus: "Permission denied",
    longitude: null,
    photo: hosurPhoto,
    session: hosurEmployee,
    site: "Hosur"
  });
  assert.equal(hosurAttendance.attendanceSite, "Hosur");
  assert.equal(hosurAttendance.checkInLocationStatus, "Permission denied");
  assert.equal(hosurAttendance.checkInLatitude, null);
  assert.equal(hosurAttendance.checkInLongitude, null);
  await request("GET", `/attendance/${chennaiAttendance._id}/photo`, {
    ...auth(hosurEmployee),
    expected: 403
  });

  const oldPasswordToken = hosurEmployee.token;
  await request("PUT", "/auth/change-password", {
    ...auth(hosurEmployee),
    body: {
      confirmNewPassword: "HosurTest@456",
      currentPassword: hosurPassword,
      newPassword: "HosurTest@456"
    },
    expected: 200
  });
  await request("GET", "/auth/me", {
    deviceId: hosurEmployee.deviceId,
    expected: 401,
    token: oldPasswordToken
  });
  const freshPasswordLogin = await login(hosurEmployeeId, "HosurTest@456", hosurEmployee.deviceId);
  assert.equal(freshPasswordLogin.response.status, 200);

  console.log("Attendance local integration workflow passed");
};

run()
  .catch((error) => {
    console.error(error.stack || error.message || error);
    console.error(serverLogs.join(""));
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server.exitCode === null) {
      server.kill();
      await wait(200);
    }
    fs.rmSync(tempRoot, { force: true, recursive: true });
  });
