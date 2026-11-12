/**
 * Reward Routes
 * ---------------
 * GET  /rewards/:userId     — Get user's rewards, level, and progress (own data only)
 * POST /rewards/claim-trip  — Claim reward for a validated trip
 */

import { Router } from "express";
import {
  handleGetRewards,
  handleClaimTripReward,
} from "../controllers/rewardController.js";
import { requireAuth, requireSelf } from "../middleware/auth.js";

const router = Router();

// POST route must be registered BEFORE the parameterized GET route
// to avoid Express matching "claim-trip" as a :userId parameter
router.post("/rewards/claim-trip", requireAuth, handleClaimTripReward);
router.get("/rewards/:userId", requireAuth, requireSelf, handleGetRewards);

export default router;
