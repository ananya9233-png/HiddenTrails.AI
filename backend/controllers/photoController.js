/**
 * Photo Challenge Controller
 * ----------------------------
 * - Lists a user's challenges (built-in + itinerary-based)
 * - Verifies a challenge photo (GPS + AI vision) and awards points
 * - Deletes itinerary-based challenges, resets the demo challenge
 *
 * Everything security-relevant (who the user is, which reference image,
 * how many points) is decided here on the server, not by the client.
 */

import { verifyPhoto } from "../services/photoVerificationService.js";
import { validateGPSForChallenge, logGPSEntry } from "../services/gpsService.js";
import { awardPhotoPoints, revokePhotoChallenge } from "../services/rewardService.js";
import { getDestinationImage } from "../services/imageService.js";
import { db } from "../config/firebase.js";
import { DEFAULT_CHALLENGES, PHOTO_CHALLENGE } from "../config/constants.js";

const MAX_IMAGE_BASE64_LENGTH = 9 * 1024 * 1024; // ~6.5 MB image

/** Query used to find an image for an itinerary-based challenge (shared with the frontend). */
export function challengeImageQuery(name, destination) {
  return destination ? `${name}, ${destination}` : name;
}

/**
 * Resolve a challenge by id: built-in first, then the user's own
 * itinerary-based challenges. Returns null if not found / not owned.
 */
async function findChallenge(challengeId, userId) {
  const builtIn = DEFAULT_CHALLENGES.find((c) => c.id === challengeId);
  if (builtIn) return { ...builtIn, landmark: builtIn.landmark || builtIn.name };

  const snap = await db.collection("photoChallenges").doc(challengeId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (data.userId !== userId || !data.name) return null;

  return {
    id: snap.id,
    name: data.name,
    landmark: `${data.name} in ${data.destination || "India"}`,
    destination: data.destination,
    latitude: data.latitude || null,
    longitude: data.longitude || null,
    points: data.points || 100,
    image: data.image || null,
    isDemo: false,
  };
}

/**
 * GET /photo-challenges/:userId
 * Returns built-in + itinerary-based challenges and which ones are completed.
 */
export async function handleListChallenges(req, res) {
  const userId = req.user.uid;
  try {
    let snapshot;
    try {
      snapshot = await db.collection("photoChallenges")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } catch {
      // Composite index missing — fall back to an unordered query
      snapshot = await db.collection("photoChallenges").where("userId", "==", userId).get();
    }

    const dynamic = [];
    snapshot.forEach((doc) => {
      const d = doc.data();
      if (!d.name) return; // skip legacy completion records stored in this collection
      dynamic.push({
        id: doc.id,
        name: d.name,
        location: d.destination || "India",
        destination: d.destination || null,
        latitude: d.latitude || null,
        longitude: d.longitude || null,
        points: d.points || 100,
        difficulty: d.difficulty || "Medium",
        image: d.image || null,
        imageQuery: challengeImageQuery(d.name, d.destination),
        description: d.description || `Photograph ${d.name}`,
        isDemo: false,
      });
    });

    const userDoc = await db.collection("users").doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : {};

    res.json({
      challenges: [...dynamic, ...DEFAULT_CHALLENGES],
      completed: Array.isArray(user.completedChallenges) ? user.completedChallenges : [],
      points: user.rewardPoints || 0,
    });
  } catch (err) {
    console.error("❌ Fetch challenges error:", err);
    res.status(500).json({ error: "Failed to fetch challenges", challenges: [] });
  }
}

/**
 * DELETE /photo-challenges/:userId/:destination
 * Deletes the user's itinerary-based challenges for a destination.
 */
export async function handleDeleteChallenges(req, res) {
  try {
    const userId = req.user.uid;
    const destination = req.params.destination;

    const snapshot = await db.collection("photoChallenges")
      .where("userId", "==", userId)
      .where("destination", "==", destination)
      .get();

    if (snapshot.empty) {
      return res.json({ deleted: 0, message: "No challenges found for this destination" });
    }

    const batch = db.batch();
    snapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`🗑️ Deleted ${snapshot.size} photo challenges for ${destination} (user: ${userId})`);
    res.json({ deleted: snapshot.size, message: `Deleted ${snapshot.size} challenges for ${destination}` });
  } catch (err) {
    console.error("❌ Delete challenges error:", err);
    res.status(500).json({ error: "Failed to delete challenges" });
  }
}

/**
 * POST /photo/reset-demo
 * Marks the demo challenge incomplete again and takes its points back.
 */
export async function handleResetDemo(req, res) {
  try {
    const demo = DEFAULT_CHALLENGES.find((c) => c.isDemo);
    const result = await revokePhotoChallenge(req.user.uid, demo.id, db);
    res.json(result);
  } catch (err) {
    console.error("❌ Reset demo error:", err);
    res.status(500).json({ error: "Failed to reset demo challenge" });
  }
}

/**
 * POST /verify-photo  (alias: /photo/verify)
 *
 * Body: { userImageBase64, challengeId, latitude?, longitude?, timestamp?,
 *         isGalleryUpload?, mockLocationFlag? }
 */
