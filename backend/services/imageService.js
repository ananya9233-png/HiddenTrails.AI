/**
 * Image Service
 * ---------------
 * Fetches destination images using the free Wikipedia/Wikimedia API.
 * No API key required!
 *
 * Strategy:
 *   1. Search Wikipedia for the landmark/destination
 *   2. Verify the article is about a PLACE (not a person, film, song, etc.)
 *   3. Verify the image looks like a place photo (not a portrait, logo, etc.)
 *   4. Retry with different search terms if first attempt returns bad results
 *   5. Return null instead of fallback if nothing good is found
 */

import fetch from "node-fetch";
import { findPlaceByQuery, validateImageUrl } from "../controllers/adminController.js";

// Fallback image (a beautiful generic landscape)
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=400&fit=crop";

// Common fluff words to strip from queries for better Wikipedia matches
const STRIP_WORDS =
  /\b(travel|photography|day|morning|afternoon|evening|vibes|trip|explore|visit|arrival|departure|and|the|in|at|of|to|a|an|with|for|from|bustling|beautiful|famous|iconic|historic|nearby|local|popular|ancient|renowned|magnificent|stunning|traditional|old|new|great)\b/gi;

// Keywords that indicate the Wikipedia article is about a PERSON, FILM, or other irrelevant topic
const BAD_TITLE_KEYWORDS = [
  "born", "film", "movie", "actor", "actress", "singer", "album",
  "song", "band", "politician", "cricketer", "player", "novel",
  "tv series", "television", "episode", "character", "game",
  "company", "software", "brand", "regiment", "battalion",
  "disambiguation"
];

// Patterns in Wikipedia descriptions that indicate non-place articles
// Patterns in Wikipedia descriptions that CONFIRM it's a place article (accept)
const GOOD_PLACE_KEYWORDS = [
  "village", "town", "city", "temple", "mosque", "church", "fort",
  "palace", "monument", "lake", "river", "waterfall", "beach", "cave",
  "hill", "mountain", "valley", "pass", "garden", "park",
  "island", "dam", "bridge", "gate", "tower", "tomb",
  "mausoleum", "shrine", "museum", "district", "state", "region",
  "province", "heritage", "ruins", "archaeological", "historical",
  "geographic", "located in", "situated in", "tourist", "attraction",
  "landmark", "pilgrimage", "springs", "glacier", "plateau", "gorge",
  "canyon", "desert", "forest", "mangrove", "estuary", "harbour",
  "harbor", "port", "bazaar", "market", "chowk", "mahal", "haveli",
  "gurudwara", "dargah", "stupa", "vihara", "ashram", "ghats", "ghat"
];

// Patterns in descriptions that indicate NON-place articles (reject)
const BAD_DESCRIPTION_KEYWORDS = [
  "actor", "actress", "singer", "musician", "politician", "cricketer",
  "player", "writer", "author", "director", "producer", "film", "movie",
  "album", "song", "novel", "person", "born", "died", "footballer",
  "businessman", "entrepreneur", "youtuber", "social media", "model",
  "designer", "chef", "dancer", "television", "tv show", "web series",
  "podcast", "scientist", "professor", "engineer", "doctor", "lawyer",
  "journalist", "photographer", "sportsperson", "athlete", "coach",
  "commentator", "anchor", "host", "comedian", "magician", "painter",
  "sculptor", "architect", "statistician", "mathematician", "physicist",
  "biologist", "chemist", "economist", "philosopher", "historian",
  "theorist", "activist", "philanthropist", "general", "admiral",
  "commander", "lieutenant", "captain", "sergeant", "minister",
  "governor", "president", "chairman", "ceo", "founder", "co-founder",
  "martial artist", "wrestler", "boxer", "racer", "jockey",
  "swimmer", "gymnast", "sprinter", "runner", "cyclist", "skier",
  "skater", "archer", "shooter", "fencer", "rower", "diver",
  "badminton", "tennis", "hockey", "basketball", "volleyball",
  "video game", "anime", "manga", "comic", "fictional character",
  "software", "programming", "company", "corporation", "startup",
  "brand", "product", "band", "musical group", "duo", "trio",
  "biological", "species", "genus", "family", "taxonomy"
];

