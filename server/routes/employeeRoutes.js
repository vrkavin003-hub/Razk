const express = require("express");
const {
  createEmployee,
  deleteEmployee,
  getEmployeeById,
  getEmployees,
  updateEmployee
} = require("../controllers/employeeController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.route("/").get(authorize("admin", "hr"), getEmployees).post(authorize("admin", "hr"), createEmployee);
router
  .route("/:id")
  .get(getEmployeeById)
  .put(updateEmployee)
  .delete(authorize("admin", "hr"), deleteEmployee);

module.exports = router;
