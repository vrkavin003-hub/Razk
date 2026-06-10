const express = require("express");
const { counts, listNotifications, markAllRead, markRead } = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/", listNotifications);
router.get("/counts", counts);
router.put("/mark-all-read", markAllRead);
router.put("/:id/read", markRead);

module.exports = router;
