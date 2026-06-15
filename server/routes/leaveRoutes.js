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
router.post("/apply", authorize("employee", "dri"), applyLeave);
router.get("/my-requests", myLeaveRequests);
router.get("/all", authorize("admin", "hr", "dri"), allLeaveRequests);
router.put("/:id/approve", authorize("admin", "hr", "dri"), approveLeave);
router.put("/:id/reject", authorize("admin", "hr", "dri"), rejectLeave);

module.exports = router;