export async function handleVerifyPhoto(req, res) {
  try {
    const userId = req.user.uid;
    const {
      userImageBase64,
      challengeId,
      latitude,
      longitude,
      timestamp,
      mockLocationFlag,
      isGalleryUpload,
    } = req.body;

    if (typeof userImageBase64 !== "string" || !userImageBase64.startsWith("data:image/")) {
      return res.status(400).json({ error: "A photo (data URL) is required" });
    }
    if (userImageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      return res.status(413).json({ error: "Photo is too large" });
    }
    if (!challengeId) {
      return res.status(400).json({ error: "Challenge ID is required" });
    }

    const challenge = await findChallenge(challengeId, userId);
    if (!challenge) {
      return res.status(404).json({ error: "Challenge not found" });
    }

    const userDoc = await db.collection("users").doc(userId).get();
    const completed = userDoc.exists ? userDoc.data().completedChallenges || [] : [];
    if (completed.includes(challenge.id)) {
      return res.json({
        match: true, points: 0, alreadyCompleted: true, challengeId: challenge.id,
        message: `You've already completed ${challenge.name}. 🎉`,
      });
    }

    const DEMO_MODE = !!challenge.isDemo;
    const galleryUpload = !!isGalleryUpload;
    console.log("📸 VERIFY PHOTO —", challenge.id, "| Gallery:", galleryUpload, "| Demo:", DEMO_MODE);

    // ── Reference image (server-side only) ───────────────────────────────
    const referenceImageUrl =
      challenge.image || (await getDestinationImage(challengeImageQuery(challenge.name, challenge.destination)));

    // ── GPS Validation (skipped for demo) ────────────────────────────────
    let userWasNearLocation = true;
    const hasGPS = typeof latitude === "number" && typeof longitude === "number";

    if (!DEMO_MODE && hasGPS) {
      const ts = timestamp || new Date().toISOString();
      if (challenge.latitude && challenge.longitude) {
        const gpsValidation = await validateGPSForChallenge(
          { userId, poiId: challenge.id, latitude, longitude, timestamp: ts, mockLocationFlag: !!mockLocationFlag },
          { latitude: challenge.latitude, longitude: challenge.longitude },
          db
        );
        userWasNearLocation = gpsValidation.valid;
        if (!gpsValidation.valid) console.log("⚠️ GPS failed (continuing to AI):", gpsValidation.errors);
      }
      await logGPSEntry(userId, { latitude, longitude, timestamp: ts }, db);
    }

    // ── AI Vision Verification ───────────────────────────────────────────
    const verificationResult = await verifyPhoto({
      userImageBase64,
      referenceImageUrl,
      landmarkName: challenge.landmark,
      isGalleryUpload: galleryUpload,
      demoMode: DEMO_MODE,
    });

    // ── Points Calculation ───────────────────────────────────────────────
    const matchValid = verificationResult.landmarkMatchScore >= PHOTO_CHALLENGE.MIN_LANDMARK_MATCH_SCORE;
    const livenessValid = verificationResult.livenessScore >= PHOTO_CHALLENGE.MIN_LIVENESS_SCORE;
    const name = challenge.name;

    let points = 0;
    let message = "";

    if (DEMO_MODE) {
      if (galleryUpload) {
        if (verificationResult.demoGalleryMatch) {
          points = challenge.points;
          message = "🎓 Campus verified via gallery! Demo challenge complete.";
        } else {
          message = "🏛️ Wrong photo! Only approved photos of the campus building are accepted in demo mode.";
        }
      } else if (matchValid) {
        points = challenge.points;
        message = `🎓 Building detected! Demo challenge complete. ${verificationResult.reason || ""}`.trim();
      } else {
        message = verificationResult.reason
          ? `🚫 ${verificationResult.reason}`
          : "🚫 That doesn't look like the building. Point your camera at the building facade.";
      }
    } else if (matchValid && livenessValid && !galleryUpload) {
      if (!userWasNearLocation) {
        points = PHOTO_CHALLENGE.PARTIAL_MATCH_POINTS;
        message = `📍 Photo verified but you're not at ${name}! Visit in person for full points.`;
      } else {
        points = challenge.points;
        message = `🎉 Amazing! Your live photo of ${name} is verified! ${verificationResult.reason || ""}`.trim();
      }
    } else if (galleryUpload && matchValid) {
      message = `📸 Nice try! This is a gallery image of ${name}. Visit in person to earn points!`;
    } else if (matchValid && !livenessValid) {
      message = `🖼️ This looks like a downloaded photo of ${name}. Take a live photo to earn points!`;
    } else {
      message = `😕 Your photo doesn't match ${name}. Try again from a better angle!`;
    }

    // ── Award Points (once per challenge) ────────────────────────────────
    let rewardResult = null;
    if (points > 0) {
      rewardResult = await awardPhotoPoints(userId, challenge.id, points, verificationResult, db);
      if (rewardResult.alreadyCompleted) points = 0;
    }

    console.log(
      `✅ Result — Match: ${matchValid} (${verificationResult.landmarkMatchScore}),`,
      `Live: ${livenessValid} (${verificationResult.livenessScore}), Points: ${points}`
    );

    res.json({
      match: matchValid,
      liveness: livenessValid,
      landmarkMatchScore: verificationResult.landmarkMatchScore,
      livenessScore: verificationResult.livenessScore,
      confidence: verificationResult.confidence,
      reason: verificationResult.reason,
      points,
      message,
      challengeId: challenge.id,
      isGalleryUpload: galleryUpload,
      totalPoints: rewardResult?.totalPoints ?? null,
      level: rewardResult?.level ?? null,
      demo: DEMO_MODE,
    });
  } catch (error) {
    console.error("❌ Photo verification error:", error);
    res.status(500).json({ error: "Photo verification failed" });
  }
}
