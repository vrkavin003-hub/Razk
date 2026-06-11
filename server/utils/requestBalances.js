const { daysBetweenInclusive } = require("./dates");

const PAID_LEAVE_DAYS_PER_YEAR = 18;
const PAID_PERMISSION_HOURS_PER_MONTH = 2;

const dateRangeDays = (fromDate, toDate) => daysBetweenInclusive(new Date(fromDate), new Date(toDate));

const permissionHours = (fromTime, toTime) => {
  if (!fromTime || !toTime) return 0;
  const [fromHour, fromMinute] = fromTime.split(":").map(Number);
  const [toHour, toMinute] = toTime.split(":").map(Number);
  const from = fromHour * 60 + fromMinute;
  const to = toHour * 60 + toMinute;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.round(((to - from) / 60) * 100) / 100;
};

const yearBounds = (value = new Date()) => {
  const date = new Date(value);
  const from = new Date(date.getFullYear(), 0, 1);
  const to = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
  return { from, to, year: date.getFullYear() };
};

const monthBounds = (value = new Date()) => {
  const date = new Date(value);
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, month: date.getMonth() + 1, to, year: date.getFullYear() };
};

const splitPaidAllowance = (requested, remaining) => {
  const paid = Math.max(Math.min(requested, remaining), 0);
  const unpaid = Math.max(requested - paid, 0);
  return {
    limitExceeded: unpaid > 0,
    paid: Math.round(paid * 100) / 100,
    unpaid: Math.round(unpaid * 100) / 100
  };
};

module.exports = {
  PAID_LEAVE_DAYS_PER_YEAR,
  PAID_PERMISSION_HOURS_PER_MONTH,
  dateRangeDays,
  monthBounds,
  permissionHours,
  splitPaidAllowance,
  yearBounds
};
