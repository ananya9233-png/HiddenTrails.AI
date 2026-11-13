/**
 * Coupon Controller
 * -------------------
 * Handles HTTP request/response for the coupon store.
 * The user is always the authenticated caller (req.user.uid).
 */

import { getCouponsForUser, redeemCoupon } from "../services/couponService.js";
import { db } from "../config/firebase.js";

/**
 * GET /coupons
 * Returns the coupon catalog, the caller's points, and their redeemed coupons.
 */
export async function handleGetCoupons(req, res) {
  try {
    const result = await getCouponsForUser(req.user.uid, db);
    res.json(result);
  } catch (error) {
    console.error("❌ Get coupons error:", error);
    res.status(500).json({ error: "Failed to retrieve coupons" });
  }
}

/**
 * POST /coupon/redeem
 * Body: { couponCode: string }
 */
export async function handleRedeemCoupon(req, res) {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({ error: "Coupon code is required" });
    }

    const result = await redeemCoupon(req.user.uid, couponCode, db);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("❌ Redeem coupon error:", error);
    res.status(500).json({ error: "Failed to redeem coupon" });
  }
}
