const express = require("express");
const {
  deleteApplication,
  listApplications,
  submitCareerApplication,
  updateApplicationStatus
} = require("../controllers/careerController");
const { authorize, protect } = require("../middleware/auth");
const { resumeUpload } = require("../middleware/upload");

const router = express.Router();
const adminOnly = authorize("super_admin", "admin", "hr", "manager");

router.post("/apply", resumeUpload.single("resume"), submitCareerApplication);
router.get("/applications", protect, adminOnly, listApplications);
router.patch("/applications/:id/status", protect, adminOnly, updateApplicationStatus);
router.delete("/applications/:id", protect, authorize("super_admin", "admin"), deleteApplication);

module.exports = router;
