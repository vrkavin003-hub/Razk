const ATTENDANCE_SITES = ["Chennai", "Hosur"];

const normalizeAttendanceSite = (value) => {
  const site = String(value || "").trim();
  return ATTENDANCE_SITES.find((item) => item.toLowerCase() === site.toLowerCase()) || "";
};

module.exports = {
  ATTENDANCE_SITES,
  normalizeAttendanceSite
};
