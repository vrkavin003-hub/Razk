const express = require("express");
const {
  deleteNotification,
  getNotificationCounts,
  getNotifications,
  markAllRead,
  markNotificationRead
} = require("../controllers/notificationController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", getNotifications);
router.get("/counts", getNotificationCounts);
router.put("/mark-all-read", markAllRead);
router.put("/:id/read", markNotificationRead);
router.delete("/:id", deleteNotification);

module.exports = router;
