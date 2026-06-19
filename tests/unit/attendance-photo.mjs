import assert from "node:assert/strict";

Object.defineProperty(globalThis, "navigator", {
  value: {
    platform: "Test Platform",
    userAgent: "Test Browser"
  }
});

const {
  ATTENDANCE_TIME_ZONE,
  attendanceWatermarkLines,
  createWatermarkedAttendancePhoto
} = await import("../../client/src/utils/attendancePhoto.js");

assert.equal(ATTENDANCE_TIME_ZONE, "Asia/Kolkata");

const lines = attendanceWatermarkLines({
  capturedAt: "2026-06-18T18:30:05.000Z",
  deviceName: "Test Selfie Camera",
  location: {
    latitude: 13.0827,
    longitude: 80.2707,
    locationStatus: "Captured"
  },
  site: "Chennai"
});

assert.deepEqual(lines, [
  "Razk Automation Attendance",
  "Site: Chennai",
  "Date: 19 Jun 2026",
  "Time: 12:00:05 am",
  "Device: Test Selfie Camera",
  "GPS: 13.08270, 80.27070"
]);

const unavailableGps = attendanceWatermarkLines({
  capturedAt: "2026-06-18T03:30:00.000Z",
  deviceName: "Test Device",
  location: { locationStatus: "Permission denied" },
  site: "Hosur"
});
assert.equal(unavailableGps[1], "Site: Hosur");
assert.equal(unavailableGps[5], "GPS: Permission denied");

const drawnText = [];
let renderedCanvas;
globalThis.Image = class MockImage {
  constructor() {
    this.height = 1080;
    this.width = 1920;
  }

  set src(_value) {
    queueMicrotask(() => this.onload());
  }
};
URL.createObjectURL = () => "blob:test-attendance-photo";
URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement(type) {
    assert.equal(type, "canvas");
    const context = {
      drawImage() {},
      fillRect() {},
      fillText(text) {
        drawnText.push(text);
      },
      set fillStyle(_value) {},
      set font(_value) {}
    };
    renderedCanvas = {
      getContext: () => context,
      height: 0,
      toBlob: (callback) => callback(new Blob(["watermarked-jpeg"], { type: "image/jpeg" })),
      width: 0
    };
    return renderedCanvas;
  }
};

const watermarkedFile = await createWatermarkedAttendancePhoto(
  new File(["test-jpeg"], "selfie.jpg", { type: "image/jpeg" }),
  {
    capturedAt: "2026-06-18T18:30:05.000Z",
    location: { locationStatus: "Permission denied" },
    site: "Hosur"
  }
);
assert.equal(watermarkedFile.type, "image/jpeg");
assert.equal(renderedCanvas.width, 1280);
assert.equal(renderedCanvas.height, 720);
assert.ok(drawnText.includes("Razk Automation Attendance"));
assert.ok(drawnText.includes("Site: Hosur"));
assert.ok(drawnText.includes("Time: 12:00:05 am"));
assert.ok(drawnText.includes("GPS: Permission denied"));

console.log("Attendance watermark metadata checks passed");