// Image filename patterns that suggest irrelevant images (portraits, logos, etc.)
const BAD_IMAGE_PATTERNS = [
  /portrait/i, /headshot/i, /selfie/i, /face/i,
  /logo/i, /icon/i, /symbol/i, /flag.*of/i,
  /poster/i, /cover.*art/i, /album.*cover/i,
  /screenshot/i, /still.*from/i,
  /svg$/i, /\.gif$/i,
  /screening/i, /premiere/i, /award/i,
  /at_the/i, /at_a/i, /during/i,
  /Games\d/i, /championship/i, /olympics/i,
  // Animal/wildlife images
  /deer/i, /tiger/i, /elephant/i, /leopard/i, /lion/i,
  /monkey/i, /bird/i, /snake/i, /crocodile/i, /bear/i,
  /wildlife/i, /animal/i, /fauna/i, /zoo.*animal/i,
  /chital/i, /spotted_deer/i, /nilgai/i, /sambar/i,
  // Generic landscape/mountain images (wrong for city landmarks)
  /mountain/i, /himalayas/i, /panorama/i,
];


// ── Polite Wikipedia access ──────────────────────────────────────
// Wikimedia rate-limits anonymous clients hard. When limited, searches come
// back empty (not as errors), which looked like "no image found". So:
// identify ourselves, run at most 2 requests at a time, and back off on 429.
const WIKI_HEADERS = { "User-Agent": "HiddenTrailsAI/2.0 (educational travel planner; image lookup)" };
const WIKI_MAX_CONCURRENT = 2;
let wikiActive = 0;
const wikiQueue = [];

async function wikiFetch(url, retry = true) {
  if (wikiActive >= WIKI_MAX_CONCURRENT) await new Promise((r) => wikiQueue.push(r));
  wikiActive++;
  let res;
  try {
    res = await fetch(url, { headers: WIKI_HEADERS });
  } finally {
    wikiActive--;
    wikiQueue.shift()?.();
  }
  if (res.status === 429 && retry) {
    const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 10) * 1000;
    console.warn(`⏳ Wikipedia rate limit, retrying in ${wait / 1000}s`);
    await new Promise((r) => setTimeout(r, wait));
    return wikiFetch(url, false);
  }
  return res;
}

// In-memory cache: { query -> { url, timestamp } }
const imageCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Clear the entire image cache.
 * Called when admin adds/updates/deletes tourist places
 * so that the new database entries take effect immediately.
 */
export function clearImageCache() {
  const size = imageCache.size;
  imageCache.clear();
  console.log(`🧹 Image cache cleared (${size} entries removed)`);
}

/**
 * Get a relevant image for a destination/query using Wikipedia.
 * Returns null (not fallback) if no relevant image can be found —
 * this lets the frontend decide whether to show the card or hide it.
 *
 * @param {string} query - Search query (e.g., "Arjun Gufa Manali")
 * @returns {Promise<string|null>} Image URL or null
 */
