const LeaveRequest = require("../models/LeaveRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

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

  const leave = await LeaveRequest.create({
    employee: req.user._id,
    leaveType,
    fromDate,
    toDate,
    reason,
    attachment
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

  res.status(201).json({ leave });
});

const myLeaveRequests = asyncHandler(async (req, res) => {
  const leaves = await LeaveRequest.find({ employee: req.user._id })
    .populate("employee", "name email employeeId department designation")
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ leaves });
});

const allLeaveRequests = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const leaves = await LeaveRequest.find(query)
    .populate("employee", "name email employeeId department designation")
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ leaves });
});

const decideLeave = (status) =>
  asyncHandler(async (req, res) => {
    const leave = await LeaveRequest.findById(req.params.id);

    if (!leave) {
      res.status(404);
      throw new Error("Leave request not found");
    }

    leave.status = status;
    leave.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    leave.approvedBy = req.user._id;
    leave.decidedAt = new Date();
    await leave.save();

    await Notification.create({
      user: leave.employee,
      title: `Leave ${status.toLowerCase()}`,
      message: `Your leave request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "leave",
      createdBy: req.user._id
    });

    const populated = await LeaveRequest.findById(leave._id)
      .populate("employee", "name email employeeId department designation")
      .populate("approvedBy", "name role");

    res.json({ leave: populated });
  });

module.exports = {
  allLeaveRequests,
  applyLeave,
  approveLeave: decideLeave("Approved"),
  myLeaveRequests,
  rejectLeave: decideLeave("Rejected")
};
