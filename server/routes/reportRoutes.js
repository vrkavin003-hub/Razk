const express = require("express");
const {
  customPdf,
  departmentPdf,
  employeePdf,
  getCustomReport,
  getDepartmentReport,
  getEmployeeReport,
  getMonthlyReport,
  monthlyPdf
} = require("../controllers/reportController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/employee/:employeeId", getEmployeeReport);
router.get("/employee/:employeeId/pdf", employeePdf);
router.get("/monthly", authorize("admin", "hr"), getMonthlyReport);
router.get("/monthly/pdf", authorize("admin", "hr"), monthlyPdf);
router.get("/department/:department", authorize("admin", "hr"), getDepartmentReport);
router.get("/department/:department/pdf", authorize("admin", "hr"), departmentPdf);
router.get("/custom", authorize("admin", "hr"), getCustomReport);
router.get("/custom/pdf", authorize("admin", "hr"), customPdf);

module.exports = router;