export async function getDestinationImage(rawQuery) {
  // "Landmark, Destination" (used by photo challenges) means: find the
  // landmark itself; the destination only helps disambiguate, and its photo
  // is the fallback. Without this, "Gadisar Lake Jaisalmer" matched the
  // "Jaisalmer" city article and every landmark got the city photo.
  const [landmarkPart, nearPart = ""] = String(rawQuery).split(",").map((s) => s.trim());
  const query = landmarkPart.replace(/-/g, " ").replace(/\s+/g, " ").trim(); // "Patwon-ki-Haveli" → "Patwon ki Haveli"
  const near = nearPart.replace(/-/g, " ").trim();
  const mustMatch = near ? query : null;

  // Check cache first
  const cacheKey = String(rawQuery).toLowerCase().trim();
  const cached = imageCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log("⚡ Cache hit for:", query);
    return cached.url;
  }

  try {
    // ══════ DATABASE-FIRST LOOKUP ══════
    // Check admin-curated touristPlaces collection before hitting Wikipedia
    const dbPlace = await findPlaceByQuery(query);
    if (dbPlace?.imageUrl && validateImageUrl(dbPlace.imageUrl)) {
      console.warn(`⚠️ Database image for "${dbPlace.name}" is not a direct image link — fix it in the admin panel. Using Wikipedia instead.`);
    } else if (dbPlace && dbPlace.imageUrl) {
      console.log(`🗄️ Using database image for "${query}" → "${dbPlace.name}"`);
      imageCache.set(cacheKey, {
        url: dbPlace.imageUrl,
        timestamp: Date.now(),
        source: "database",
        description: dbPlace.description || null,
        name: dbPlace.name,
      });
      return dbPlace.imageUrl;
    }

    // ══════ WIKIPEDIA FALLBACK ══════
    const searchTerms = near
      ? [...new Set([query, `${query} ${near}`, ...buildSearchStrategies(query)])]
      : buildSearchStrategies(query);
    console.log("🖼️ Wikipedia image search strategies:", searchTerms);

    for (const term of searchTerms) {
      if (!term || term.length < 2) continue;

      // Strategy A: Try the Wikipedia page summary API (gives a nice thumbnail)
      const image = await fetchWikipediaSummaryImage(term, mustMatch);
      if (image) {
        imageCache.set(cacheKey, { url: image, timestamp: Date.now(), source: "wikipedia" });
        return image;
      }

      // Strategy B: Try Wikipedia image search API
      const image2 = await fetchWikipediaImageSearch(term, mustMatch);
      if (image2) {
        imageCache.set(cacheKey, { url: image2, timestamp: Date.now(), source: "wikipedia" });
        return image2;
      }
    }

    // Landmark has no Wikipedia article: look for a Commons photo whose
    // filename names it, then fall back to a photo of its destination
    // (better than a random landscape).
    if (near) {
      const commons = await fetchCommonsLandmarkImage(query, near);
      if (commons) {
        imageCache.set(cacheKey, { url: commons, timestamp: Date.now(), source: "commons" });
        return commons;
      }
      console.log(`🌅 No image for "${query}", using destination "${near}"`);
      const nearImage = await getDestinationImage(near);
      if (nearImage) imageCache.set(cacheKey, { url: nearImage, timestamp: Date.now(), source: "wikipedia" });
      return nearImage;
    }

    // Wikipedia found nothing — try Wikimedia Commons as final fallback
    const commonsUrl = await fetchUnsplashFallback(query);
    // Never cache a miss: a temporary Wikipedia failure would otherwise
    // hide the image for the whole cache TTL.
    if (commonsUrl) imageCache.set(cacheKey, { url: commonsUrl, timestamp: Date.now(), source: "commons" });
    return commonsUrl;
  } catch (error) {
    console.error("Image fetch error:", error.message);
    return null;
  }
}

/**
 * Build search strategies — progressively more general.
 * Enhanced to produce better landmark-specific queries.
 */

