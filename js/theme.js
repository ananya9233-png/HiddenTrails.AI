/*
 * HiddenTrails.AI — shared theme (visual only).
 * Load as a classic script right after the Tailwind CDN and Lucide:
 *   <script src="https://cdn.tailwindcss.com/3.4.16"></script>
 *   <script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
 *   <script src="js/theme.js"></script>
 */

/* 1. Tailwind tokens: same names as the CSS variables in css/styles.css */
window.tailwind = window.tailwind || {};
tailwind.config = {
  theme: {
    extend: {
      // Travel-journal palette: paper, ink, one accent (terracotta).
      // Old names (forest, saffron, gold, leaf) are aliases so existing markup still works.
      colors: {
        paper: { DEFAULT: "#F6F1E7", 2: "#EFE8DA" },
        accent: { DEFAULT: "#B5502D", ink: "#923F22", 50: "#F4E4DA" },
        line: { DEFAULT: "#E4DCCB", 2: "#D2C6AE" },
        forest: { DEFAULT: "#1E1B16", 800: "#16130F", 600: "#35302A", 100: "#E6DECE", 50: "#EFE8DA" },
        saffron: { DEFAULT: "#B5502D", 600: "#B5502D", 100: "#F4E4DA" },
        gold: { DEFAULT: "#8A6A22", ink: "#6B5119", 100: "#F1E8D2" },
        leaf: { DEFAULT: "#3E6A4C", ink: "#2F5439", 100: "#E4EBDF" },
        terracotta: { DEFAULT: "#A3302A", ink: "#7E231F", 100: "#F5DFDB" },
        sand: { DEFAULT: "#F6F1E7", 2: "#EFE8DA" },
        ink: { DEFAULT: "#1E1B16", 2: "#4A443A" },
        muted: "#6B6355",
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
