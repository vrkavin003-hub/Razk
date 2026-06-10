const express = require("express");
const { exportPeriodReport, exportReport } = require("../controllers/reportController");
const { authorize, protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect, authorize("super_admin", "admin", "hr", "manager"));
router.get("/weekly/:type", exportPeriodReport("weekly"));
router.get("/monthly/:type", exportPeriodReport("monthly"));
router.get("/:type", exportReport);

module.exports = router;
