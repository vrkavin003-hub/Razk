const express = require("express");
const {
  createOfficeLocation,
  getOfficeLocations,
  previewOfficeDistance,
  updateOfficeLocation
} = require("../controllers/officeLocationController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);
router.get("/", getOfficeLocations);
router.get("/distance", previewOfficeDistance);
router.post("/", authorize("admin"), createOfficeLocation);
router.put("/:id", authorize("admin"), updateOfficeLocation);

module.exports = router;
