const express = require("express");
const {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncements,
  updateAnnouncement
} = require("../controllers/announcementController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.route("/").get(getAnnouncements).post(authorize("admin", "hr"), createAnnouncement);
router
  .route("/:id")
  .put(authorize("admin", "hr"), updateAnnouncement)
  .delete(authorize("admin", "hr"), deleteAnnouncement);

module.exports = router;
