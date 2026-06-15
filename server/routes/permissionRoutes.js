const express = require("express");
const {
  allPermissionRequests,
  applyPermission,
  approvePermission,
  myPermissionRequests,
  rejectPermission
} = require("../controllers/permissionController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/apply", authorize("employee", "dri"), applyPermission);
router.get("/my-requests", myPermissionRequests);
router.get("/all", authorize("admin", "hr", "dri"), allPermissionRequests);
router.put("/:id/approve", authorize("admin", "hr", "dri"), approvePermission);
router.put("/:id/reject", authorize("admin", "hr", "dri"), rejectPermission);

module.exports = router;
