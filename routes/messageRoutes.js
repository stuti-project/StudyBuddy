const express = require("express");
const authMiddleware =require("../middlewares/authMiddleware.js");
const { getMessages, getUsersForSidebar, sendMessage } =require("../controllers/messageController.js");

const router = express.Router();

router.get("/users", authMiddleware, getUsersForSidebar);
router.get("/:id", authMiddleware, getMessages);

router.post("/send/:id", authMiddleware, sendMessage);

module.exports = router;