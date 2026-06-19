const pad = (value) => String(value).padStart(2, "0");
const ATTENDANCE_TIME_ZONE = "Asia/Kolkata";

const getTimeZoneParts = (date = new Date(), timeZone = ATTENDANCE_TIME_ZONE) => {
  const current = new Date(date);
  if (Number.isNaN(current.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(current);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const toDateKey = (date = new Date()) => {
  const parts = getTimeZoneParts(date);
  if (!parts) return "";
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const startOfDay = (date = new Date()) => {
  const current = new Date(date);
  current.setHours(0, 0, 0, 0);
  return current;
};

const getWorkingHours = (checkIn, checkOut) => {
  const diffMs = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

const isLateCheckIn = (date = new Date()) => {
  const parts = getTimeZoneParts(date);
  if (!parts) return false;
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return hour > 9 || (hour === 9 && minute > 30);
};

const minutesInAttendanceTimeZone = (date = new Date()) => {
  const parts = getTimeZoneParts(date);
  return parts ? Number(parts.hour) * 60 + Number(parts.minute) : null;
};

const daysBetweenInclusive = (fromDate, toDate) => {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  const diff = to.getTime() - from.getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

module.exports = {
  ATTENDANCE_TIME_ZONE,
  daysBetweenInclusive,
  getWorkingHours,
  minutesInAttendanceTimeZone,
  isLateCheckIn,
  startOfDay,
  toDateKey
};