function buildSearchStrategies(query) {
  const cleaned = query
    .replace(STRIP_WORDS, "")
    .replace(/['']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter((w) => w.length > 2);

  if (words.length === 0) return [query.trim()];
  if (words.length === 1) return [words[0], words[0] + " India"];

  const strategies = [];

  // Strategy 1: Full exact cleaned query (most specific)
  strategies.push(cleaned);

  // Strategy 2: First 2-3 words only (the actual landmark name, drop city)
  strategies.push(words.slice(0, 2).join(" "));

  // Strategy 3: With "India" appended
  strategies.push(words.slice(0, 2).join(" ") + " India");

  // Strategy 4: Landmark + "Delhi" or city specifically
  if (words.length >= 3) {
    strategies.push(words.slice(0, -1).join(" ")); // drop last word
  }

  return [...new Set(strategies)];
}
/**
 * Check if a Wikipedia article title/description is about a PLACE.
 * Uses a multi-tier approach with careful scope for each check.
 *
 * @param {string} title - Wikipedia article title
 * @param {string} shortDesc - The `description` field (e.g., "village in Himachal Pradesh")
 * @param {string} fullText - Combined description + extract for deeper analysis
 */
function isPlaceArticle(title, shortDesc, fullText) {
  const lowerTitle = (title || "").toLowerCase();
  const lowerShort = (shortDesc || "").toLowerCase();
  const lowerFull = (fullText || "").toLowerCase();

  // TIER 1: Positive check — ONLY check short description for place keywords
  // (long extract can contain words like "state" in "State University" which is misleading)
  for (const kw of GOOD_PLACE_KEYWORDS) {
    if (lowerShort.includes(kw) || lowerTitle.includes(kw)) {
      console.log(`   ✅ Accepting "${title}" — matches place keyword "${kw}"`);
      return true;
    }
  }

  // TIER 2: Negative check — check title for bad keywords
  for (const kw of BAD_TITLE_KEYWORDS) {
    if (lowerTitle.includes(kw)) {
      console.log(`   ❌ Skipping "${title}" — title contains "${kw}"`);
      return false;
    }
  }

  // TIER 3: Negative check — check BOTH short and full text for bad keywords
  for (const kw of BAD_DESCRIPTION_KEYWORDS) {
    if (lowerShort.includes(kw) || lowerFull.includes(kw)) {
      console.log(`   ❌ Skipping "${title}" — text contains "${kw}"`);
      return false;
    }
  }

  // TIER 4: Heuristic — very short description without place keywords is suspicious
  if (lowerShort && lowerShort.split(/\s+/).length <= 4 && lowerShort.length < 50) {
    console.log(`   ⚠️ Skipping "${title}" — short generic description: "${shortDesc}"`);
    return false;
  }

  // If we can't determine, cautiously reject (better to hide than show wrong image)
  console.log(`   ⚠️ Skipping "${title}" — could not confirm as a place article`);
  return false;
}

/**
 * Check if an image URL looks like a relevant place/landscape photo.
 * Returns false for portraits, logos, SVGs, etc.
 */
function isRelevantImage(imageUrl) {
  if (!imageUrl) return false;

  const lowerUrl = imageUrl.toLowerCase();

  // Check against bad image patterns
  for (const pattern of BAD_IMAGE_PATTERNS) {
    if (pattern.test(lowerUrl)) {
      console.log(`   ❌ Skipping image — URL matches bad pattern: ${pattern}`);
      return false;
    }
  }

  // Must be a proper image format
  if (!lowerUrl.match(/\.(jpg|jpeg|png|webp)/i) && !lowerUrl.includes("upload.wikimedia.org")) {
    return false;
  }
  // Reject obvious generic landscape URLs from Wikipedia
  const genericPatterns = [/landscape/i, /panorama/i, /mountain/i, /himalayas/i, /sunset/i, /nature.*india/i];
  for (const p of genericPatterns) {
    if (p.test(lowerUrl)) {
      console.log(`   ❌ Skipping generic landscape image`);
      return false;
    }
  }

  return true;
}

/**
 * Check if a Wikipedia article title is relevant to the search query.
 * Ensures at least one significant word from the query appears in the title.
 * This prevents returning "Statue of Unity" when searching for "Rohtang Pass".
 */
function isTitleRelevant(title, searchQuery, mustMatch = null) {
  const stopWords = new Set(['the', 'of', 'in', 'at', 'a', 'an', 'and', 'or', 'to', 'for', 'is', 'on', 'by', 'with', 'from', 'tourist', 'landmark', 'spot', 'place', 'india']);

  // Landmark mode: the title must share a DISTINCTIVE word with the landmark
  // name ("gadisar", "patwon"), not just a generic one ("lake", "temple").
  if (mustMatch) {
    const generic = new Set([...stopWords, 'ki', 'ka', 'ke', 'sri', 'shri', 'temple', 'lake', 'fort', 'palace', 'mahal',
      'haveli', 'dunes', 'sand', 'beach', 'falls', 'waterfall', 'cave', 'caves', 'hill', 'hills', 'peak', 'valley',
      'park', 'garden', 'gate', 'market', 'bazaar', 'museum', 'river', 'ghat', 'ghats', 'point', 'view', 'mandir']);
    const words = mustMatch.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w));
    const distinctive = words.filter((w) => !generic.has(w));
    const titleLower = title.toLowerCase();
    const ok = (distinctive.length ? distinctive : words).some((w) => titleLower.includes(w));
    if (!ok) console.log(`   ❌ Title "${title}" doesn't name landmark "${mustMatch}"`);
    return ok;
  }

  // At least one significant query word must appear in the title
  const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const titleLower = title.toLowerCase();
  
  // Check if at least one significant word matches
  const hasMatch = queryWords.some(word => titleLower.includes(word));
  
  // Also accept if title contains a known Indian place suffix
  const indianSuffixes = ['mahal', 'fort', 'temple', 'gate', 'lake', 'valley', 'falls', 
                          'beach', 'cave', 'peak', 'pass', 'palace', 'gufa', 'mandir', 
                          'dham', 'kund', 'ghat', 'bagh', 'nagar', 'pur'];
  const hasSuffix = indianSuffixes.some(s => titleLower.includes(s) && searchQuery.toLowerCase().includes(s));
  
  if (!hasMatch && !hasSuffix) {
    console.log(`   ❌ Title "${title}" not relevant to query "${searchQuery}" — no matching words`);
    return false;
  }
  return true;
  
  
}

