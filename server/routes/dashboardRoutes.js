const express = require("express");
const {
  adminDashboard,
  employeeDashboard,
  hrDashboard
} = require("../controllers/dashboardController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/admin", authorize("admin"), adminDashboard);
router.get("/hr", authorize("hr", "admin"), hrDashboard);
router.get("/employee", authorize("employee", "hr", "admin"), employeeDashboard);

module.exports = router;
