/**
 * Firebase Admin SDK Configuration
 * ----------------------------------
 * Initializes Firebase Admin with service account credentials.
 * Exports the Firestore database instance for use across all services.
 *
 * The service account key is looked up in this order:
 *   1. FIREBASE_SERVICE_ACCOUNT env var: the key's JSON, or that JSON base64-encoded
 *   2. A Render secret file: /etc/secrets/serviceAccountKey.json
 *   3. Local development: /backend/config/serviceAccountKey.json
 *
 * Get the key from Firebase Console → Project Settings → Service Accounts
 * → Generate New Private Key. Never commit it (it is git-ignored).
 */

import admin from "firebase-admin";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const KEY_FILES = [
  "/etc/secrets/serviceAccountKey.json",      // Render "Secret Files"
  join(__dirname, "serviceAccountKey.json"),  // local development
];

function loadServiceAccount() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (fromEnv) {
    const json = fromEnv.startsWith("{") ? fromEnv : Buffer.from(fromEnv, "base64").toString("utf-8");
    try {
      return { account: JSON.parse(json), source: "FIREBASE_SERVICE_ACCOUNT env var" };
    } catch {
      console.error("❌ FATAL: FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON (or base64 of JSON).");
      process.exit(1);
    }
  }

  const file = KEY_FILES.find((p) => existsSync(p));
  if (file) return { account: JSON.parse(readFileSync(file, "utf-8")), source: file };

  console.error("❌ FATAL: Firebase service account key not found.");
  console.error("   Set FIREBASE_SERVICE_ACCOUNT, add a Render secret file named serviceAccountKey.json,");
  console.error("   or place serviceAccountKey.json in /backend/config/ for local development.");
  process.exit(1);
}

const { account, source } = loadServiceAccount();

admin.initializeApp({
  credential: admin.credential.cert(account),
});

/** @type {admin.firestore.Firestore} */
const db = admin.firestore();

console.log(`✅ Firebase Admin initialized successfully (key from ${source})`);

export { db, admin };
