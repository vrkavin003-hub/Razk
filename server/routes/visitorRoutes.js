const express = require("express");
const { createVisitor, deleteVisitor, listVisitors, updateVisitor } = require("../controllers/visitorController");
const { authorize, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorize("admin", "hr"));
router.route("/").get(listVisitors).post(createVisitor);
router.route("/:id").put(updateVisitor).delete(deleteVisitor);

module.exports = router;
