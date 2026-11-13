/**
 * Itinerary Routes
 * ------------------
 * POST /generate-itinerary   — Generate a new AI itinerary (saved to the caller's trips)
 * POST /regenerate-itinerary — Regenerate one of the caller's trips
 */

import { Router } from "express";
import {
  handleGenerateItinerary,
  handleRegenerateItinerary,
} from "../controllers/itineraryController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.post("/generate-itinerary", requireAuth, handleGenerateItinerary);
router.post("/regenerate-itinerary", requireAuth, handleRegenerateItinerary);

export default router;
