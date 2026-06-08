const pad = (value) => String(value).padStart(2, "0");

const toDateKey = (date = new Date()) => {
  const current = new Date(date);
  return `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`;
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
  const current = new Date(date);
  return current.getHours() > 9 || (current.getHours() === 9 && current.getMinutes() > 30);
};

const daysBetweenInclusive = (fromDate, toDate) => {
  const from = startOfDay(fromDate);
  const to = startOfDay(toDate);
  const diff = to.getTime() - from.getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

module.exports = {
  daysBetweenInclusive,
  getWorkingHours,
  isLateCheckIn,
  startOfDay,
  toDateKey
};
