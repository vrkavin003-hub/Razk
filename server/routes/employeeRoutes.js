const express = require("express");
const {
  approveEmployeeDevice,
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  getPendingDeviceRequests,
  rejectEmployeeDevice,
  resetEmployeeDevice,
  updateEmployee
} = require("../controllers/employeeController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "hr"), getEmployees).post(authorize("admin", "hr"), createEmployee);
router.get("/device-requests/pending", authorize("hr"), getPendingDeviceRequests);
router.patch("/:id/device/approve", authorize("hr"), approveEmployeeDevice);
router.patch("/:id/device/reject", authorize("hr"), rejectEmployeeDevice);
router.patch("/:id/reset-device", authorize("hr"), resetEmployeeDevice);
router
  .route("/:id")
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(authorize("admin", "hr"), deleteEmployee);

module.exports = router;
