const express = require("express");
const {
  allLeaveRequests,
  applyLeave,
  approveLeave,
  myLeaveRequests,
  rejectLeave
} = require("../controllers/leaveController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/apply", authorize("employee", "hr", "admin"), applyLeave);
router.get("/my-requests", myLeaveRequests);
router.get("/all", authorize("admin", "hr"), allLeaveRequests);
router.put("/:id/approve", authorize("admin", "hr"), approveLeave);
router.put("/:id/reject", authorize("admin", "hr"), rejectLeave);

module.exports = router;
