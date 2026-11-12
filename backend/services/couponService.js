/**
 * Coupon Service
 * ----------------
 * Coupon store backed by a fixed catalog (config/constants.js).
 * A redemption deducts points and records the coupon on the user's
 * document inside a Firestore transaction, so points can't go negative
 * and the same coupon can't be redeemed twice by concurrent requests.
 */

import { COUPON_CATALOG } from "../config/constants.js";
import { getLevel } from "../utils/levelCalculator.js";

/**
 * Get the catalog annotated for a specific user.
 *
 * @param {string} userId
 * @param {admin.firestore.Firestore} db
 */
export async function getCouponsForUser(userId, db) {
  const userDoc = await db.collection("users").doc(userId).get();
  const data = userDoc.exists ? userDoc.data() : {};
  const points = data.rewardPoints || 0;
  const redeemed = Array.isArray(data.coupons) ? data.coupons : [];
  const redeemedCodes = new Set(redeemed.map((c) => c.code));

  return {
    points,
    catalog: COUPON_CATALOG.map((c) => ({
      ...c,
      redeemed: redeemedCodes.has(c.code),
      affordable: points >= c.cost,
    })),
    redeemed,
  };
}

/**
 * Redeem a coupon from the catalog for a user.
 *
 * @param {string} userId
 * @param {string} couponCode
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ success: boolean, message: string, remainingPoints?: number }>}
 */
export async function redeemCoupon(userId, couponCode, db) {
  const coupon = COUPON_CATALOG.find((c) => c.code === couponCode);
  if (!coupon) {
    return { success: false, message: "Coupon not found" };
  }

  const userRef = db.collection("users").doc(userId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists ? snap.data() : {};
    const points = data.rewardPoints || 0;
    const coupons = Array.isArray(data.coupons) ? data.coupons : [];

    if (coupons.some((c) => c.code === coupon.code)) {
      return { success: false, message: "You have already redeemed this coupon" };
    }

    if (points < coupon.cost) {
      return {
        success: false,
        message: `This coupon costs ${coupon.cost} points (you have ${points})`,
      };
    }

    const remainingPoints = points - coupon.cost;
    const level = getLevel(remainingPoints);

    tx.set(
      userRef,
      {
        rewardPoints: remainingPoints,
        level: level.name,
        levelNumber: level.level,
        coupons: [
          ...coupons,
          {
            code: coupon.code,
            brand: coupon.brand,
            discount: coupon.discount,
            icon: coupon.icon,
            cost: coupon.cost,
            redeemedAt: new Date().toISOString(),
          },
        ],
        updatedAt: new Date(),
      },
      { merge: true }
    );

    console.log(`✅ Coupon ${coupon.code} redeemed by ${userId} (-${coupon.cost} pts)`);

    return {
      success: true,
      message: `Coupon "${coupon.code}" redeemed successfully!`,
      deductedPoints: coupon.cost,
      remainingPoints,
    };
  });
}