/**
 * Fetch the main image from a Wikipedia page summary.
 * Uses the REST API: https://en.wikipedia.org/api/rest_v1/page/summary/{title}
 *
 * Enhanced with strict validation: checks article type and image relevance.
 */
async function fetchWikipediaSummaryImage(searchTerm, mustMatch = null) {
  try {
    // Step 1: Search Wikipedia for matching article titles
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(searchTerm)}&limit=5&format=json`;
    const searchRes = await wikiFetch(searchUrl);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const titles = searchData[1];
    if (!titles || titles.length === 0) return null;

    // Step 2: Check each title's page summary — validate it's a PLACE article with a good image
    for (const title of titles) {
      const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const summaryRes = await wikiFetch(summaryUrl);
      if (!summaryRes.ok) continue;

      const summaryData = await summaryRes.json();

      // ---- Validation: Is title relevant to what we searched? ----
      if (!isTitleRelevant(title, searchTerm, mustMatch)) {
        continue;
      }

      // ---- Validation: Is this article about a place? ----
      const description = summaryData.description || "";
      const extract = summaryData.extract || "";
      if (!isPlaceArticle(title, description, extract)) {
        continue; // Skip non-place articles
      }

      // ---- Get the image URL ----
      const imageUrl =
        summaryData.originalimage?.source || summaryData.thumbnail?.source;

      if (!imageUrl) continue;

      // ---- Validation: Is this a relevant place image? ----
      if (!isRelevantImage(imageUrl)) {
        continue; // Skip bad images
      }

      console.log("✅ Wikipedia image found for:", searchTerm, "→", title);
      return imageUrl;
    }

    return null;
  } catch (err) {
    console.warn("Wikipedia summary fetch error:", err.message);
    return null;
  }
}

/**
 * Fallback: search for images using the Wikipedia image query API.
 * Uses action=query with prop=pageimages.
 * Also validates the page type before accepting the image.
 */
async function fetchWikipediaImageSearch(searchTerm, mustMatch = null) {
  try {
    // Use search instead of exact title match for better results
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm + " tourist landmark")}&srlimit=5&format=json`;
    const searchRes = await wikiFetch(searchUrl);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const results = searchData.query?.search;
    if (!results || results.length === 0) return null;

    for (const result of results) {
      const title = result.title;
      const snippet = result.snippet || "";

      // Quick check: skip if title isn't relevant to search
      if (!isTitleRelevant(title, searchTerm, mustMatch)) continue;

      // Quick check: skip if snippet indicates person/film
      if (!isPlaceArticle(title, snippet, snippet)) continue;

      // Fetch the page image
      const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=800&redirects=1`;
      const imgRes = await wikiFetch(imgUrl);
      if (!imgRes.ok) continue;

      const imgData = await imgRes.json();
      const pages = imgData.query?.pages;
      if (!pages) continue;

      for (const pageId of Object.keys(pages)) {
        if (pageId === "-1") continue;
        const thumb = pages[pageId]?.thumbnail?.source;
        if (thumb && isRelevantImage(thumb)) {
          console.log("✅ Wikipedia image (search API) found for:", searchTerm, "→", title);
          return thumb;
        }
      }
    }

    return null;
  } catch (err) {
    console.warn("Wikipedia image query error:", err.message);
    return null;
  }
}
/**
 * Search Wikimedia Commons for a photo of a specific landmark.
 * Only accepts files whose name contains a distinctive word of the landmark
 * (e.g. "Patwon" for "Patwon ki Haveli"), and returns a 960px thumbnail.
 */
async function fetchCommonsLandmarkImage(landmark, near) {
  try {
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${landmark} ${near}`)}&srnamespace=6&srlimit=8&format=json`;
    const res = await wikiFetch(searchUrl);
    if (!res.ok) return null;
    const results = (await res.json()).query?.search || [];

    for (const { title } of results) {
      if (!/\.(jpe?g|png|webp)$/i.test(title)) continue;
      if (!isTitleRelevant(title.replace(/[_-]/g, " "), landmark, landmark)) continue;
      if (!isRelevantImage(title)) continue;

      const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=960&format=json`;
      const infoRes = await wikiFetch(infoUrl);
      if (!infoRes.ok) continue;
      const page = Object.values((await infoRes.json()).query?.pages || {})[0];
      const url = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
      if (url) {
        console.log(`✅ Commons image found for "${landmark}" → ${title}`);
        return url;
      }
    }
  } catch (err) {
    console.warn("Commons landmark search failed:", err.message);
  }
  return null;
}

/**
 * Fetch a landmark image from Unsplash (free, no API key needed for source URL).
 * Used as final fallback when Wikipedia returns nothing.
 */
async function fetchUnsplashFallback(query) {
  const cleaned = query
    .replace(STRIP_WORDS, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 3)
    .join(" ");

  try {
    // Search Wikimedia Commons for a real image file
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleaned + " india")}&srnamespace=6&srlimit=3&format=json`;
    const res = await wikiFetch(searchUrl);
    if (res.ok) {
      const data = await res.json();
      const results = data.query?.search;
      if (results && results.length > 0) {
        const fileName = results[0].title.replace("File:", "");
        const fileUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(fileName)}&prop=imageinfo&iiprop=url&format=json`;
        const fileRes = await wikiFetch(fileUrl);
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          const pages = fileData.query?.pages;
          if (pages) {
            const page = Object.values(pages)[0];
            const imgUrl = page?.imageinfo?.[0]?.url;
            if (imgUrl && isRelevantImage(imgUrl)) {
              console.log(`🌅 Wikimedia Commons fallback found for "${query}"`);
              return imgUrl;
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Wikimedia Commons fallback failed:", e.message);
  }

  console.log(`⚠️ No fallback image found for "${query}"`);
  return null;
}
