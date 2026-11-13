/*
 * HiddenTrails.AI — shared theme (visual only).
 * Load as a classic script right after the Tailwind CDN and Lucide:
 *   <script src="https://cdn.tailwindcss.com/3.4.16"></script>
 *   <script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
 *   <script src="js/theme.js"></script>
 */

/* 0. Colour theme: light, brown (light-brown default) or dark.
      Applied before the page paints; the toggle cycles light -> brown -> dark. */
(function () {
  var KEY = "ht-theme";
  var ORDER = ["light", "brown", "dark"];
  var NAMES = { light: "Light", brown: "Light brown", dark: "Dark" };
  var root = document.documentElement;
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  root.setAttribute("data-theme", ORDER.indexOf(saved) >= 0 ? saved : "brown");

  function current() { return root.getAttribute("data-theme") || "brown"; }
  function next() { return ORDER[(ORDER.indexOf(current()) + 1) % ORDER.length]; }
  function label() {
    var now = current(), then = next();
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-label", "Theme: " + NAMES[now] + ". Switch to " + NAMES[then]);
      b.setAttribute("title", NAMES[now] + " theme (click for " + NAMES[then] + ")");
    });
  }
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    var t = next();
    root.setAttribute("data-theme", t);
    try { localStorage.setItem(KEY, t); } catch (err) { /* not saved, still switches */ }
    label();
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", label);
  else label();
  // the app navbar is drawn later by js/ui.js
  new MutationObserver(function () { label(); }).observe(root, { childList: true, subtree: true });
})();

/* 1. Tailwind tokens: same names as the CSS variables in css/styles.css */
window.tailwind = window.tailwind || {};
tailwind.config = {
  theme: {
    extend: {
      // Travel-journal palette: paper, ink, one accent (terracotta).
      // Old names (forest, saffron, gold, leaf) are aliases so existing markup still works.
      colors: {
        paper: { DEFAULT: "var(--paper)", 2: "var(--paper-2)" },
        accent: { DEFAULT: "var(--accent)", ink: "var(--accent-ink)", 50: "var(--accent-50)" },
        line: { DEFAULT: "var(--line)", 2: "var(--line-2)" },
        forest: { DEFAULT: "#1A1A1A", 800: "#141414", 600: "#333330", 100: "#E6E6E1", 50: "#F2F2EF" },
        saffron: { DEFAULT: "#B5502D", 600: "#B5502D", 100: "#F4E4DA" },
        gold: { DEFAULT: "#8A6A22", ink: "#6B5119", 100: "#F1E8D2" },
        leaf: { DEFAULT: "#3E6A4C", ink: "#2F5439", 100: "#E4EBDF" },
        terracotta: { DEFAULT: "#A3302A", ink: "#7E231F", 100: "#F5DFDB" },
        sand: { DEFAULT: "#FBFBF9", 2: "#F2F2EF" },
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)" },
        muted: "var(--muted)",
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      borderRadius: { lg: "8px", xl: "10px", "2xl": "10px", "3xl": "12px" },
      boxShadow: {
        soft: "0 1px 2px rgba(30,27,22,.06)",
        lift: "0 12px 32px -14px rgba(30,27,22,.28)",
      },
      maxWidth: { site: "1140px" },
    },
  },
};

/* 2. Lucide icons: render every <i data-lucide="name">, including ones
      that page scripts insert later (toasts, cards, dialogs…). */
(function () {
  let queued = false;
  function render() {
    queued = false;
    if (window.lucide && document.querySelector("i[data-lucide]")) {
      window.lucide.createIcons({ attrs: { "aria-hidden": "true" } });
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(render);
  }
  function start() {
    render();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
