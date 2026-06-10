const express = require("express");
const {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement
} = require("../controllers/announcementController");
const { authorize, protect } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, listAnnouncements);
router.post("/", protect, authorize("super_admin", "admin", "hr"), createAnnouncement);
router.patch("/:id", protect, authorize("super_admin", "admin", "hr"), updateAnnouncement);
router.delete("/:id", protect, authorize("super_admin", "admin"), deleteAnnouncement);

module.exports = router;
