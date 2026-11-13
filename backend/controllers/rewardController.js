/**
 * Reward Controller
 * -------------------
 * Handles HTTP request/response for rewards and trip-based point claims.
 * The user is always the authenticated caller (req.user.uid).
 */

import { getUserRewards, awardTripReward } from "../services/rewardService.js";
import { db } from "../config/firebase.js";

/**
 * GET /rewards/:userId
 * Returns the user's current points, level, progress, and completed challenges.
 */
export async function handleGetRewards(req, res) {
  try {
    const rewards = await getUserRewards(req.user.uid, db);
    res.json(rewards);
  } catch (error) {
    console.error("❌ Get rewards error:", error);
    res.status(500).json({ error: "Failed to retrieve rewards" });
  }
}

/**
 * POST /rewards/claim-trip
 *
 * Body:
 * {
 *   gpsPoints: [{ latitude, longitude, timestamp }],
 *   visitedPOIs: [{ poiId, arrivalTime, departureTime }]
 * }
 */
export async function handleClaimTripReward(req, res) {
  try {
    const { gpsPoints, visitedPOIs } = req.body;

    if (!Array.isArray(gpsPoints) || gpsPoints.length < 2) {
      return res.status(400).json({ error: "Valid GPS data is required" });
    }

    if (!Array.isArray(visitedPOIs)) {
      return res.status(400).json({ error: "Visited POIs data is required" });
    }

    const result = await awardTripReward(req.user.uid, { gpsPoints, visitedPOIs }, db);

    if (result.success) {
      res.json({
        success: true,
        points: result.points,
        totalPoints: result.totalPoints,
        level: result.level,
        tripStats: result.tripStats,
      });
    } else {
      res.status(400).json({ success: false, errors: result.errors });
    }
  } catch (error) {
    console.error("❌ Trip reward error:", error);
    res.status(500).json({ error: "Failed to process trip reward" });
  }
}
