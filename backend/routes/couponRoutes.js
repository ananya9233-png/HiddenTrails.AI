/**
 * Coupon Routes
 * ---------------
 * GET  /coupons          — Coupon catalog + caller's points and redeemed coupons
 * POST /coupon/redeem    — Redeem a coupon from the catalog
 */

import { Router } from "express";
import {
  handleGetCoupons,
  handleRedeemCoupon,
} from "../controllers/couponController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/coupons", requireAuth, handleGetCoupons);
router.post("/coupon/redeem", requireAuth, handleRedeemCoupon);

export default router;
