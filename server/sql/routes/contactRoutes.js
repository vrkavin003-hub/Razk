const express = require("express");
const {
  deleteContactMessage,
  listContactMessages,
  submitContactMessage,
  updateContactStatus
} = require("../controllers/contactController");
const { authorize, protect } = require("../middleware/auth");

const router = express.Router();
const adminOnly = authorize("super_admin", "admin", "hr", "manager");

router.post("/", submitContactMessage);
router.get("/", protect, adminOnly, listContactMessages);
router.patch("/:id/status", protect, adminOnly, updateContactStatus);
router.delete("/:id", protect, authorize("super_admin", "admin"), deleteContactMessage);

module.exports = router;
