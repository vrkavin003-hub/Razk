const express = require("express");
const { createUser, dashboard, deleteUser, listUsers, updateUser } = require("../controllers/adminController");
const { authorize, protect } = require("../middleware/auth");

const router = express.Router();

router.use(protect);
router.get("/dashboard", authorize("super_admin", "admin", "hr", "manager", "viewer"), dashboard);
router.get("/users", authorize("super_admin", "admin", "hr"), listUsers);
router.post("/users", authorize("super_admin", "admin"), createUser);
router.patch("/users/:id", authorize("super_admin", "admin"), updateUser);
router.delete("/users/:id", authorize("super_admin"), deleteUser);

module.exports = router;
