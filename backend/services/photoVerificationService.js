/**
 * Photo Verification Service
 * ----------------------------
 * Uses Groq LLaMA 4 Scout (multimodal vision model) to verify:
 * 1. Landmark Match — Does the photo show the correct landmark?
 * 2. Liveness — Was the photo taken live (not a screenshot/copy)?
 *
 * The reference image is always chosen by the server (from the challenge
 * definition), never supplied by the client.
 *
 * DEMO MODE (campus challenge):
 *  - Live photo: ONLY passes if the building facade is clearly visible.
 *  - Gallery upload: ONLY passes if the image visually matches one of the
 *                    approved building photos (32x32 pixel fingerprint).
 */

import fetch from "node-fetch";
import https from "https";
import sharp from "sharp";
import {
  GROQ_BASE_URL,
  getGroqHeaders,
  LLAMA_VISION_MODEL,
} from "../config/groq.js";
import { DEMO_KNOWN_IMAGES, PHOTO_CHALLENGE } from "../config/constants.js";

// Certificate checks stay ON unless explicitly disabled for a network
// with a TLS-intercepting proxy (set ALLOW_INSECURE_TLS=true in .env).
const httpsAgent =
  process.env.ALLOW_INSECURE_TLS === "true"
    ? new https.Agent({ rejectUnauthorized: false })
    : undefined;

async function fetchImageBuffer(url) {
  const res = await fetch(url, { agent: httpsAgent });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function compressImageBuffer(buffer) {
  return sharp(buffer)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
}

function dataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.replace(/^data:image\/[\w+.-]+;base64,/, ""), "base64");
}

// ─────────────────────────────────────────────────────────────────────────────
//  DEMO GALLERY CHECK — perceptual fingerprint
//  Both images are shrunk to 32x32 RGB; similarity = 1 - mean absolute
//  pixel difference. Robust to re-encoding/resizing, but different photos
//  score well below the threshold.
// ─────────────────────────────────────────────────────────────────────────────
const knownFingerprintCache = new Map();

async function fingerprint(buffer) {
  return sharp(buffer).rotate().resize(32, 32, { fit: "fill" }).removeAlpha().raw().toBuffer();
}

function fingerprintSimilarity(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return 1 - diff / (a.length * 255);
}

