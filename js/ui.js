/**
 * UI kit — app shell, toasts, dialogs, counters, confetti, reveal-on-scroll.
 * Pure DOM, no framework. Import what you need from any page.
 */

import { api, wireLogout, escapeHtml } from "./app.js";

/* ── Icons ─────────────────────────────────────────────────────────
 * Redesigned pages load Lucide (js/theme.js renders <i data-lucide>).
 * Pages not yet migrated still use Font Awesome. icon() picks the right one. */
const FA_TO_LUCIDE = {
  "fa-circle-check": "circle-check", "fa-triangle-exclamation": "triangle-alert", "fa-circle-info": "info",
  "fa-circle-question": "circle-help", "fa-trash-can": "trash-2", "fa-rotate": "refresh-cw",
  "fa-ticket": "ticket", "fa-circle-notch": "loader-circle", "fa-location-dot": "map-pin",
};
const usesLucide = () => !!window.lucide;
export function icon(name, extra = "") {
  if (usesLucide()) return `<i data-lucide="${FA_TO_LUCIDE[name] || name.replace(/^fa-/, "")}" class="${extra}"></i>`;
  return `<i class="fa-solid ${name} ${extra}"></i>`;
}

const NAV = [
  { href: "dashboard.html",       icon: "fa-compass",           label: "Home" },
  { href: "plantrips.html",       icon: "fa-route",             label: "Plan a trip" },
  { href: "saved.html",           icon: "fa-book-bookmark",     label: "My journeys" },
  { href: "photo-challenge.html", icon: "fa-camera-retro",      label: "Photo challenges" },
  { href: "rewards.html",         icon: "fa-ticket",            label: "Rewards" },
  { href: "upload-gem.html",      icon: "fa-gem",               label: "Share a gem" },
];

/**
 * Builds the sidebar + mobile top bar into <aside id="sidebar"> and
 * <header id="mobileBar">. `active` is the href of the current section.
 * Returns { setUser(user) } to fill in the user card once auth resolves.
 */
export function mountShell(active) {
  if (document.getElementById("appNav")) return mountTopNav(active);
  const aside = document.getElementById("sidebar");
  const bar = document.getElementById("mobileBar");

  aside.innerHTML = `
    <a href="dashboard.html" class="brand">
      <span class="brand-mark"><i class="fa-solid fa-mountain-sun"></i></span>
      <span class="brand-name">HiddenTrails<em>.ai</em></span>
    </a>
    <p class="nav-section">Explore</p>
    <nav class="flex flex-col gap-1">
      ${NAV.map((n) => `
        <a href="${n.href}" class="nav-link ${n.href === active ? "is-active" : ""}" ${n.href === active ? 'aria-current="page"' : ""}>
          <i class="fa-solid ${n.icon}"></i><span>${n.label}</span>
        </a>`).join("")}
    </nav>
    <div class="sidebar-foot">
      <div class="card p-4 mb-3" style="background:var(--moss);border-color:var(--moss);color:#fff">
        <p class="font-display text-[1.05rem] leading-snug">“Take only photos,<br>leave only footprints.”</p>
        <p class="text-xs mt-2" style="opacity:.75">Earn points for every real visit.</p>
      </div>
      <div class="user-card">
        <span class="avatar" id="shellAvatar">·</span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-sm truncate" id="shellName">Explorer</p>
          <p class="points-pill"><i class="fa-solid fa-leaf mr-1"></i><span id="shellPoints">—</span> pts</p>
          <p class="text-[.7rem] muted truncate" id="shellLevel"></p>
        </div>
        <button class="btn btn-ghost btn-icon" data-logout title="Log out" aria-label="Log out"><i class="fa-solid fa-arrow-right-from-bracket"></i></button>
      </div>
    </div>`;

  if (bar) {
    bar.innerHTML = `
      <button class="btn btn-ghost btn-icon" id="menuBtn" aria-label="Open menu"><i class="fa-solid fa-bars"></i></button>
      <a href="dashboard.html" class="brand !p-0"><span class="brand-mark !w-8 !h-8"><i class="fa-solid fa-mountain-sun text-sm"></i></span><span class="brand-name">HiddenTrails<em>.ai</em></span></a>
      <span class="w-[42px]"></span>`;
    const scrim = document.createElement("div");
    scrim.className = "scrim";
    document.body.appendChild(scrim);
    const toggle = (open) => { aside.classList.toggle("open", open); scrim.classList.toggle("open", open); };
    bar.querySelector("#menuBtn").addEventListener("click", () => toggle(true));
    scrim.addEventListener("click", () => toggle(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });
  }

  wireLogout();

  return {
    async setUser(user) {
      const name = user.displayName || (user.email || "Explorer").split("@")[0];
      document.getElementById("shellName").textContent = name;
      document.getElementById("shellAvatar").textContent = name.charAt(0).toUpperCase();
      try {
        const r = await api(`/rewards/${user.uid}`);
        setShellPoints(r.points, r.level?.name);
      } catch { /* backend offline — leave placeholder */ }
    },
  };
}

