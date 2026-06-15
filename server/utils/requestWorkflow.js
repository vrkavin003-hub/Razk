const Notification = require("../models/Notification");
const User = require("../models/User");

const employeeFields = "name email employeeId department designation profilePhoto role";

const roleLabel = (role = "") => String(role || "").toLowerCase();
const idOf = (value) => String(value?._id || value || "");

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isHrDepartment = (department = "") => String(department || "").trim().toLowerCase() === "hr";

const appError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const findDepartmentDri = async (department) => {
  if (!department) return null;
  return User.findOne({
    department: { $regex: `^${escapeRegex(department)}$`, $options: "i" },
    isActive: true,
    role: "dri"
  }).sort({ createdAt: 1 });
};

const findRoleApprover = async (role) =>
  User.findOne({
    isActive: true,
    role
  }).sort({ createdAt: 1 });

const requestSnapshot = (requester, requestType) => ({
  requestType,
  requesterName: requester.name,
  requesterRole: requester.role,
  requesterDepartment: requester.department,
  requestRaisedAt: new Date()
});

const resolveRequestAssignment = async (requester) => {
  const requesterRole = roleLabel(requester.role);

  if (requesterRole === "admin") {
    throw appError("Admin self-request is not enabled. Please use HR/Admin workflow.", 403);
  }

  if (requesterRole === "employee" || requesterRole === "hr") {
    const dri = await findDepartmentDri(requester.department);
    if (!dri) {
      throw appError("No DRI assigned for your department. Please contact HR/Admin.", 400);
    }
    return {
      assignedApproverRole: "dri",
      assignedApprover: dri._id,
      assignedApproverName: dri.name,
      assignedDri: dri._id,
      assignedDriName: dri.name
    };
  }

  if (requesterRole === "dri") {
    if (isHrDepartment(requester.department)) {
      const admin = await findRoleApprover("admin");
      if (!admin) throw appError("No Admin approver is available. Please contact support.", 400);
      return {
        assignedApproverRole: "admin",
        assignedApprover: admin._id,
        assignedApproverName: admin.name
      };
    }

    const hr = await findRoleApprover("hr");
    if (!hr) throw appError("No HR approver is available. Please contact Admin.", 400);
    return {
      assignedApproverRole: "hr",
      assignedApprover: hr._id,
      assignedApproverName: hr.name
    };
  }

  throw appError("This role cannot raise requests.", 403);
};

const visibilityQueryForUser = (user, status) => {
  const query = {};
  if (status) query.status = status;

  if (user.role === "admin" || user.role === "hr") return query;

  if (user.role === "dri") {
    query.$or = [{ employee: user._id }, { assignedApprover: user._id }, { assignedDri: user._id }];
    return query;
  }

  query.employee = user._id;
  return query;
};

const isAssignedApprover = (user, request) =>
  idOf(request.assignedApprover) === idOf(user._id) || idOf(request.assignedDri) === idOf(user._id);

const canDecideRequest = (user, request) => {
  if (!user || !request || request.status !== "Pending") return false;
  if (idOf(request.employee) === idOf(user._id)) return false;

  const approverRole = roleLabel(request.assignedApproverRole);
  const requestDepartment = String(request.requesterDepartment || request.employee?.department || "").trim().toLowerCase();
  const userDepartment = String(user.department || "").trim().toLowerCase();
  const legacyDriMatch = user.role === "dri" && !approverRole && requestDepartment && requestDepartment === userDepartment;

  if (user.role === "admin") return true;
  if (user.role === "hr") return approverRole === "hr" && (!request.assignedApprover || isAssignedApprover(user, request));
  if (user.role === "dri") return (approverRole === "dri" && isAssignedApprover(user, request)) || legacyDriMatch;
  return false;
};

const assertCanDecideRequest = (user, request) => {
  if (idOf(request.employee) === idOf(user._id)) {
    throw appError("You cannot approve or reject your own request.", 403);
  }
  if (canDecideRequest(user, request)) return;
  throw appError("You are not allowed to approve or reject this request.", 403);
};

const uniqueIds = (ids) => [...new Set(ids.map(idOf).filter(Boolean))];

const usersByRoles = async (roles) => User.find({ isActive: true, role: { $in: roles } }).select("_id");

const insertNotifications = async (notifications) => {
  const filtered = notifications.filter((notification) => notification.user);
  if (filtered.length) await Notification.insertMany(filtered);
};

const createAssignedNotification = async ({ request, requester, type, title, message }) => {
  const hrUsers = await usersByRoles(["hr"]);
  const recipients = uniqueIds([request.assignedApprover, request.assignedDri, ...hrUsers.map((user) => user._id)]);
  await insertNotifications(
    recipients.map((user) => ({
      user,
      title,
      message,
      type,
      createdBy: requester._id
    }))
  );
};

const formatDateTime = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value || Date.now()));

const decisionRecipients = async (request) => {
  const requesterRole = roleLabel(request.requesterRole || request.employee?.role);
  const requesterDepartment = request.requesterDepartment || request.employee?.department || "";
  const recipients = [request.employee];

  if (requesterRole === "employee") {
    const hrs = await usersByRoles(["hr"]);
    recipients.push(...hrs.map((user) => user._id));
  } else if (requesterRole === "hr") {
    const managers = await usersByRoles(["hr", "admin"]);
    recipients.push(...managers.map((user) => user._id));
  } else if (requesterRole === "dri" && isHrDepartment(requesterDepartment)) {
    const hrs = await usersByRoles(["hr"]);
    recipients.push(...hrs.map((user) => user._id));
  } else if (requesterRole === "dri") {
    const managers = await usersByRoles(["hr", "admin"]);
    recipients.push(...managers.map((user) => user._id));
  }

  return uniqueIds(recipients);
};

const createDecisionNotifications = async ({ request, actor, status, type }) => {
  const recipients = await decisionRecipients(request);
  const requestType = request.requestType || type;
  const message = `${requestType} request raised by ${request.requesterName || request.employee?.name || "Requester"} from ${
    request.requesterDepartment || request.employee?.department || "Razk Automation"
  } department on ${formatDateTime(request.requestRaisedAt || request.createdAt)} was ${status.toLowerCase()} by ${
    actor.name
  } (${actor.role?.toUpperCase()}) on ${formatDateTime(new Date())}.${
    request.adminRemarks ? ` Comment: ${request.adminRemarks}` : ""
  }`;

  await insertNotifications(
    recipients.map((user) => ({
      user,
      title: `${requestType} ${status.toLowerCase()}`,
      message,
      type,
      createdBy: actor._id
    }))
  );
};

const markDecision = (request, actor, status, remarks = "") => {
  request.status = status;
  request.adminRemarks = remarks;
  request.approvedBy = actor._id;
  request.decidedAt = new Date();
  request.reactedBy = actor._id;
  request.reactedByName = actor.name;
  request.reactedByRole = actor.role;
  request.reactedAt = request.decidedAt;
  if (status === "Approved") request.approvalComment = remarks;
  if (status === "Rejected") request.rejectionReason = remarks;
};

const populateRequestQuery = (query) =>
  query
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .populate("assignedApprover", "name role department employeeId profilePhoto")
    .populate("assignedDri", "name role department employeeId profilePhoto")
    .populate("reactedBy", "name role");

module.exports = {
  assertCanDecideRequest,
  createAssignedNotification,
  createDecisionNotifications,
  employeeFields,
  markDecision,
  populateRequestQuery,
  requestSnapshot,
  resolveRequestAssignment,
  visibilityQueryForUser
};
