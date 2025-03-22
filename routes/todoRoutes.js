const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const { inserttask, gettask, updatetask, deletetask } = require("../controllers/todoCon");

router.post("/tasks", authMiddleware, inserttask);
router.get("/tasks", authMiddleware, gettask);
router.put("/tasks/:id", authMiddleware, updatetask);
router.delete("/tasks/:id", authMiddleware, deletetask);

module.exports = router;
