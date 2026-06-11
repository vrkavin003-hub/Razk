const shiftNames = ["1st Shift", "2nd Shift", "3rd Shift", "General Shift"];

export const normalizeShiftName = (value) => {
  const shift = String(value || "").trim();
  return shiftNames.includes(shift) ? shift : "";
};

const minutesFromDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
};

const inRange = (minutes, start, end) => {
  if (start <= end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
};

export const getShiftFromCheckIn = (checkInTime, assignedShift = "") => {
  const normalizedAssignedShift = normalizeShiftName(assignedShift);
  if (normalizedAssignedShift) return normalizedAssignedShift;

  const minutes = minutesFromDate(checkInTime);
  if (minutes === null) return "Not marked";

  if (inRange(minutes, 23 * 60, 6 * 60)) return "3rd Shift";
  if (inRange(minutes, 14 * 60 + 30, 23 * 60)) return "2nd Shift";
  if (inRange(minutes, 9 * 60, 17 * 60 + 30)) return "General Shift";
  if (inRange(minutes, 6 * 60, 14 * 60 + 30)) return "1st Shift";
  return "Not marked";
};

export const attendanceShift = (record = {}) =>
  record.shiftName || record.shift || getShiftFromCheckIn(record.checkIn, record.employee?.assignedShift);
