/**
 * Chatbot Controller
 * --------------------
 * Handles HTTP request/response for the AI travel chatbot.
 * Conversation memory is keyed by the signed-in user + the browser tab's
 * sessionId, so users can never read or continue each other's chats.
 */

import { chat, clearHistory } from "../services/chatbotService.js";
import { CHATBOT } from "../config/constants.js";

function sessionKey(req) {
  const tab = String(req.body.sessionId || "default").slice(0, 64);
  return `${req.user.uid}:${tab}`;
}

/**
 * POST /chat or POST /chatbot
 * Body: { message: string, sessionId?: string }
 */
export async function handleChat(req, res) {
  try {
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    if (message.length > CHATBOT.MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message is too long (max ${CHATBOT.MAX_MESSAGE_LENGTH} characters)` });
    }

    const reply = await chat(sessionKey(req), message);
    res.json({ reply });
  } catch (error) {
    console.error("❌ Chatbot error:", error);
    res.status(500).json({ error: "Chatbot failed" });
  }
}

/**
 * POST /chat/clear
 * Clears the conversation history for the caller's session.
 */
export async function handleClearChat(req, res) {
  try {
    clearHistory(sessionKey(req));
    res.json({ success: true, message: "Conversation history cleared" });
  } catch (error) {
    console.error("❌ Clear chat error:", error);
    res.status(500).json({ error: "Failed to clear chat history" });
  }
}