/* ── Top navbar (redesigned pages: <header id="appNav">) ───────── */
const TOP_NAV = [
  { href: "dashboard.html",       icon: "layout-dashboard", label: "Dashboard" },
  { href: "plantrips.html",       icon: "map",              label: "Plan Trip" },
  { href: "saved.html",           icon: "bookmark",         label: "Saved" },
  { href: "photo-challenge.html", icon: "camera",           label: "Challenges" },
  { href: "rewards.html",         icon: "gift",             label: "Rewards" },
];

function mountTopNav(active) {
  const nav = document.getElementById("appNav");
  nav.classList.add("app-nav");
  const link = (n, cls) =>
    `<a href="${n.href}" class="${cls} ${n.href === active ? "is-active" : ""}" ${n.href === active ? 'aria-current="page"' : ""}>
       <i data-lucide="${n.icon}"></i><span>${n.label}</span></a>`;

  nav.innerHTML = `
    <div class="wrap">
      <a href="dashboard.html" class="brand" aria-label="HiddenTrails.AI home">
        <span class="brand-mark"><i data-lucide="mountain-snow"></i></span>
        <span class="brand-name">HiddenTrails<em>.ai</em></span>
      </a>
      <nav class="nav-links" aria-label="Main">${TOP_NAV.map((n) => link(n, "nav-link")).join("")}</nav>
      <div class="nav-right">
        <a href="rewards.html" class="points-pill" title="Your points and level">
          <span class="coin"><i data-lucide="coins"></i></span>
          <span><span id="shellPoints">—</span><span class="sr-only"> points</span></span>
          <span class="lvl" id="shellLevel"></span>
        </a>
        <div class="relative">
          <button type="button" class="avatar-btn" id="avatarBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="avatarMenu" aria-label="Account menu">
            <span class="avatar" id="shellAvatar">·</span>
          </button>
          <div class="menu" id="avatarMenu" role="menu" hidden>
            <div class="px-3 py-2">
              <p class="font-semibold text-sm truncate" id="shellName">Explorer</p>
              <p class="text-xs muted truncate" id="shellEmail"></p>
            </div>
            <hr>
            <a href="upload-gem.html" class="menu-item" role="menuitem"><i data-lucide="gem"></i> Share a hidden gem</a>
            <a href="rewards.html" class="menu-item" role="menuitem"><i data-lucide="award"></i> My rewards</a>
            <hr>
            <button type="button" class="menu-item danger" role="menuitem" data-logout><i data-lucide="log-out"></i> Log out</button>
          </div>
        </div>
      </div>
    </div>`;

  // Mobile bottom tab bar
  const tabbar = document.createElement("nav");
  tabbar.className = "tabbar";
  tabbar.setAttribute("aria-label", "Main");
  tabbar.innerHTML = TOP_NAV.map((n) => link(n, "")).join("");
  document.body.appendChild(tabbar);
  document.body.classList.add("has-tabbar");

  // Avatar dropdown
  const btn = nav.querySelector("#avatarBtn");
  const menu = nav.querySelector("#avatarMenu");
  const setOpen = (open) => {
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) menu.querySelector(".menu-item")?.focus();
  };
  btn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(menu.hidden); });
  document.addEventListener("click", (e) => { if (!menu.hidden && !menu.contains(e.target)) setOpen(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) { setOpen(false); btn.focus(); }
  });

  wireLogout();

  return {
    async setUser(user) {
      const name = user.displayName || (user.email || "Explorer").split("@")[0];
      document.getElementById("shellName").textContent = name;
      document.getElementById("shellEmail").textContent = user.email || "";
      document.getElementById("shellAvatar").textContent = name.charAt(0).toUpperCase();
      try {
        const r = await api(`/rewards/${user.uid}`);
        setShellPoints(r.points, r.level?.name);
      } catch { /* backend offline — leave placeholder */ }
    },
  };
}

export function setShellPoints(points, levelName) {
  const p = document.getElementById("shellPoints");
  if (p) animateCount(p, points);
  const l = document.getElementById("shellLevel");
  if (l && levelName) l.textContent = levelName;
}

