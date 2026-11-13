/**
 * Reward Service
 * ----------------
 * The backend is the ONLY writer of reward points. The frontend just reads
 * them (Firestore rules block clients from changing rewardPoints).
 *
 * Supports photo challenge rewards and GPS-validated trip rewards.
 */

import {
  calculateRewardPoints,
  checkDailyCap,
  checkMonthlyCap,
} from "../utils/rewardCalculator.js";
import { getLevel, calculateProgress } from "../utils/levelCalculator.js";
import { validateTrip } from "./gpsService.js";
import { REWARDS } from "../config/constants.js";

/**
 * Award points for a photo challenge — at most once per challenge per user.
 * Runs in a transaction so double-submits can't award twice.
 *
 * @param {string} userId
 * @param {string} challengeId
 * @param {number} points
 * @param {{ landmarkMatchScore: number, livenessScore: number }} verificationResult
 * @param {admin.firestore.Firestore} db
 * @returns {Promise<{ awarded: boolean, alreadyCompleted: boolean, totalPoints: number, level: object }>}
 */
export async function awardPhotoPoints(userId, challengeId, points, verificationResult, db) {
  const userRef = db.collection("users").doc(userId);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const data = snap.exists ? snap.data() : {};
    const currentPoints = data.rewardPoints || 0;
    const completed = Array.isArray(data.completedChallenges) ? data.completedChallenges : [];

    if (completed.includes(challengeId)) {
      return {
        awarded: false,
        alreadyCompleted: true,
        totalPoints: currentPoints,
        level: getLevel(currentPoints),
      };
    }

    const newTotal = currentPoints + points;
    const newLevel = getLevel(newTotal);

    tx.set(
      userRef,
      {
        rewardPoints: newTotal,
        level: newLevel.name,
        levelNumber: newLevel.level,
        completedChallenges: [...completed, challengeId],
        updatedAt: new Date(),
      },
      { merge: true }
    );

    // Completion record (kept separate from challenge definitions)
    tx.set(userRef.collection("photoCompletions").doc(challengeId), {
      challengeId,
      pointsAwarded: points,
      landmarkMatchScore: verificationResult.landmarkMatchScore,
      livenessScore: verificationResult.livenessScore,
      completedAt: new Date(),
    });

    // Reward history (used for cap checks / audit)
    tx.set(userRef.collection("rewardHistory").doc(), {
      type: "photo_challenge",
      challengeId,
      points,
      claimedAt: new Date(),
    });

    return { awarded: true, alreadyCompleted: false, totalPoints: newTotal, level: newLevel };
  });

  // If this was an itinerary-based challenge, mark its document completed
  if (result.awarded) {
    try {
      const chRef = db.collection("photoChallenges").doc(challengeId);
      const chSnap = await chRef.get();
      if (chSnap.exists && chSnap.data().userId === userId) {
        await chRef.update({ completed: true, completedAt: new Date() });
      }
    } catch (err) {
      console.warn("⚠️ Could not mark challenge completed:", err.message);
    }
    console.log(`✅ Photo reward: +${points} pts for ${userId} (${challengeId}) → Total: ${result.totalPoints}`);
  }

  return result;
}

/**
 * Remove a completed challenge and take its points back.
 * Used by the "Reset Demo Challenge" dev tool so the demo can be retried.
 *
 * @returns {Promise<{ reset: boolean, totalPoints: number }>}
 */
export async function revokePhotoChallenge(userId, challengeId, db) {
  const userRef = db.collection("users").doc(userId);
  const completionRef = userRef.collection("photoCompletions").doc(challengeId);

  return db.runTransaction(async (tx) => {
    const [userSnap, completionSnap] = await Promise.all([tx.get(userRef), tx.get(completionRef)]);
    const data = userSnap.exists ? userSnap.data() : {};
    const completed = Array.isArray(data.completedChallenges) ? data.completedChallenges : [];
    const currentPoints = data.rewardPoints || 0;

    if (!completed.includes(challengeId)) {
      return { reset: false, totalPoints: currentPoints };
    }

    const refund = completionSnap.exists ? completionSnap.data().pointsAwarded || 0 : 0;
    const newTotal = Math.max(0, currentPoints - refund);
    const newLevel = getLevel(newTotal);

    tx.set(
      userRef,
      {
        rewardPoints: newTotal,
        level: newLevel.name,
        levelNumber: newLevel.level,
        completedChallenges: completed.filter((id) => id !== challengeId),
        updatedAt: new Date(),
      },
      { merge: true }
    );
    tx.delete(completionRef);

    return { reset: true, totalPoints: newTotal };
  });
}

/**
 * Award points for a validated real-world trip.
 * Validates the trip, checks caps, calculates points, and updates the user.
 *
 * @param {string} userId
 * @param {{ gpsPoints: Array, visitedPOIs: Array }} tripData
 * @param {admin.firestore.Firestore} db
 */
export async function awardTripReward(userId, tripData, db) {
  // Step 1: Validate the trip meets minimum criteria
  const tripValidation = validateTrip(tripData);
  if (!tripValidation.valid) {
    return { success: false, points: 0, errors: tripValidation.errors };
  }

  // Step 2: Check daily cap
  const dailyCheck = await checkDailyCap(userId, db);
  if (!dailyCheck.allowed) {
    return { success: false, points: 0, errors: [dailyCheck.reason] };
  }

  // Step 3: Check monthly cap
  const monthlyCheck = await checkMonthlyCap(userId, db);
  if (!monthlyCheck.allowed) {
    return { success: false, points: 0, errors: [monthlyCheck.reason] };
  }

  // Step 4: Calculate reward points (capped at remaining daily/monthly allowance)
  let points = calculateRewardPoints(tripValidation.stats.totalDistanceKm);
  const dailyRemaining = REWARDS.MAX_POINTS_PER_DAY - dailyCheck.todayPoints;
  const monthlyRemaining = REWARDS.MAX_POINTS_PER_MONTH - monthlyCheck.monthPoints;
  points = Math.min(points, dailyRemaining, monthlyRemaining);

  if (points <= 0) {
    return { success: false, points: 0, errors: ["Points cap reached for the current period"] };
  }

  // Step 5: Update user's total points and level (transaction-safe increment)
  const userRef = db.collection("users").doc(userId);
  const { newTotal, newLevel } = await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const currentPoints = snap.exists ? snap.data().rewardPoints || 0 : 0;
    const total = currentPoints + points;
    const level = getLevel(total);

    tx.set(
      userRef,
      { rewardPoints: total, level: level.name, levelNumber: level.level, updatedAt: new Date() },
      { merge: true }
    );
    tx.set(userRef.collection("rewardHistory").doc(), {
      type: "trip_reward",
      points,
      tripStats: tripValidation.stats,
      claimedAt: new Date(),
    });

    return { newTotal: total, newLevel: level };
  });

  console.log(`✅ Trip reward: +${points} pts for ${userId} → Total: ${newTotal}`);

  return {
    success: true,
    points,
    totalPoints: newTotal,
    level: newLevel,
    tripStats: tripValidation.stats,
  };
}

/**
 * Get the current reward status for a user.
 *
 * @param {string} userId
 * @param {admin.firestore.Firestore} db
 */
export async function getUserRewards(userId, db) {
  const userDoc = await db.collection("users").doc(userId).get();
  const data = userDoc.exists ? userDoc.data() : {};
  const points = data.rewardPoints || 0;

  return {
    points,
    level: getLevel(points),
    progress: calculateProgress(points),
    completedChallenges: Array.isArray(data.completedChallenges) ? data.completedChallenges : [],
  };
}
