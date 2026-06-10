export const dashboardPathForRole = (role) => {
  if (role === "admin" || role === "super_admin") return "/admin";
  if (role === "hr") return "/hr";
  return "/employee";
};

export const roleMatches = (role, allowedRoles = []) => {
  if (!allowedRoles.length) return true;
  if (role === "super_admin" && allowedRoles.includes("admin")) return true;
  return allowedRoles.includes(role);
};

export const formatDate = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
};

export const formatDateTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};

export const formatTime = (value) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
};

export const formatTopBarDateTime = (value = new Date(), compact = false) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: compact ? undefined : "long",
    day: "2-digit",
    month: "short",
    year: compact ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  })
    .format(value)
    .replace(",", compact ? " |" : ",")
    .replace(" at ", " | ");

export const formatRequestTimestamp = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  const now = new Date();
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(yesterday);
  const time = formatTime(date);

  if (dateKey === todayKey) return `Today, ${time}`;
  if (dateKey === yesterdayKey) return `Yesterday, ${time}`;
  return formatDateTime(date);
};

export const timeAgo = (value) => {
  if (!value) return "";
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return formatDate(value);
};

export const initials = (name = "HY") =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
