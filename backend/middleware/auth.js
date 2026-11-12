/**
 * Firebase Auth Middleware
 * -------------------------
 * Verifies the Firebase ID token sent by the frontend in the
 * `Authorization: Bearer <token>` header and exposes the caller as req.user.
 *
 * The user's identity always comes from the verified token — never from
 * a userId in the request body — so one user cannot act as another.
 */

import { admin } from "../config/firebase.js";

async function decodeToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    return await admin.auth().verifyIdToken(match[1]);
  } catch (err) {
    console.warn("⚠️ Invalid Firebase ID token:", err.code || err.message);
    return null;
  }
}

/** Rejects the request with 401 unless a valid Firebase ID token is present. */
export async function requireAuth(req, res, next) {
  const decoded = await decodeToken(req);
  if (!decoded) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { uid: decoded.uid, email: decoded.email || null };
  next();
}

/** Ensures the :userId route param matches the signed-in user. */
export function requireSelf(req, res, next) {
  if (req.params.userId && req.params.userId !== req.user?.uid) {
    return res.status(403).json({ error: "You can only access your own data" });
  }
  next();
}
