/**
 * Chatbot Routes
 * ----------------
 * POST /chat       — Send a message
 * POST /chatbot    — Send a message (alias)
 * POST /chat/clear — Clear conversation history
 */

import { Router } from "express";
import { handleChat, handleClearChat } from "../controllers/chatbotController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/chat", requireAuth, handleChat);
router.post("/chatbot", requireAuth, handleChat);
router.post("/chat/clear", requireAuth, handleClearChat);

export default router;
