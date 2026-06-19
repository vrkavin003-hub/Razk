const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const normalizeWeekOffDay = (value) => {
  const match = WEEK_DAYS.find((day) => day.toLowerCase() === String(value || "").trim().toLowerCase());
  return match || "Sunday";
};

const dayNameForDateKey = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return WEEK_DAYS[date.getUTCDay()];
};

const isAssignedWeekOffDate = (employee, dateKey) =>
  dayNameForDateKey(dateKey) === normalizeWeekOffDay(employee?.weeklyWeekOffDay);

const weekRangeForDateKey = (dateKey) => {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - date.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
};

module.exports = {
  WEEK_DAYS,
  dayNameForDateKey,
  isAssignedWeekOffDate,
  normalizeWeekOffDay,
  weekRangeForDateKey
};
