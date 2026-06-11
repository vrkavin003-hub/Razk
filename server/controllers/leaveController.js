const LeaveRequest = require("../models/LeaveRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const {
  PAID_LEAVE_DAYS_PER_YEAR,
  dateRangeDays,
  splitPaidAllowance,
  yearBounds
} = require("../utils/requestBalances");

const employeeFields = "name email employeeId department designation profilePhoto";

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

  const leave = await LeaveRequest.create({
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

  const reviewers = await User.find({ role: { $in: ["admin", "hr"] }, isActive: true }).select("_id");
  if (reviewers.length) {
    await Notification.insertMany(
      reviewers.map((reviewer) => ({
        user: reviewer._id,
        title: "New leave request",
        message: `${req.user.name} requested ${leaveType} from ${fromDate} to ${toDate}.`,
        type: "leave",
        createdBy: req.user._id
      }))
    );
  }

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
  const leaves = await LeaveRequest.find({ employee: req.user._id })
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ balance: await leaveBalanceForEmployee(req.user._id), leaves });
});

const allLeaveRequests = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const leaves = await LeaveRequest.find(query)
    .populate("employee", employeeFields)
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

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

    const requestedDays = Number(leave.requestedDays || dateRangeDays(leave.fromDate, leave.toDate));
    const used = await approvedLeaveDaysForYear(leave.employee, leave.fromDate, leave._id);
    const balance = {
      limit: PAID_LEAVE_DAYS_PER_YEAR,
      remaining: Math.max(PAID_LEAVE_DAYS_PER_YEAR - used, 0),
      used
    };
    const allowance = status === "Approved" ? splitPaidAllowance(requestedDays, balance.remaining) : { limitExceeded: leave.limitExceeded, paid: leave.paidDays || 0, unpaid: leave.unpaidDays || 0 };

    leave.status = status;
    leave.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    leave.approvedBy = req.user._id;
    leave.decidedAt = new Date();
    leave.limitExceeded = allowance.limitExceeded;
    leave.paidDays = allowance.paid;
    leave.requestedDays = requestedDays;
    leave.unpaidDays = allowance.unpaid;
    leave.yearlyPaidLeaveRemaining = Math.max(balance.remaining - allowance.paid, 0);
    leave.yearlyPaidLeaveUsed = balance.used;
    await leave.save();

    await Notification.create({
      user: leave.employee,
      title: `Leave ${status.toLowerCase()}`,
      message: `Your leave request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "leave",
      createdBy: req.user._id
    });

    const populated = await LeaveRequest.findById(leave._id)
      .populate("employee", employeeFields)
      .populate("approvedBy", "name role");

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
