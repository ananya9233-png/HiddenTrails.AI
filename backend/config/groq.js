/**
 * Groq API Configuration
 * -----------------------
 * Centralizes all Groq API settings: base URL, API key, and model identifiers.
 * All AI service modules import from here instead of hardcoding values.
 */

import dotenv from "dotenv";
dotenv.config();

// Groq API base URL for OpenAI-compatible completions endpoint
export const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";

// API key loaded from environment variable

export const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("❌ FATAL: GROQ_API_KEY not found in .env file");
  process.exit(1);
}

// Model identifiers. Groq retires models over time, so both can be overridden
// in .env (GROQ_TEXT_MODEL / GROQ_VISION_MODEL) without a code change.
// Check what's available: GET https://api.groq.com/openai/v1/models
// (llama-3.1-8b-instant and llama-4-scout were retired in 2026.)
export const LLAMA_TEXT_MODEL = process.env.GROQ_TEXT_MODEL || "qwen/qwen3.8-27b"; // Text: itineraries, chat
export const LLAMA_VISION_MODEL = process.env.GROQ_VISION_MODEL || "qwen/qwen3.8-27b"; // Multimodal vision

/**
 * Helper to build the Authorization header for Groq API calls.
 * @returns {{ Authorization: string, "Content-Type": string }}
 */
export function getGroqHeaders() {
  return {
    Authorization: `Bearer ${GROQ_API_KEY}`,
    "Content-Type": "application/json",
  };
}