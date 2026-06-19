import assert from "node:assert/strict";

const values = new Map();
const sessionValues = new Map();
let cookieValue = "";

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value)
  }
});
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key) => sessionValues.get(key) || null,
    setItem: (key, value) => sessionValues.set(key, value)
  }
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    get cookie() {
      return cookieValue;
    },
    set cookie(value) {
      cookieValue = value.split(";")[0];
    }
  }
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { location: { protocol: "https:" } }
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { platform: "Test", userAgent: "Android Chrome/120" }
});

const moduleUrl = new URL("../../client/src/utils/device.js", import.meta.url);
const firstModule = await import(`${moduleUrl.href}?first`);
const first = firstModule.getDeviceInfo().deviceId;
assert.ok(first);
assert.equal(values.get("razk_device_id"), first);
assert.equal(sessionValues.get("razk_device_id"), first);
assert.match(cookieValue, new RegExp(`^razk_device_id=${first}$`));

values.clear();
sessionValues.clear();
const secondModule = await import(`${moduleUrl.href}?reload`);
const recovered = secondModule.getDeviceInfo().deviceId;
assert.equal(recovered, first);
assert.equal(values.get("razk_device_id"), first);
assert.equal(sessionValues.get("razk_device_id"), first);

console.log("Device identity refresh recovery checks passed");
