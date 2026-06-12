const express = require("express");
const {
  checkIn,
  checkOut,
  exportCsv,
  getAllAttendance,
  getMyHistory,
  getReport,
  getTodayAttendance
} = require("../controllers/attendanceController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/check-in", authorize("employee", "hr", "admin", "dri"), checkIn);
router.post("/check-out", authorize("employee", "hr", "admin", "dri"), checkOut);
router.get("/today", getTodayAttendance);
router.get("/my-attendance", getMyHistory);
router.get("/my-history", getMyHistory);
router.get("/all", authorize("admin", "hr"), getAllAttendance);
router.get("/report", authorize("admin", "hr"), getReport);
router.get("/export-csv", authorize("admin", "hr"), exportCsv);

module.exports = router;
