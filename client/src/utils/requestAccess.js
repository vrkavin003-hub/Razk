const idOf = (value) => String(value?._id || value || "");
const textOf = (value) => String(value || "").trim().toLowerCase();

export const canDecideRequest = (request, user) => {
  if (!request || !user || request.status !== "Pending") return false;
  if (idOf(request.employee) === idOf(user._id)) return false;

  if (user.role === "admin") return true;

  const assignedApproverRole = String(request.assignedApproverRole || "").toLowerCase();
  const isAssignedToUser = idOf(request.assignedApprover) === idOf(user._id) || idOf(request.assignedDri) === idOf(user._id);
  const requestDepartment = textOf(request.requesterDepartment || request.employee?.department);
  const userDepartment = textOf(user.department);
  const legacyDepartmentMatch = !assignedApproverRole && user.role === "dri" && requestDepartment && requestDepartment === userDepartment;

  if (user.role === "hr") return assignedApproverRole === "hr" && isAssignedToUser;
  if (user.role === "dri") return (assignedApproverRole === "dri" && isAssignedToUser) || legacyDepartmentMatch;
  return false;
};

export const requestRequesterName = (request, fallback = "-") => request?.requesterName || request?.employee?.name || fallback;

export const requestRequesterMeta = (request) =>
  [request?.requesterRole || request?.employee?.role, request?.requesterDepartment || request?.employee?.department].filter(Boolean).join(" | ");
