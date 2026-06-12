const express = require("express");
const {
  customExcel,
  customPdf,
  departmentExcel,
  departmentPdf,
  employeeExcel,
  employeePdf,
  getCustomReport,
  getDepartmentReport,
  getEmployeeReport,
  getMonthlyReport,
  monthlyExcel,
  monthlyPdf
} = require("../controllers/reportController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/employee/:employeeId", getEmployeeReport);
router.get("/employee/:employeeId/pdf", employeePdf);
router.get("/employee/:employeeId/excel", employeeExcel);
router.get("/monthly", authorize("admin", "hr"), getMonthlyReport);
router.get("/monthly/pdf", authorize("admin", "hr"), monthlyPdf);
router.get("/monthly/excel", authorize("admin", "hr"), monthlyExcel);
router.get("/department/:department", authorize("admin", "hr"), getDepartmentReport);
router.get("/department/:department/pdf", authorize("admin", "hr"), departmentPdf);
router.get("/department/:department/excel", authorize("admin", "hr"), departmentExcel);
router.get("/custom", authorize("admin", "hr"), getCustomReport);
router.get("/custom/pdf", authorize("admin", "hr"), customPdf);
router.get("/custom/excel", authorize("admin", "hr"), customExcel);

module.exports = router;
