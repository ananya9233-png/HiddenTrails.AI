/**
 * Shared frontend module
 * -----------------------
 * Single place for the Firebase config, the backend base URL,
 * authenticated API calls, and small UI helpers. Every page imports
 * from here instead of duplicating config.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Firebase web config (public by design — access is controlled by firestore.rules)
export const firebaseConfig = {
  apiKey: "AIzaSyAVmXdDq2mqxRpn10KomHJxzFA7v-aJnEU",
  authDomain: "hiddentrails-ai.firebaseapp.com",
  projectId: "hiddentrails-ai",
  storageBucket: "hiddentrails-ai.firebasestorage.app",
  messagingSenderId: "739490816318",
  appId: "1:739490816318:web:3d1adc77b25cf1dfb70c6f",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// When the page is served by the backend itself (port 5000) use relative URLs;
// otherwise (e.g. VS Code Live Server) talk to the local backend.
export const API_BASE =
  window.location.port === "5000" ? "" : "http://localhost:5000";

/**
 * fetch() wrapper that attaches the signed-in user's Firebase ID token.
 * Returns parsed JSON, throws an Error with the server's message on failure.
 */
export async function api(path, { method = "GET", body, auth: withAuth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (withAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    headers["Authorization"] = `Bearer ${await user.getIdToken()}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/**
 * Redirects to the login page if nobody is signed in.
 * Resolves with the Firebase user once auth state is known.
 */
export function requireUser() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (!user) {
        window.location.href = "auth.html";
        return;
      }
      resolve(user);
    });
  });
}

/** Wires every element with [data-logout] to sign out and go to the login page. */
export function wireLogout() {
  document.querySelectorAll("[data-logout]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      await signOut(auth);
      window.location.href = "auth.html";
    });
  });
}

/** Escapes text before it is inserted with innerHTML (prevents XSS). */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=800&q=80";
