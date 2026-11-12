/**
 * Application Constants
 * ----------------------
 * All business logic thresholds, limits, and configuration values.
 * Centralizing these makes the codebase easy to tune without hunting through services.
 */

// ==================== GPS VALIDATION ====================

export const GPS = {
  MAX_PROXIMITY_METERS: 150,        // User must be within 150m of POI
  MAX_SPEED_KMH: 150,               // Reject if speed exceeds 150 km/h
  TELEPORT_DISTANCE_KM: 20,         // Reject if user jumps >20km
  TELEPORT_WINDOW_MINUTES: 5,       // ...within a 5-minute window
  EARTH_RADIUS_KM: 6371,            // Earth's mean radius for Haversine
};

// ==================== TRIP VALIDATION ====================

export const TRIP = {
  MIN_DISTANCE_KM: 15,              // Trip must cover at least 15km
  MIN_DURATION_HOURS: 2,            // Trip must last at least 2 hours
  MIN_UNIQUE_POIS: 3,               // Must visit at least 3 unique POIs
  MIN_POI_STAY_MINUTES: 5,          // Must stay at each POI for at least 5 minutes
};

// ==================== REWARD SYSTEM ====================

export const REWARDS = {
  BASE_POINTS: 50,                   // Base multiplier: points = 50 * log(distance)
  MAX_REWARDS_PER_DAY: 1,           // Max 1 trip reward claim per 24 hours
  MAX_POINTS_PER_DAY: 200,          // Daily points cap
  MAX_POINTS_PER_MONTH: 1000,       // Monthly points cap
};

// ==================== LEVELING SYSTEM ====================

export const LEVELS = [
  { name: "Rookie",       min: 0,    max: 200  },
  { name: "Explorer",     min: 200,  max: 500  },
  { name: "Adventurer",   min: 500,  max: 1000 },
  { name: "Pro Traveler", min: 1000, max: 2000 },
  { name: "Legend",       min: 2000, max: Infinity },
];

// ==================== COUPON STORE ====================
// The catalog lives in code (not Firestore) so it can never be "used up"
// by one user. Redemptions are recorded on the user's document.

export const COUPON_CATALOG = [
  { code: "TRAIL10",   cost: 80,  discount: "10% OFF",   brand: "Flights partner",   icon: "✈️", color: "#3b82f6", desc: "Flights" },
  { code: "FOOD15",    cost: 120, discount: "15% OFF",   brand: "Food delivery",     icon: "🍔", color: "#ef4444", desc: "Food" },
  { code: "HIDDEN25",  cost: 200, discount: "25% OFF",   brand: "Hotels partner",    icon: "🏨", color: "#f59e0b", desc: "Hotels" },
  { code: "CAFE35",    cost: 280, discount: "₹350 OFF",  brand: "Café partner",      icon: "☕", color: "#059669", desc: "Drinks" },
  { code: "EXPLORE40", cost: 350, discount: "₹400 OFF",  brand: "Rail bookings",     icon: "🚂", color: "#6366f1", desc: "Train tickets" },
  { code: "SHOP50",    cost: 420, discount: "₹500 OFF",  brand: "Travel gear store", icon: "📦", color: "#f97316", desc: "Shopping" },
  { code: "WANDER50",  cost: 500, discount: "50% OFF",   brand: "Hostels partner",   icon: "🏕️", color: "#8b5cf6", desc: "Hostels" },
  { code: "EPIC80",    cost: 700, discount: "₹800 OFF",  brand: "Flights partner",   icon: "🛫", color: "#ec4899", desc: "Flights" },
  { code: "LEGEND",    cost: 900, discount: "₹1500 OFF", brand: "Stays partner",     icon: "🌍", color: "#0ea5e9", desc: "Hotels" },
];

// ==================== PHOTO CHALLENGE ====================

