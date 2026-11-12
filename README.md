# HiddenTrails.AI 🌿

An AI travel planner for India that helps you find hidden gems, then rewards you for actually going there.

- **AI itineraries:** day-by-day plans for any destination, budget, dates and travel style, with images and Google Maps links for each day.
- **Travel chatbot:** an eco-travel assistant that remembers the conversation.
- **Photo challenges:** take a photo at a landmark. The photo is checked twice: **GPS** (within 150 m of the landmark, with no teleporting or impossible speeds) and **AI vision** (is it the right landmark, and was it taken live?).
- **Rewards:** earn points, level up from Rookie to Legend, unlock badges and redeem coupons.
- **Admin panel:** curated landmark data that takes priority over Wikipedia results.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | HTML, Tailwind CSS (CDN), vanilla JS (ES modules) |
| Auth & database | Firebase Authentication, Cloud Firestore |
| Backend | Node.js, Express 5 (routes → controllers → services → utils) |
| AI | Groq API: `llama-3.1-8b-instant` (text), `llama-4-scout` (vision) |
| Images | Admin-curated places, then Wikipedia/Wikimedia, plus `sharp` for compression and fingerprinting |

## How it works

```
Browser (Firebase Auth) ──ID token──▶ Express API ──▶ Groq (LLaMA text / vision)
        │                                  │
        └── reads own data ──▶ Firestore ◀─┘ Admin SDK (sole writer of points/rewards)
```

- Every API call carries the user's **Firebase ID token**. The server takes the user's identity from that token, never from the request body.
- **Points are written only by the backend.** `firestore.rules` stops the browser from changing points, levels, completed challenges or coupons.
- Photo challenges are checked on the server. The server chooses the reference image and the points, and each challenge pays out once (Firestore transaction).
- Coupon redemption runs in a transaction, so points can't go negative and the same coupon can't be redeemed twice.

## Running locally

**Requirements:** Node.js 20+, a Firebase project (Auth with Email/Password plus Firestore), and a [Groq API key](https://console.groq.com/keys).

```bash
cd backend
npm install
cp .env.example .env        # then fill in GROQ_API_KEY and ADMIN_KEY
```

1. In Firebase Console → Project Settings → Service Accounts, generate a private key and save it as `backend/config/serviceAccountKey.json`. It is git-ignored; never commit it.
2. Put your Firebase web config in [`js/app.js`](js/app.js).
3. Deploy the security rules: `firebase deploy --only firestore:rules`, or paste [`firestore.rules`](firestore.rules) into the Firebase Console.
4. Start the server:

```bash
npm run dev     # http://localhost:5000
```

The backend also serves the frontend, so open <http://localhost:5000/index.html>. VS Code Live Server works too; the pages detect it and call `localhost:5000`.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/generate-itinerary` | 🔒 | Generate and save a trip |
| POST | `/regenerate-itinerary` | 🔒 | Regenerate one of your trips |
| POST | `/chat`, `/chat/clear` | 🔒 | Chatbot |
| GET | `/photo-challenges/:userId` | 🔒 | Built-in and itinerary-based challenges, plus progress |
| DELETE | `/photo-challenges/:userId/:destination` | 🔒 | Remove a trip's challenges |
| POST | `/verify-photo` | 🔒 | Verify a challenge photo and award points |
| POST | `/photo/reset-demo` | 🔒 | Reset the demo challenge |
| GET | `/rewards/:userId` | 🔒 | Points, level, progress |
| POST | `/rewards/claim-trip` | 🔒 | GPS-validated trip reward (daily/monthly caps) |
| GET | `/coupons` · POST `/coupon/redeem` | 🔒 | Coupon store |
| GET | `/get-destination-image?query=` | — | Destination image lookup |
| CRUD | `/admin/places` | admin key | Curated tourist places |
| GET | `/health` | — | Health check |

## Project structure

```
├── index.html, auth.html, signup.html    # landing & auth
├── dashboard.html, plantrips.html, itinerary.html, saved.html
├── photo-challenge.html, rewards.html, upload-gem.html, admin.html
├── js/app.js                             # shared Firebase config, API client, helpers
├── firestore.rules                       # client-side access rules
└── backend/
    ├── server.js
    ├── config/        # constants, Firebase Admin, Groq
    ├── middleware/    # auth (ID tokens), errors, logging
    ├── routes/ → controllers/ → services/ → utils/
```

## About this project

HiddenTrails.AI started as my B.Tech academic project in 2025–26. I now maintain and develop this repository on my own. Version 2 (2026) reworked the architecture and security; see [CHANGELOG.md](CHANGELOG.md).

**Author:** Ananya
