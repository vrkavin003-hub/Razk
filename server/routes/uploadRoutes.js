const express = require("express");
const { uploadFile } = require("../controllers/uploadController");
const { protect } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(protect);
router.post("/image", (req, _res, next) => {
  req.uploadFolder = "images";
  next();
}, upload.single("file"), uploadFile);
router.post("/document", (req, _res, next) => {
  req.uploadFolder = "documents";
  next();
}, upload.single("file"), uploadFile);

module.exports = router;
