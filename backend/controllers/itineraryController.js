/**
 * Itinerary Controller
 * ----------------------
 * Handles HTTP request/response logic for itinerary generation endpoints.
 * Delegates business logic to itineraryService.
 */

import {
  generateItinerary,
  saveItineraryToFirestore,
  regenerateItinerary,
} from "../services/itineraryService.js";
import { generatePhotoChallenges } from "../services/challengeService.js";
import { db } from "../config/firebase.js";
import { ITINERARY } from "../config/constants.js";

function parseISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * POST /generate-itinerary
 * Generates a new AI itinerary and saves it to the caller's trips.
 */
export async function handleGenerateItinerary(req, res) {
  try {
    const userId = req.user.uid;
    const destination = String(req.body.destination || "").trim().slice(0, 100);
    const preference = String(req.body.preference || "Adventure").trim().slice(0, 40);
    const budget = Number(req.body.budget);
    let days = parseInt(req.body.days, 10);
    const { arrivalDate, returnDate } = req.body;

    console.log("🗺️ ITINERARY HIT:", destination, "| Days:", days, "| Pref:", preference, "| Budget:", budget);

    if (!destination) {
      return res.status(400).json({ error: "Destination is required" });
    }

    // Date validation (dates win over the "days" field when both are given)
    if (arrivalDate || returnDate) {
      const arrival = parseISODate(arrivalDate);
      const ret = parseISODate(returnDate);
      if (!arrival || !ret) {
        return res.status(400).json({ error: "Dates must be in YYYY-MM-DD format" });
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (arrival < today) {
        return res.status(400).json({ error: "Arrival date cannot be in the past" });
      }
      if (ret < arrival) {
        return res.status(400).json({ error: "Return date must be after arrival date" });
      }
      days = Math.round((ret - arrival) / 86400000) + 1;
    }

    if (!Number.isInteger(days) || days < 1) days = 3;
    if (days > ITINERARY.MAX_DAYS) {
      return res.status(400).json({ error: `Trips can be at most ${ITINERARY.MAX_DAYS} days long` });
    }

    if (!Number.isFinite(budget) || budget < ITINERARY.MIN_BUDGET) {
      return res.status(400).json({ error: `Budget must be at least ₹${ITINERARY.MIN_BUDGET}` });
    }
    if (budget > ITINERARY.MAX_BUDGET) {
      return res.status(400).json({ error: "Budget too large" });
    }

    const itinerary = await generateItinerary({ destination, days, preference, budget });

    const tripId = await saveItineraryToFirestore(
      userId,
      { destination, days, budget, preference, arrivalDate: arrivalDate || null, returnDate: returnDate || null },
      itinerary,
      db
    );

    // Auto-generate photo challenges for this destination (fire-and-forget)
    generatePhotoChallenges(userId, destination, itinerary.days, db)
      .catch((err) => console.warn("⚠️ Challenge generation failed (non-fatal):", err.message));

    res.json({ ...itinerary, tripId });
  } catch (error) {
    console.error("❌ Itinerary generation error:", error);
    res.status(500).json({ error: "Itinerary generation failed" });
  }
}

/**
 * POST /regenerate-itinerary
 * Regenerates the itinerary for one of the caller's existing trips.
 */
export async function handleRegenerateItinerary(req, res) {
  try {
    const { tripId } = req.body;

    if (!tripId) {
      return res.status(400).json({ error: "Trip ID is required" });
    }

    const result = await regenerateItinerary(tripId, req.user.uid, db);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    // Refresh the photo challenges to match the new plan
    generatePhotoChallenges(req.user.uid, result.destination, result.itinerary.days, db)
      .catch((err) => console.warn("⚠️ Challenge regeneration failed (non-fatal):", err.message));

    res.json(result.itinerary);
  } catch (error) {
    console.error("❌ Regeneration error:", error);
    res.status(500).json({ error: "Itinerary regeneration failed" });
  }
}
