/**
 * Photo Challenge Routes
 * ------------------------
 * POST   /verify-photo                         — Verify a photo (alias: /photo/verify)
 * GET    /photo-challenges/:userId             — Built-in + itinerary challenges, completion state
 * DELETE /photo-challenges/:userId/:destination — Delete itinerary challenges for a destination
 * POST   /photo/reset-demo                     — Reset the demo challenge (dev tool)
 *
 * All routes require a signed-in user; :userId must be the caller.
 */

import { Router } from "express";
import {
  handleVerifyPhoto,
  handleListChallenges,
  handleDeleteChallenges,
  handleResetDemo,
} from "../controllers/photoController.js";
import { requireAuth, requireSelf } from "../middleware/auth.js";

const router = Router();

router.post("/verify-photo", requireAuth, handleVerifyPhoto);
router.post("/photo/verify", requireAuth, handleVerifyPhoto);
router.post("/photo/reset-demo", requireAuth, handleResetDemo);

router.get("/photo-challenges/:userId", requireAuth, requireSelf, handleListChallenges);
router.delete("/photo-challenges/:userId/:destination", requireAuth, requireSelf, handleDeleteChallenges);

export default router;
