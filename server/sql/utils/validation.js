const HttpError = require("./httpError");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+\-() ]{7,30}$/;

const cleanString = (value, maxLength = 5000) =>
  String(value ?? "")
    .trim()
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .slice(0, maxLength);

const requireFields = (body, fields) => {
  const missing = fields.filter((field) => !cleanString(body[field]));
  if (missing.length) {
    throw new HttpError(`Missing required field(s): ${missing.join(", ")}`, 400, { missing });
  }
};

const assertEmail = (value, field = "email") => {
  if (!emailPattern.test(cleanString(value, 190))) {
    throw new HttpError(`${field} must be a valid email address`, 400);
  }
};

const assertPhone = (value, field = "phone", required = true) => {
  const phone = cleanString(value, 30);
  if (!phone && !required) return;
  if (!phonePattern.test(phone)) throw new HttpError(`${field} must be a valid phone number`, 400);
};

const assertEnum = (value, allowed, field = "status") => {
  if (!allowed.includes(value)) {
    throw new HttpError(`${field} must be one of: ${allowed.join(", ")}`, 400);
  }
};

const optionalDate = (value) => {
  const date = cleanString(value, 20);
  if (!date) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError("Dates must use YYYY-MM-DD format", 400);
  return date;
};

module.exports = {
  assertEmail,
  assertEnum,
  assertPhone,
  cleanString,
  optionalDate,
  requireFields
};
