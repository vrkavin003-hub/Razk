const express = require("express");
const { allAttendance, checkIn, checkOut, exportCsv, myAttendance, todayAttendance } = require("../controllers/attendanceController");
const { authorize, protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.post("/check-in", authorize("super_admin", "admin", "hr", "employee", "dri"), checkIn);
router.post("/check-out", authorize("super_admin", "admin", "hr", "employee", "dri"), checkOut);
router.get("/today", todayAttendance);
router.get("/my-attendance", myAttendance);
router.get("/my-history", myAttendance);
router.get("/all", authorize("super_admin", "admin", "hr", "manager"), allAttendance);
router.get("/export-csv", authorize("super_admin", "admin", "hr", "manager"), exportCsv);

module.exports = router;
