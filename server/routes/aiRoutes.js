const router = require("express").Router();
const { protect } = require("../middleware/authMiddleware");
const { chatStream, getChatStats, listChats, getChat, deleteChat } = require("../controllers/aiController");

router.post("/chat/stream", protect, chatStream);
router.get("/chats/stats", protect, getChatStats);
router.get("/chats", protect, listChats);
router.get("/chats/:id", protect, getChat);
router.delete("/chats/:id", protect, deleteChat);

module.exports = router;