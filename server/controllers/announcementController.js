const Announcement = require("../models/Announcement");
const Notification = require("../models/Notification");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const targetUsersForAnnouncement = (targetRole) => {
  const query = { isActive: true };
  if (targetRole && targetRole !== "all") query.role = targetRole;
  return User.find(query).select("_id");
};

const createAnnouncement = asyncHandler(async (req, res) => {
  const { title, message, targetRole } = req.body;

  if (!title || !message) {
    res.status(400);
    throw new Error("Title and message are required");
  }

  const announcement = await Announcement.create({
    title,
    message,
    targetRole: targetRole || "all",
    createdBy: req.user._id
  });

  const users = await targetUsersForAnnouncement(targetRole || "all");
  if (users.length) {
    await Notification.insertMany(
      users.map((user) => ({
        user: user._id,
        title,
        message,
        type: "announcement",
        createdBy: req.user._id
      }))
    );
  }

  res.status(201).json({ announcement });
});

const getAnnouncements = asyncHandler(async (req, res) => {
  const allowedTargets = req.user ? ["all", req.user.role] : ["all"];
  const announcements = await Announcement.find({ targetRole: { $in: allowedTargets } })
    .populate("createdBy", "name role")
    .sort({ createdAt: -1 });

  res.json({ announcements });
});

const updateAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }

  announcement.title = req.body.title ?? announcement.title;
  announcement.message = req.body.message ?? announcement.message;
  announcement.targetRole = req.body.targetRole ?? announcement.targetRole;
  await announcement.save();

  res.json({ announcement });
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await Announcement.findById(req.params.id);

  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }

  await announcement.deleteOne();
  res.json({ message: "Announcement deleted" });
});

module.exports = {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement
};
