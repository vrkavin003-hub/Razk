const LeaveRequest = require("../models/LeaveRequest");
const asyncHandler = require("../utils/asyncHandler");
const {
  PAID_LEAVE_DAYS_PER_YEAR,
  dateRangeDays,
  splitPaidAllowance,
  yearBounds
} = require("../utils/requestBalances");
const {
  assertCanDecideRequest,
  createAssignedNotification,
  createDecisionNotifications,
  employeeFields,
  markDecision,
  populateRequestQuery,
  requestSnapshot,
  resolveRequestAssignment,
  visibilityQueryForUser
} = require("../utils/requestWorkflow");

const approvedLeaveDaysForYear = async (employeeId, dateValue = new Date(), excludeId = null) => {
  const { from, to } = yearBounds(dateValue);
  const query = {
    employee: employeeId,
    fromDate: { $lte: to },
    status: "Approved",
    toDate: { $gte: from }
  };
  if (excludeId) query._id = { $ne: excludeId };
  const leaves = await LeaveRequest.find(query);
  return leaves.reduce((total, leave) => total + Number(leave.paidDays ?? dateRangeDays(leave.fromDate, leave.toDate)), 0);
};

const leaveBalanceForEmployee = async (employeeId, dateValue = new Date()) => {
  const used = await approvedLeaveDaysForYear(employeeId, dateValue);
  return {
    limit: PAID_LEAVE_DAYS_PER_YEAR,
    remaining: Math.max(PAID_LEAVE_DAYS_PER_YEAR - used, 0),
    used
  };
};

const applyLeave = asyncHandler(async (req, res) => {
  const { leaveType, fromDate, toDate, reason, attachment } = req.body;

  if (!leaveType || !fromDate || !toDate || !reason) {
    res.status(400);
    throw new Error("Leave type, from date, to date, and reason are required");
  }

  if (new Date(toDate) < new Date(fromDate)) {
    res.status(400);
    throw new Error("To date cannot be before from date");
  }

  const requestedDays = dateRangeDays(fromDate, toDate);
  const balance = await leaveBalanceForEmployee(req.user._id, fromDate);
  const allowance = splitPaidAllowance(requestedDays, balance.remaining);
  const assignment = await resolveRequestAssignment(req.user);

  const leave = await LeaveRequest.create({
    ...assignment,
    ...requestSnapshot(req.user, "Leave"),
    employee: req.user._id,
    leaveType,
    fromDate,
    limitExceeded: allowance.limitExceeded,
    toDate,
    paidDays: allowance.paid,
    reason,
    attachment,
    requestedDays,
    unpaidDays: allowance.unpaid,
    yearlyPaidLeaveRemaining: Math.max(balance.remaining - allowance.paid, 0),
    yearlyPaidLeaveUsed: balance.used
  });

  await createAssignedNotification({
    request: leave,
    requester: req.user,
    type: "leave",
    title: "New leave request assigned",
    message: `${req.user.name} (${req.user.role?.toUpperCase()}) requested ${leaveType} from ${fromDate} to ${toDate}.`
  });

  res.status(201).json({
    balance: {
      ...balance,
      remainingAfterRequest: Math.max(balance.remaining - allowance.paid, 0)
    },
    leave,
    warning: allowance.limitExceeded
      ? "Yearly paid leave limit exceeded. Extra leave will be unpaid or requires special approval."
      : ""
  });
});

const myLeaveRequests = asyncHandler(async (req, res) => {
  const leaves = await populateRequestQuery(LeaveRequest.find({ employee: req.user._id })).sort({ createdAt: -1 });

  res.json({ balance: await leaveBalanceForEmployee(req.user._id), leaves });
});

const allLeaveRequests = asyncHandler(async (req, res) => {
  const query = visibilityQueryForUser(req.user, req.query.status);

  const leaves = await populateRequestQuery(LeaveRequest.find(query)).sort({ createdAt: -1 });

  const balances = {};
  for (const leave of leaves) {
    const employeeId = String(leave.employee?._id || leave.employee);
    if (employeeId && !balances[employeeId]) balances[employeeId] = await leaveBalanceForEmployee(employeeId, leave.fromDate);
  }

  res.json({ balances, leaves });
});

const decideLeave = (status) =>
  asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      res.status(404);
      throw new Error("Leave request not found");
    }

    assertCanDecideRequest(req.user, leave);

    const requestedDays = Number(leave.requestedDays || dateRangeDays(leave.fromDate, leave.toDate));
    const used = await approvedLeaveDaysForYear(leave.employee, leave.fromDate, leave._id);
    const balance = {
      limit: PAID_LEAVE_DAYS_PER_YEAR,
      remaining: Math.max(PAID_LEAVE_DAYS_PER_YEAR - used, 0),
      used
    };
    const allowance = status === "Approved" ? splitPaidAllowance(requestedDays, balance.remaining) : { limitExceeded: leave.limitExceeded, paid: leave.paidDays || 0, unpaid: leave.unpaidDays || 0 };

    markDecision(leave, req.user, status, req.body.adminRemarks || req.body.remarks || "");
    leave.limitExceeded = allowance.limitExceeded;
    leave.paidDays = allowance.paid;
    leave.requestedDays = requestedDays;
    leave.unpaidDays = allowance.unpaid;
    leave.yearlyPaidLeaveRemaining = Math.max(balance.remaining - allowance.paid, 0);
    leave.yearlyPaidLeaveUsed = balance.used;
    await leave.save();

    await createDecisionNotifications({
      request: leave,
      actor: req.user,
      status,
      type: "leave"
    });

    const populated = await populateRequestQuery(LeaveRequest.findById(leave._id));

    res.json({
      leave: populated,
      warning: allowance.limitExceeded
        ? "Yearly paid leave limit exceeded. Extra leave will be unpaid or requires special approval."
        : ""
    });
  });

module.exports = {
  allLeaveRequests,
  applyLeave,
  approveLeave: decideLeave("Approved"),
  leaveBalanceForEmployee,
  myLeaveRequests,
  rejectLeave: decideLeave("Rejected")
};