async function isDemoKnownBuildingImage(userImageBase64) {
  let userFp;
  try {
    userFp = await fingerprint(dataUrlToBuffer(userImageBase64));
  } catch (err) {
    console.warn("⚠️ Could not read uploaded image:", err.message);
    return false;
  }

  for (const url of DEMO_KNOWN_IMAGES) {
    try {
      if (!knownFingerprintCache.has(url)) {
        knownFingerprintCache.set(url, await fingerprint(await fetchImageBuffer(url)));
      }
      const similarity = fingerprintSimilarity(userFp, knownFingerprintCache.get(url));
      console.log(`🔍 Demo fingerprint vs …${url.slice(-30)}: ${(similarity * 100).toFixed(1)}%`);
      if (similarity >= PHOTO_CHALLENGE.DEMO_IMAGE_SIMILARITY) return true;
    } catch (err) {
      console.warn("⚠️ Could not fetch known image for comparison:", err.message);
    }
  }

  console.log("❌ Demo gallery: image does NOT match any known building photo");
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN VERIFY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {{
 *   userImageBase64: string,
 *   referenceImageUrl: string,
 *   landmarkName: string,
 *   isGalleryUpload?: boolean,
 *   demoMode?: boolean
 * }} params
 */
export async function verifyPhoto({
  userImageBase64,
  referenceImageUrl,
  landmarkName,
  isGalleryUpload = false,
  demoMode = false,
}) {
  // ── DEMO GALLERY: strict known-image check, no AI needed ──────────────────
  if (demoMode && isGalleryUpload) {
    const isKnown = await isDemoKnownBuildingImage(userImageBase64);
    return isKnown
      ? {
          landmarkMatchScore: 90,
          livenessScore: 50,
          match: true,
          liveness: false,
          confidence: 90,
          reason: "Gallery photo matches an approved photo of the campus building.",
          demoGalleryMatch: true,
        }
      : {
          landmarkMatchScore: 5,
          livenessScore: 0,
          match: false,
          liveness: false,
          confidence: 95,
          reason: "This gallery image is not one of the approved photos of the campus building.",
          demoGalleryMatch: false,
        };
  }

  // ── Fetch + compress reference image ──────────────────────────────────────
  let referenceBase64 = null;
  if (referenceImageUrl) {
    try {
      const compressed = await compressImageBuffer(await fetchImageBuffer(referenceImageUrl));
      referenceBase64 = `data:image/jpeg;base64,${compressed.toString("base64")}`;
      console.log("✅ Reference image ready, size:", Math.round(compressed.length / 1024), "KB");
    } catch (err) {
      console.warn("⚠️ Could not fetch reference image:", err.message);
    }
  }

  if (!referenceBase64) {
    return {
      landmarkMatchScore: 0, livenessScore: 0, confidence: 0,
      match: false, liveness: false,
      reason: "Reference image could not be loaded. Please try again.",
    };
  }

  // Compress the user's photo too (keeps the Groq request small)
  let userImage = userImageBase64;
  try {
    const compressedUser = await compressImageBuffer(dataUrlToBuffer(userImageBase64));
    userImage = `data:image/jpeg;base64,${compressedUser.toString("base64")}`;
  } catch (err) {
    console.warn("⚠️ Could not compress user image, sending original:", err.message);
  }

  // ── Build the AI prompt ───────────────────────────────────────────────────
  let systemPrompt;
  let userPrompt;

  if (demoMode) {
    // ── DEMO LIVE PHOTO: ultra-strict — must see the actual building ─────────
    systemPrompt = `You are a strict photo verification AI for a campus challenge demo.

The target is the ${landmarkName.toUpperCase()} — a specific multi-storey academic building
with a light-colored (white/cream/beige) facade, multiple floors, rectangular windows, and campus surroundings.

YOUR ONLY JOB: Does the user's photo clearly show THIS BUILDING (or a very similar campus building facade)?

STRICT REJECTION RULES — score landmarkMatchScore BELOW 20 and match=false if:
  • The photo shows a PERSON or people (even partially)
  • The photo shows an INDOOR ROOM, ceiling, floor, desk, furniture
  • The photo shows a BLANK WALL, sky, ground, grass only
  • The photo shows a PHONE SCREEN, screenshot, or another camera
  • The photo shows ANY building that is clearly NOT a multi-storey academic/institutional building
  • The photo is too dark, too close, or unrecognizable as a building exterior

ACCEPT (score landmarkMatchScore 65+, match=true) ONLY IF:
  • The photo clearly shows the exterior facade of a multi-storey campus/institutional building
  • The building has visible floors, windows, and academic building characteristics
  • It resembles the reference image (light-colored multi-storey building)

Liveness scoring (live demo capture):
  • Score livenessScore 60+ if the photo has natural camera artifacts (slight grain, imperfect framing, ambient lighting)
  • Score livenessScore below 40 if it looks like a professionally downloaded stock photo

Respond ONLY in this exact JSON format:
{"match": true/false, "liveness": true/false, "landmarkMatchScore": 0-100, "livenessScore": 0-100, "confidence": 0-100, "reason": "one sentence describing what you see"}`;

    userPrompt = `Reference image (first): the ${landmarkName} exterior.
User live capture (second): does it show the BUILDING EXTERIOR? Reject if it shows a person, room, wall, sky, or anything that is not clearly a multi-storey academic building facade.`;

  } else {
    // ── REGULAR challenges ────────────────────────────────────────────────────
    const livenessContext = isGalleryUpload
      ? `IMPORTANT: The user uploaded this from their photo GALLERY — it was NOT taken live right now.
         Score liveness LOW (10-40) unless you see clear evidence it was personally taken.
         A professional/stock-looking photo MUST score liveness below 40.`
      : `The user claims this was captured LIVE via their device camera right now.
         Look for signs of a live capture: natural imperfections, slight blur, phone camera artifacts.
         Score liveness 70+ only if the image has clear signs of being personally taken.`;

    systemPrompt = `You are a strict photo verification AI for a travel gamification app called HiddenTrails.
Users must PHYSICALLY VISIT landmarks and take photos there to earn points.

Verify TWO things:

1. LOCATION MATCH — Does the user's photo show the SAME LANDMARK as the reference image?
   Score 0-100. Score 70+ only if clearly the same landmark. Score below 30 if different place.

2. LIVENESS — Is this photo personally taken, or downloaded from the internet?
   DOWNLOADED (liveness LOW 0-40): perfect professional composition, identical to reference, stock-photo quality.
   GENUINE LIVE (liveness HIGH 60-100): natural imperfections, unconventional angle, phone artifacts.

${livenessContext}

Respond ONLY in this exact JSON format:
{"match": true/false, "liveness": true/false, "landmarkMatchScore": 0-100, "livenessScore": 0-100, "confidence": 0-100, "reason": "clear explanation of what you see in both images"}`;

    userPrompt = `Reference image (first): shows ${landmarkName}. User submission (second): is this the same landmark, and is it a personally taken photo or downloaded from internet?`;
  }

  // ── Call Groq Vision API ──────────────────────────────────────────────────
  const response = await fetch(GROQ_BASE_URL, {
    method: "POST",
    headers: getGroqHeaders(),
    body: JSON.stringify({
      model: LLAMA_VISION_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: referenceBase64 } },
            { type: "image_url", image_url: { url: userImage } },
          ],
        },
      ],
      max_tokens: 250,
      temperature: 0.1,
    }),
  });

  const data = await response.json();
  if (data.error) console.error("❌ Groq API error:", JSON.stringify(data.error));

  const aiText = data.choices?.[0]?.message?.content || "";
  console.log(`📝 Vision AI response [demo=${demoMode}]:`, aiText);

  return parseVerificationResponse(aiText);
}

function parseVerificationResponse(aiText) {
  try {
    const jsonMatch = aiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        landmarkMatchScore: parsed.landmarkMatchScore ?? (parsed.match ? 85 : 20),
        livenessScore: parsed.livenessScore ?? (parsed.liveness ? 80 : 25),
        match: !!parsed.match,
        liveness: !!parsed.liveness,
        confidence: parsed.confidence || 50,
        reason: parsed.reason || "AI verification completed",
      };
    }
    throw new Error("No JSON found in AI vision response");
  } catch (parseErr) {
    console.error("❌ Vision JSON parse error:", parseErr.message);
    const lowerText = aiText.toLowerCase();
    const match = lowerText.includes("match") && !lowerText.includes("not match") && !lowerText.includes("no match");
    const liveness = lowerText.includes("live") && !lowerText.includes("not live");
    return {
      landmarkMatchScore: match ? 60 : 20,
      livenessScore: liveness ? 60 : 20,
      match, liveness, confidence: 40,
      reason: aiText.slice(0, 200) || "Fallback analysis used",
    };
  }
}