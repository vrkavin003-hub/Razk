const express = require("express");
const {
  allODRequests,
  applyOD,
  approveOD,
  myODRequests,
  rejectOD
} = require("../controllers/odController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.post("/apply", authorize("employee", "hr", "admin"), applyOD);
router.get("/my-requests", myODRequests);
router.get("/all", authorize("admin", "hr"), allODRequests);
router.put("/:id/approve", authorize("admin", "hr"), approveOD);
router.put("/:id/reject", authorize("admin", "hr"), rejectOD);

module.exports = router;
