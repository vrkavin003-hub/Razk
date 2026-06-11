const PermissionRequest = require("../models/PermissionRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const {
  PAID_PERMISSION_HOURS_PER_MONTH,
  monthBounds,
  permissionHours,
  splitPaidAllowance
} = require("../utils/requestBalances");

const employeeFields = "name email employeeId department designation profilePhoto";

const approvedPermissionHoursForMonth = async (employeeId, dateValue = new Date(), excludeId = null) => {
  const { from, to } = monthBounds(dateValue);
  const query = {
    date: { $gte: from, $lte: to },
    employee: employeeId,
    status: "Approved"
  };
  if (excludeId) query._id = { $ne: excludeId };
  const permissions = await PermissionRequest.find(query);
  return permissions.reduce((total, permission) => total + Number(permission.paidHours ?? permissionHours(permission.fromTime, permission.toTime)), 0);
};

const permissionBalanceForEmployee = async (employeeId, dateValue = new Date()) => {
  const used = await approvedPermissionHoursForMonth(employeeId, dateValue);
  return {
    limit: PAID_PERMISSION_HOURS_PER_MONTH,
    remaining: Math.max(PAID_PERMISSION_HOURS_PER_MONTH - used, 0),
    used
  };
};

const applyPermission = asyncHandler(async (req, res) => {
  const { permissionType, date, fromTime, toTime, reason } = req.body;

  if (!permissionType || !date || !fromTime || !toTime || !reason) {
    res.status(400);
    throw new Error("Permission type, date, from time, to time, and reason are required");
  }

  const requestedHours = permissionHours(fromTime, toTime);
  if (requestedHours <= 0) {
    res.status(400);
    throw new Error("To time must be after from time");
  }
  const balance = await permissionBalanceForEmployee(req.user._id, date);
  const allowance = splitPaidAllowance(requestedHours, balance.remaining);

  const permission = await PermissionRequest.create({
    employee: req.user._id,
    permissionType,
    date,
    fromTime,
    limitExceeded: allowance.limitExceeded,
    monthlyPaidPermissionRemaining: Math.max(balance.remaining - allowance.paid, 0),
    monthlyPaidPermissionUsed: balance.used,
    paidHours: allowance.paid,
    toTime,
    reason,
    requestedHours,
    unpaidHours: allowance.unpaid
  });

  const reviewers = await User.find({ role: { $in: ["admin", "hr"] }, isActive: true }).select("_id");
  if (reviewers.length) {
    await Notification.insertMany(
      reviewers.map((reviewer) => ({
        user: reviewer._id,
        title: "New permission request",
        message: `${req.user.name} requested ${permissionType} on ${date}.`,
        type: "permission",
        createdBy: req.user._id
      }))
    );
  }

  res.status(201).json({
    balance: {
      ...balance,
      remainingAfterRequest: Math.max(balance.remaining - allowance.paid, 0)
    },
    permission,
    warning: allowance.limitExceeded
      ? "Monthly paid permission limit exceeded. Extra permission will be unpaid or requires special approval."
      : ""
  });
});

const myPermissionRequests = asyncHandler(async (req, res) => {
  const permissions = await PermissionRequest.find({ employee: req.user._id })
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ balance: await permissionBalanceForEmployee(req.user._id), permissions });
});

const allPermissionRequests = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const permissions = await PermissionRequest.find(query)
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  const balances = {};
  for (const permission of permissions) {
    const employeeId = String(permission.employee?._id || permission.employee);
    if (employeeId && !balances[employeeId]) balances[employeeId] = await permissionBalanceForEmployee(employeeId, permission.date);
  }

  res.json({ balances, permissions });
});

const decidePermission = (status) =>
  asyncHandler(async (req, res) => {
    const permission = await PermissionRequest.findById(req.params.id);

    if (!permission) {
      res.status(404);
      throw new Error("Permission request not found");
    }

    const requestedHours = Number(permission.requestedHours || permissionHours(permission.fromTime, permission.toTime));
    const used = await approvedPermissionHoursForMonth(permission.employee, permission.date, permission._id);
    const balance = {
      limit: PAID_PERMISSION_HOURS_PER_MONTH,
      remaining: Math.max(PAID_PERMISSION_HOURS_PER_MONTH - used, 0),
      used
    };
    const allowance = status === "Approved" ? splitPaidAllowance(requestedHours, balance.remaining) : { limitExceeded: permission.limitExceeded, paid: permission.paidHours || 0, unpaid: permission.unpaidHours || 0 };

    permission.status = status;
    permission.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    permission.approvedBy = req.user._id;
    permission.decidedAt = new Date();
    permission.limitExceeded = allowance.limitExceeded;
    permission.monthlyPaidPermissionRemaining = Math.max(balance.remaining - allowance.paid, 0);
    permission.monthlyPaidPermissionUsed = balance.used;
    permission.paidHours = allowance.paid;
    permission.requestedHours = requestedHours;
    permission.unpaidHours = allowance.unpaid;
    await permission.save();

    await Notification.create({
      user: permission.employee,
      title: `Permission ${status.toLowerCase()}`,
      message: `Your permission request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "permission",
      createdBy: req.user._id
    });

    const populated = await PermissionRequest.findById(permission._id)
      .populate("employee", employeeFields)
      .populate("approvedBy", "name role");

    res.json({
      permission: populated,
      warning: allowance.limitExceeded
        ? "Monthly paid permission limit exceeded. Extra permission will be unpaid or requires special approval."
        : ""
    });
  });

module.exports = {
  allPermissionRequests,
  applyPermission,
  approvePermission: decidePermission("Approved"),
  myPermissionRequests,
  permissionBalanceForEmployee,
  rejectPermission: decidePermission("Rejected")
};
