const express = require("express");
const {
  createOfficeLocation,
  listOfficeLocations,
  previewDistance,
  updateOfficeLocation
} = require("../controllers/officeLocationController");
const { authorize, protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/", listOfficeLocations);
router.get("/distance", previewDistance);
router.post("/", authorize("super_admin", "admin"), createOfficeLocation);
router.put("/:id", authorize("super_admin", "admin"), updateOfficeLocation);

module.exports = router;
