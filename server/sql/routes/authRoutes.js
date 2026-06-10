const express = require("express");
const { forgotPassword, login, logout, me, refresh } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

router.post("/login", login);
router.post("/refresh", refresh);
router.post("/forgot-password", forgotPassword);
router.post("/logout", protect, logout);
router.get("/me", protect, me);

module.exports = router;
