const PermissionRequest = require("../models/PermissionRequest");
const Notification = require("../models/Notification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const applyPermission = asyncHandler(async (req, res) => {
  const { permissionType, date, fromTime, toTime, reason } = req.body;

  if (!permissionType || !date || !fromTime || !toTime || !reason) {
    res.status(400);
    throw new Error("Permission type, date, from time, to time, and reason are required");
  }

  const permission = await PermissionRequest.create({
    employee: req.user._id,
    permissionType,
    date,
    fromTime,
    toTime,
    reason
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

  res.status(201).json({ permission });
});

const myPermissionRequests = asyncHandler(async (req, res) => {
  const permissions = await PermissionRequest.find({ employee: req.user._id })
    .populate("employee", "name email employeeId department designation")
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ permissions });
});

const allPermissionRequests = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) query.status = req.query.status;

  const permissions = await PermissionRequest.find(query)
    .populate("employee", "name email employeeId department designation")
    .populate("approvedBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ permissions });
});

const decidePermission = (status) =>
  asyncHandler(async (req, res) => {
    const permission = await PermissionRequest.findById(req.params.id);

    if (!permission) {
      res.status(404);
      throw new Error("Permission request not found");
    }

    permission.status = status;
    permission.adminRemarks = req.body.adminRemarks || req.body.remarks || "";
    permission.approvedBy = req.user._id;
    permission.decidedAt = new Date();
    await permission.save();

    await Notification.create({
      user: permission.employee,
      title: `Permission ${status.toLowerCase()}`,
      message: `Your permission request was ${status.toLowerCase()} by ${req.user.name}.`,
      type: "permission",
      createdBy: req.user._id
    });

    const populated = await PermissionRequest.findById(permission._id)
      .populate("employee", "name email employeeId department designation")
      .populate("approvedBy", "name role");

    res.json({ permission: populated });
  });

module.exports = {
  allPermissionRequests,
  applyPermission,
  approvePermission: decidePermission("Approved"),
  myPermissionRequests,
  rejectPermission: decidePermission("Rejected")
};