/* ── Toasts ───────────────────────────────────────────────────── */
let stack;
export function toast(message, type = "info", ms = 3800) {
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("role", "status");
    stack.setAttribute("aria-live", "polite");
    document.body.appendChild(stack);
  }
  const icons = { success: "fa-circle-check", error: "fa-triangle-exclamation", info: "fa-circle-info" };
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(icons[type] || icons.info)}<div>${escapeHtml(message)}</div>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add("out");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, ms);
}

/* ── Confirm dialog (Promise-based replacement for confirm()) ─── */
export function confirmDialog({ title, body = "", confirmText = "Confirm", cancelText = "Cancel", danger = false, icon: iconName = "fa-circle-question" }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop is-open";
    wrap.innerHTML = `
      <div class="modal text-center" role="dialog" aria-modal="true" aria-labelledby="dlgTitle">
        <div class="mx-auto mb-4 w-14 h-14 rounded-full grid place-items-center text-xl"
             style="background:${danger ? "var(--clay-soft, var(--terracotta-100))" : "var(--moss-soft, var(--forest-50))"};color:${danger ? "var(--danger, var(--terracotta-ink))" : "var(--moss, var(--forest))"}">
          ${icon(iconName)}
        </div>
        <h3 id="dlgTitle" class="h3 mb-2">${escapeHtml(title)}</h3>
        <p class="ink-2 text-sm mb-6">${escapeHtml(body)}</p>
        <div class="flex gap-3 justify-center">
          <button class="btn" data-act="cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? "btn-clay" : "btn-primary"}" data-act="ok">${escapeHtml(confirmText)}</button>
        </div>
      </div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(false); };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) done(false);
      const act = e.target.closest("[data-act]")?.dataset.act;
      if (act) done(act === "ok");
    });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector('[data-act="ok"]').focus();
  });
}

/* ── Animated number counter ──────────────────────────────────── */
export function animateCount(el, to, duration = 900) {
  const target = Number(to) || 0;
  const from = Number(String(el.textContent).replace(/[^\d.-]/g, "")) || 0;
  // Journal design: numbers just appear, no count-up animation.
  if (true || window.matchMedia("(prefers-reduced-motion: reduce)").matches || from === target) {
    el.textContent = target.toLocaleString("en-IN");
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (target - from) * eased).toLocaleString("en-IN");
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ── Confetti burst (tiny canvas implementation) ──────────────── */
export function confetti({ count = 140, colors = window.lucide ? ["#0F3D3E", "#F4A259", "#E9B949", "#4CAF7A", "#FAF7F2"] : ["#2e6a4e", "#c5603a", "#e0a33a", "#3a7aa3", "#f5f0e6"] } = {}) {
  // Journal design: no confetti. Kept as a no-op so existing calls still work.
  if (true || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:500";
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const pieces = Array.from({ length: count }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 120,
    y: innerHeight * .45,
    vx: (Math.random() - .5) * 16,
    vy: -Math.random() * 15 - 6,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 10,
    r: Math.random() * Math.PI,
    vr: (Math.random() - .5) * .35,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));

  const start = performance.now();
  const frame = (now) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of pieces) {
      p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (now - start < 3200) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

/* ── Reveal elements as they scroll into view ─────────────────── */
export function revealOnScroll(root = document) {
  const els = root.querySelectorAll(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
    }
  }, { threshold: .12, rootMargin: "0px 0px -40px 0px" });
  els.forEach((e) => io.observe(e));
}

/** Number children for staggered entrance animations (.stagger). */
export function stagger(container) {
  [...container.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 12)));
}

/** Skeleton placeholder markup. */
export function skeletons(n, className = "h-72") {
  return Array.from({ length: n }, () => `<div class="skeleton ${className}"></div>`).join("");
}

/** Sets a button into a loading state; returns a restore() function. */
export function busy(btn, label = "Working…") {
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `${icon("fa-circle-notch", "spin")} ${escapeHtml(label)}`;
  return () => { btn.disabled = false; btn.innerHTML = html; };
}

/** Fade images in once loaded, with a fallback on error. */
export function smoothImage(img, fallback) {
  img.classList.add("is-loading");
  const done = () => img.classList.remove("is-loading");
  if (img.complete && img.naturalWidth) done();
  img.addEventListener("load", done, { once: true });
  img.addEventListener("error", () => { if (fallback && img.src !== fallback) img.src = fallback; else done(); });
}

/** Shared <head> fonts are loaded per page; time-of-day greeting helper. */
export function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Burning the midnight oil" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
