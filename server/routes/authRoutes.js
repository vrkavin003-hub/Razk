const express = require("express");
const {
  forgotPassword,
  login,
  me,
  register,
  resetPassword
} = require("../controllers/authController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/me", protect, me);
router.post("/register", protect, authorize("admin", "hr"), register);

module.exports = router;