// Built-in challenges shown to every user (dynamic, itinerary-based
// challenges are stored per user in the "photoChallenges" collection).
export const DEFAULT_CHALLENGES = [
  { id: "tajmahal",     name: "Taj Mahal",             landmark: "Taj Mahal in Agra",           location: "Agra, UP",              latitude: 27.1751, longitude: 78.0421, points: 150, difficulty: "Easy",   image: "https://images.unsplash.com/photo-1564507592333-c60657eea523?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", description: "Capture the iconic white marble mausoleum" },
  { id: "indiagate",    name: "India Gate",            landmark: "India Gate in New Delhi",     location: "New Delhi",             latitude: 28.6129, longitude: 77.2295, points: 100, difficulty: "Easy",   image: "https://images.unsplash.com/photo-1587474260584-136574528ed5?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", description: "Snap the war memorial arch from the front" },
  { id: "gateway",      name: "Gateway of India",      landmark: "Gateway of India in Mumbai",  location: "Mumbai, MH",            latitude: 18.9220, longitude: 72.8347, points: 120, difficulty: "Medium", image: "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", description: "Photograph the grand harbor-front arch" },
  { id: "hawamahal",    name: "Hawa Mahal",            landmark: "Hawa Mahal in Jaipur",        location: "Jaipur, RJ",            latitude: 26.9239, longitude: 75.8267, points: 130, difficulty: "Medium", image: "https://images.unsplash.com/photo-1650530777057-3a7dbc24bf6c?q=80&w=800&auto=format&fit=crop", description: "Capture the Palace of Winds facade" },
  { id: "mysorepalace", name: "Mysore Palace",         landmark: "Mysore Palace in Mysore",     location: "Mysore, KA",            latitude: 12.3052, longitude: 76.6552, points: 140, difficulty: "Hard",   image: "https://images.unsplash.com/photo-1657856855186-7cf4909a4f78?q=80&w=800&auto=format&fit=crop", description: "Photograph the illuminated royal palace" },
  { id: "goldentemple", name: "Golden Temple",         landmark: "Golden Temple in Amritsar",   location: "Amritsar, PB",          latitude: 31.6200, longitude: 74.8765, points: 150, difficulty: "Hard",   image: "https://images.unsplash.com/photo-1514222134-b57cbb8ce073?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80", description: "Capture the sacred golden shrine reflection" },
  { id: "banasthali",   name: "Banasthali Vidyapith",  landmark: "Banasthali Vidyapith campus building", location: "Banasthali, Rajasthan", latitude: 26.3926, longitude: 75.8674, points: 50, difficulty: "Easy", image: "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775064941/1745305541phprIGj4O_of7l0b.jpg", description: "Capture the main campus building", isDemo: true },
];

// Approved photos of the demo building. Gallery uploads in the demo
// challenge only pass if they visually match one of these.
export const DEMO_KNOWN_IMAGES = [
  "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775064941/1745305541phprIGj4O_of7l0b.jpg",
  "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775064937/images_2_dh0doy.jpg",
  "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775060755/20260401_183530_suqqw8.jpg",
  "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775060742/20260401_183524_nqzerg.jpg",
  "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775060734/20260401_183522_cog6c6.jpg",
  "https://res.cloudinary.com/ducxtcvgw/image/upload/v1775060703/20260401_183528_nxrt8c.jpg",
];

export const PHOTO_CHALLENGE = {
  MIN_LANDMARK_MATCH_SCORE: 30,      // Landmark match must be >=30 out of 100
  MIN_LIVENESS_SCORE: 30,            // Liveness check must be >=30 out of 100
  PARTIAL_MATCH_POINTS: 30,          // Points for a verified photo taken away from the POI
  DEMO_IMAGE_SIMILARITY: 0.9,        // Pixel-fingerprint similarity needed for demo gallery uploads
};

// ==================== CHATBOT ====================

export const CHATBOT = {
  MAX_HISTORY_LENGTH: 20,            // Keep last 20 messages to prevent token overflow
  MAX_TOKENS: 1024,                   // Max response tokens
  TEMPERATURE: 0.7,                  // Creativity setting
  MAX_SESSIONS: 500,                 // Max conversations kept in memory
  MAX_MESSAGE_LENGTH: 2000,          // Reject very long user messages
};

// ==================== ITINERARY ====================

export const ITINERARY = {
  MAX_TOKENS: 3000,                  // Max tokens for itinerary generation
  TEMPERATURE: 0.7,
  MAX_DAYS: 10,                      // Longer trips don't fit in one AI response
  MIN_BUDGET: 1000,
  MAX_BUDGET: 10000000,
};
