const Notification = require("../models/Notification");
const asyncHandler = require("../utils/asyncHandler");

const getNotifications = asyncHandler(async (req, res) => {
  const query = { user: req.user._id };
  if (req.query.type) query.type = req.query.type;

  const notifications = await Notification.find(query)
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 })
    .limit(Number(req.query.limit) || 50);

  res.json({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.isRead).length
  });
});

const getNotificationCounts = asyncHandler(async (req, res) => {
  const LeaveRequest = require("../models/LeaveRequest");
  const PermissionRequest = require("../models/PermissionRequest");

  if (["admin", "hr"].includes(req.user.role)) {
    const [pendingLeaveCount, pendingPermissionCount] = await Promise.all([
      LeaveRequest.countDocuments({ status: "Pending" }),
      PermissionRequest.countDocuments({ status: "Pending" })
    ]);
    res.json({
      pendingLeaveCount,
      pendingPermissionCount,
      leaveUpdateCount: 0,
      permissionUpdateCount: 0
    });
    return;
  }

  const [leaveUpdateCount, permissionUpdateCount] = await Promise.all([
    Notification.countDocuments({ user: req.user._id, type: "leave", isRead: false }),
    Notification.countDocuments({ user: req.user._id, type: "permission", isRead: false })
  ]);

  res.json({
    pendingLeaveCount: 0,
    pendingPermissionCount: 0,
    leaveUpdateCount,
    permissionUpdateCount
  });
});

const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  notification.isRead = true;
  await notification.save();

  res.json({ notification });
});

const markAllRead = asyncHandler(async (req, res) => {
  const query = { user: req.user._id, isRead: false };
  if (req.query.type) query.type = req.query.type;
  await Notification.updateMany(query, { isRead: true });
  res.json({ message: "All notifications marked as read" });
});

const deleteNotification = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({
    _id: req.params.id,
    user: req.user._id
  });

  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  await notification.deleteOne();
  res.json({ message: "Notification deleted" });
});

module.exports = {
  deleteNotification,
  getNotificationCounts,
  getNotifications,
  markAllRead,
  markNotificationRead
};
