# Changelog

## v2.0.0 (November 2026): security and architecture overhaul

### Security
- **Authenticated API:** every user endpoint checks a Firebase ID token (`backend/middleware/auth.js`). The user's identity comes from the token, never from a `userId` in the request body.
- **The server is the only writer of rewards:** new `firestore.rules` stop the browser from changing points, levels, completed challenges or coupons. Before this, any user could give themselves points from the browser console.
- **Secrets are no longer served:** the static file server used to expose the whole project folder, including `backend/config/serviceAccountKey.json`. The backend folder is now blocked.
- **Photo verification can't be faked from the client:** the reference image, the demo's approved photos and the points are all decided on the server.
- **XSS fixed:** chatbot messages, AI-generated itineraries and admin data are escaped before they are added to the page.
- TLS certificate checks are on by default (`ALLOW_INSECURE_TLS` is opt-in). CORS can be restricted, and error responses no longer leak stack traces.
- Removed a fallback that loaded **every user's** trips when a Firestore index was missing.

### Bug fixes
- Photo challenge points were **added twice** (once by the backend, once by the page). Each challenge now pays out exactly once, inside a Firestore transaction.
- The **two separate coupon systems** are now one store. The old Firestore coupons could be redeemed by only one user ever, and the page ignored them anyway. Redemption is now transactional and per user.
- "Regenerate itinerary" called the wrong endpoint and didn't check who owned the trip. It now uses `/regenerate-itinerary`, which checks ownership and refreshes the trip's photo challenges.
- Demo gallery uploads were never checked: the page always sent `isGalleryUpload: false`. The check now uses a perceptual pixel fingerprint (sharp, 32×32) instead of comparing the first characters of the base64 string.
- Photo completion records were mixed in with the challenge definitions, so blank challenges appeared and challenge counts were wrong.
- Daily and monthly trip caps counted photo rewards too, which blocked trip claims.
- The rewards page had a hardcoded "18 challenges" and showed a made-up "Hidden Score".
- Fixed the Upload Gem page (it had placeholder Firebase config), logout links that didn't sign out, unreadable form labels, and a UTC date bug in the trip form.

### Improvements
- Shared frontend module (`js/app.js`) replaces Firebase config copied into nine pages.
- Day images on the itinerary load in parallel and are cached on the trip.
- Itinerary input is validated (dates, 1–10 days, budget) and the AI output is normalized.
- Chat memory is scoped to each user and limited in size.
- Gallery photos are resized in the browser before upload.
- Removed dead code: coupon seeder, duplicate My Trips page, unused root dependency.

## v1.0.0 (2025–26)
- First version, built as a B.Tech academic project: AI itineraries, chatbot, GPS and vision photo challenges, rewards, admin panel.
