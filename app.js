(() => {
"use strict";
// ======================= SETTINGS YOU MAY CHANGE =======================
// RESET_TIMEZONE: the ONE time zone where everyone's Gauntlet resets at midnight.
// Any IANA zone name works ("America/New_York", "UTC", ...). Daylight saving is
// handled automatically. Changing it mid-season shifts the day boundary once.
const RESET_TIMEZONE = "America/New_York";
// LAUNCH_DATE: day #1 of the game, in the reset zone. Used for "Gauntlet #N" in share text.
const LAUNCH_DATE = "2026-10-23";
// ======================================================================
const C = window.CONTENT;
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const CATS = [
  { id: "world", img: "cat-world", name: "World Rush", icon: "🌎", sub: "2 map pins + 1 geography question" },
  { id: "history", img: "cat-history", name: "History Timeline", icon: "📜", sub: "2 timelines · drag cards into order" },
  { id: "sports", img: "cat-sports", name: "Sports IQ", icon: "🏆", sub: "3 questions · easy → hard" },
  { id: "word", img: "cat-word", name: "Word Challenge", icon: "📝", sub: "" },
  { id: "think", img: "cat-brain", name: "Think Fast", icon: "🧠", sub: "2 brain-benders · one shot each" }
];
const WORD_GAMES = [
  { id: "flip", name: "Word Flip", sub: "Unscramble 6 words from hints · 60s" },
  { id: "bridge", name: "Word Bridge", sub: "Finish the first word, start the second · 60s" },
  { id: "conn", name: "Connections 3×3", sub: "Find 3 groups of 3 · 90s" },
  { id: "odd", name: "Odd One Out", sub: "Spot the word that doesn't fit · 60s" },
  { id: "anag", name: "Anagram Rush", sub: "Make words from 6 letters · 60s" }
];
// Placeholder timers for categories whose time limits are not yet locked.
const TBD = { pin: 30, mc: 20, think: 120 };

// Optional icon hook: uses assets/icons.js when loaded + key given, else the emoji text.
const ic = (emoji, key, cls) => (key && window.icon) ? window.icon(key, emoji, cls) : emoji;
// Swaps the first flag emoji in a question for its SVG (if an img key is given).
// Deterministic shuffle: same day key + question => same order for everyone.
function seededOrder(n, seed) {
  let x = 2166136261; for (const ch of String(seed)) x = Math.imul(x ^ ch.charCodeAt(0), 16777619);
  const rnd = () => { x = Math.imul(x ^ (x >>> 15), 2246822507); x = Math.imul(x ^ (x >>> 13), 3266489909); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  const o = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
  return o;
}
const qText = q => Array.isArray(q) ? q.map(x => typeof x === "string" ? x : "").join("") : String(q);
const withFlag = (text, key) => { if (!key || !window.icon) return text; const m = text.match(/\p{RI}\p{RI}/u); if (!m) return text; const i = m.index; return [text.slice(0, i), ic(m[0], key, "inline-flag"), text.slice(i + m[0].length)]; };
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "html") e.innerHTML = v;
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
}
const fmt = n => Math.round(n).toLocaleString();
const norm = s => s.toLowerCase().replace(/[^a-z0-9$./ ]/g, "").replace(/\s+/g, " ").trim();
function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- day / storage ----------
// ---- Daily clock (all day logic goes through here; never the device's own zone) ----
let clockSkew = 0; // ms added to Date.now() if the device clock is found to be running ahead
const now = () => Date.now() + clockSkew;
const TZF = new Intl.DateTimeFormat("en-US", { timeZone: RESET_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
function zoneParts(ms) { const p = {}; for (const x of TZF.formatToParts(new Date(ms))) p[x.type] = +x.value; if (p.hour === 24) p.hour = 0; return p; }
function keyOf(day) { return new Date(day * 864e5).toISOString().slice(0, 10); }
function dayOfKey(k) { return Math.floor(Date.parse(k + "T00:00:00Z") / 864e5); }
function zoneDay(ms) { const p = zoneParts(ms); return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 864e5); }
// Anti-clock-tamper (best effort): never go back to a day older than the newest one seen.
function dayIndex() {
  const seen = store.get("dg-maxday", 0), d = Math.max(seen, zoneDay(now()));
  if (d > seen) store.set("dg-maxday", d);
  return d;
}
function todayKey() { return keyOf(dayIndex()); }
// ms until the next midnight in RESET_TIMEZONE (correct on DST change days).
function msToReset() {
  const t = now(), offAt = ms => { const p = zoneParts(ms); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000; };
  const nextMidLocal = (zoneDay(t) + 1) * 864e5; // next zone midnight, written as if it were UTC
  let m = nextMidLocal - offAt(t); m = nextMidLocal - offAt(m);
  return Math.max(0, m - t);
}
// Trusted time: read the HTTP Date header of the site itself once. If the device
// clock is >10 min ahead, use server time. Silently ignored offline / on file://.
function syncClock() {
  if (!/^https?:/.test(location.protocol)) return;
  fetch(location.href, { method: "HEAD", cache: "no-store" }).then(r => {
    const srv = Date.parse(r.headers.get("Date")); if (!srv) return;
    const ahead = Date.now() - srv;
    if (ahead > 10 * 60e3) {
      clockSkew = -ahead;
      const real = zoneDay(now()); if (store.get("dg-maxday", 0) > real) store.set("dg-maxday", real); // undo a day reached by a fast clock
      if (!session) home();
    }
  }).catch(() => {});
}
const gameNumber = day => day - dayOfKey(LAUNCH_DATE) + 1;
const pick = (arr, i) => (Array.isArray(arr) && arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : (console.error("Empty content list"), undefined));
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let session = null;
let onKey = null; // per-screen physical keyboard handler
let timers = new Set(), cdInterval = null;
function clearScreenTimers() { timers.forEach(t => t.stop()); timers.clear(); clearInterval(cdInterval); cdInterval = null; }
window.addEventListener("beforeunload", e => { if (session && session.inProgress != null) { e.preventDefault(); e.returnValue = ""; } });
document.addEventListener("keydown", e => {
  if (!onKey || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target.matches && e.target.matches("input,textarea")) return;
  if (onKey(e) !== false) { if (/^[a-z]$/i.test(e.key) || ["Backspace", "Enter", " "].includes(e.key)) e.preventDefault(); }
});
function countUp(el, to, ms = 900) {
  const t0 = performance.now();
  const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(to * e); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function burst(x, y, n = 18) {
  const cols = ["#00f0ff", "#ff2fd6", "#ffe600", "#39ff88"];
  for (let i = 0; i < n; i++) {
    const p = h("i", { class: "spark" }); const a = Math.random() * 6.28, d = 40 + Math.random() * 70;
    p.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.append(p); setTimeout(() => p.remove(), 700);
  }
} // {day, practice, scores:[], details:[]}

// Loads today's saved run. If the page was closed mid-category, that category is
// locked in at whatever was earned so far (no replays).
function loadToday() {
  const s = store.get("dg-" + todayKey());
  if (s && s.inProgress != null) {
    if (s.inProgress === s.scores.length && s.scores.length < 5) { s.scores.push(Math.round(Math.max(0, Math.min(1000, s.partial || 0)))); s.details.push("left mid-category"); }
    delete s.inProgress; delete s.partial; store.set("dg-" + s.key, s);
  }
  return s;
}
// THE single place that turns a day key into that day's content. To move to a
// backend later, replace the body with a fetch (and make callers await it).
function getDailySet(dayKey) {
  const d = dayOfKey(dayKey), w = Math.floor(d / WORD_GAMES.length);
  return { day: d, worldRush: pick(C.worldRush, d), history: pick(C.history, d), sports: pick(C.sports, d),
    // Formats rotate daily (period 5), so each format indexes its own list by how
  // many times it has come up: floor(day / 5). Avoids getting stuck on multiples of 5.
  wordGame: pick(WORD_GAMES, d), wordFlip: pick(C.wordFlip, w), wordBridge: pick(C.wordBridge, w), connections: pick(C.connections, w),
    oddOneOut: pick(C.oddOneOut, w), anagram: pick(window.ANAGRAM_SETS, w), thinkFast: pick(C.thinkFast, d) };
}
function newSession(practice) {
  let s;
  if (!practice) s = loadToday();
  if (s) s.practice = false;
  else s = { key: practice ? keyOf(Math.floor(Math.random() * 1000)) : todayKey(), practice, scores: [], details: [] };
  s.day = dayOfKey(s.key);
  Object.defineProperty(s, "set", { value: getDailySet(s.key), enumerable: false, writable: true }); // not saved
  return s;
}
// Records points earned so far in the current category (used if the page reloads).
function track(pts) { if (session && session.inProgress != null) { session.partial = pts; save(); } }
function save() { if (session && !session.practice) store.set("dg-" + session.key, session); }
const wordGameFor = day => getDailySet(keyOf(day)).wordGame;

// ---------- timer ----------
function Timer(seconds, onEnd, parent) {
  const bar = h("div", { class: "timer" }, h("div", { class: "timer-fill" }), h("span", { class: "timer-text" }));
  parent.append(bar);
  const end = Date.now() + seconds * 1000; let stopped = false;
  const tick = () => {
    if (stopped) return;
    const left = Math.max(0, end - Date.now());
    bar.firstChild.style.width = (left / (seconds * 1000) * 100) + "%";
    bar.lastChild.textContent = Math.ceil(left / 1000) + "s";
    bar.classList.toggle("low", left < 10000);
    if (left <= 0) { stopped = true; onEnd(); } else requestAnimationFrame(tick);
  };
  const api = { stop() { stopped = true; timers.delete(api); }, get left() { return Math.max(0, end - Date.now()) / 1000; } };
  timers.add(api);
  tick();
  return api;
}

function screen(title, sub) {
  onKey = null; clearScreenTimers();
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  app.innerHTML = ""; app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  const cat = session && CATS[session.scores.length];
  const head = h("header", { class: "game-head" },
    h("div", { class: "crumb" }, session.practice ? "Practice" : "Daily Gauntlet", " · ", (session.scores.length + 1) + "/5"),
    h("h2", {}, title), sub ? h("p", { class: "muted" }, sub) : null,
    h("div", { class: "runtotal" }, "Total ", h("b", {}, fmt(session.scores.reduce((a, b) => a + b, 0))), " / 5,000"));
  const body = h("section", { class: "game-body" });
  app.append(head, body);
  return body;
}
function feedback(parent, ok, text) {
  const f = h("div", { class: "fb " + (ok === true ? "good" : ok === false ? "bad" : "neutral") }, text);
  parent.append(f);
  if (ok === true) { const r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); }
  else if (ok === false) { document.body.classList.remove("flash-bad"); void document.body.offsetWidth; document.body.classList.add("flash-bad"); }
  return f;
}
// One-shot button: ignores double-clicks and key-repeat.
function nextBtn(parent, label, fn) { let used = false; const b = h("button", { class: "btn primary big", onclick: () => { if (used) return; used = true; b.disabled = true; b.blur(); fn(); } }, label); parent.append(b); if (matchMedia("(hover: hover) and (pointer: fine)").matches) b.focus({ preventScroll: true }); return b; }
// Sticky bottom bar for the main action on game screens (always reachable on phones).
const actionBar = body => { const bar = h("div", { class: "action-bar" }); body.append(bar); return bar; };

// ---------- home ----------
function home() {
  $(".result-modal")?.remove();
  session = null; onKey = null; clearScreenTimers();
  app.innerHTML = ""; app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  const s = loadToday();
  const done = s && s.scores.length === 5;
  const stats = store.get("dg-stats", { played: 0, best: 0, streak: 0, last: null });
  const day = dayIndex();
  const wg = wordGameFor(day);
  app.append(
    h("div", { class: "hero" },
      h("div", { class: "logo" }, "DAILY", h("span", {}, "GAUNTLET")),
      h("p", { class: "tag" }, "Five categories. One shot a day. 5,000 points on the line."),
      h("p", { class: "date" }, new Date(day * 864e5).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }) + " · Gauntlet #" + gameNumber(day))),
    h("ol", { class: "path" }, CATS.map((c, i) => {
      const sc = s && s.scores[i];
      const state = sc != null ? "done" : (s ? s.scores.length : 0) === i ? "next" : "locked";
      return h("li", { class: "step " + state },
        h("span", { class: "num" }, sc != null ? "✓" : i + 1),
        h("span", { class: "ic" }, ic(c.icon, c.img)),
        h("span", { class: "nm" }, h("b", {}, c.name), h("small", {}, c.id === "word" ? "Today: " + wg.name : c.sub)),
        h("span", { class: "pts" }, sc != null ? fmt(sc) : state === "locked" ? "🔒" : "1,000"));
    })),
    done
      ? h("div", { class: "cta" }, h("p", {}, "You've finished today's Gauntlet: ", h("b", {}, fmt(s.scores.reduce((a, b) => a + b, 0)) + " / 5,000")),
          h("button", { class: "btn primary big", onclick: () => { session = newSession(false); results(); } }, "View results"),
          h("p", { class: "muted", id: "countdown" }))
      : h("div", { class: "cta" }, h("button", { class: "btn primary big", onclick: () => { session = newSession(false); runNext(); } }, s && s.scores.length ? "Continue today's Gauntlet" : "Start today's Gauntlet"),
          h("p", { class: "muted", id: "countdown" })),
    h("button", { class: "btn ghost", onclick: () => { session = newSession(true); runNext(); } }, "🎯 Practice mode (doesn't count)"),
    h("div", { class: "stats" },
      h("div", {}, h("b", {}, stats.played), h("small", {}, "Played")),
      h("div", {}, h("b", {}, fmt(stats.best)), h("small", {}, "Best")),
      h("div", {}, h("b", {}, stats.streak), h("small", {}, "Streak"))),
    h("details", { class: "rules" }, h("summary", {}, "How it works"),
      h("ul", {},
        h("li", {}, "Same challenge for everyone, new every day at midnight US Eastern (New York) time."),
        h("li", {}, "Fixed order: World Rush → History Timeline → Sports IQ → Word Challenge → Think Fast."),
        h("li", {}, "Each category is worth up to 1,000 points. No speed bonuses — accuracy wins."),
        h("li", {}, "Finish a category to unlock the next. No skipping or replays."),
        h("li", {}, "The Word Challenge rotates daily between Word Flip, Word Bridge, Connections 3×3, Odd One Out and Anagram Rush."))),
    h("p", { class: "fine" }, "Beta prototype · scores saved on this device only. Leaderboards, friends and prize pools coming later."));
  const cd = () => {
    const el = $("#countdown"); if (!el) return;
    if (dayIndex() !== day) return home(); // new day: re-render
    const t = Math.floor(msToReset() / 1000);
    el.textContent = (done ? "Next Gauntlet in " : "Resets in ") + [t / 3600, t % 3600 / 60, t % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":");
  };
  cd(); cdInterval = setInterval(cd, 1000);
}

// Saves a category score immediately (before the score screen is shown). One-shot per category.
function commitCat(score, detail) {
  if (session.inProgress == null) return;
  session.scores.push(Math.round(Math.max(0, Math.min(1000, score))));
  session.details.push(detail || "");
  delete session.inProgress; delete session.partial;
  save();
}
const WG_SECS = { flip: 60, bridge: 60, conn: 90, odd: 60, anag: 60 };
function catIntro(i, start) {
  const c = CATS[i];
  if (i === 3) {
    const wg = wordGameFor(session.day);
    const body = screen(c.icon + " " + c.name, "Rotates daily · today's format below");
    body.append(h("div", { class: "wg-intro" },
      h("small", { class: "wg-intro__label" }, "Today's word game"),
      h("div", { class: "wg-intro__name" }, wg.name),
      h("p", { class: "wg-intro__sub" }, wg.sub),
      h("div", { class: "wg-intro__chips" }, h("span", { class: "wg-chip" }, "⏱ " + WG_SECS[wg.id] + " seconds"), h("span", { class: "wg-chip" }, "Up to 1,000 pts")),
      h("div", { class: "wg-intro__how" }, h("b", {}, "How it works"), introText("word"))));
    nextBtn(actionBar(body), "Start " + wg.name, () => { session.inProgress = i; session.partial = 0; save(); start(); });
    return;
  }
  const body = screen(c.icon + " " + c.name, i === 3 ? "Today's word game: " + wordGameFor(session.day).name + " — " + wordGameFor(session.day).sub : c.sub);
  body.append(h("div", { class: "intro" }, h("div", { class: "big-ic" }, ic(c.icon, c.img)), h("p", {}, "Worth up to ", h("b", {}, "1,000 points"), "."), introText(c.id)));
  nextBtn(body, "Start " + (i === 3 ? wordGameFor(session.day).name : c.name), () => { session.inProgress = i; session.partial = 0; save(); start(); });
}
function introText(id) {
  const t = {
    world: "Drop a pin as close as you can to two cities (up to 450 pts each — 0 at 4,000 km+), then answer one geography question (100 pts). Tap the map to place your pin; tap again to move it.",
    history: "Drag the picture cards into chronological order, earliest on the left. Round 1: 4 events in 30s (400 pts). Round 2: 5 events in 45s (600 pts). Partial credit for every correctly ordered pair.",
    sports: "Three questions of rising difficulty: 250, 350, then 400 points. All or nothing.",
    word: { flip: "Unscramble 6 medium–hard words using the hint (definition, synonym, antonym or riddle). Tap letters to spell; correct answers auto-advance. First 4 words 150 pts, last 2 worth 200. 60 seconds.",
      bridge: "Find the middle word that finishes the first word and starts the second, e.g. SUN _ HOUSE → LIGHT (sunlight, lighthouse). It is NOT a word that blends both meanings. 6 puzzles: the first 4 are worth 150 pts, the last 2 are worth 200. 60 seconds.",
      conn: "Sort 9 words into 3 groups of 3. Groups are worth 300, 300 and 400. Three wrong guesses ends the round. 90 seconds.",
      odd: "8 sets of four words — tap the one that doesn't belong. 4 medium (100 pts) then 4 hard (150 pts). 60 seconds.",
      anag: "Make as many 3–6 letter words as you can from 6 letters in 60 seconds. 3 letters = 10, 4 = 25, 5 = 50, 6 = 100. No penalty for wrong guesses." },
    think: "Two tough reasoning puzzles worth 400 and 600 points. You get ONE submission each — think before you lock it in."
  }[id];
  return h("p", { class: "muted" }, typeof t === "string" ? t : t[wordGameFor(session.day).id]);
}
function runNext() {
  const i = session.scores.length;
  if (i >= 5) return results();
  const go = [worldRush, history, sports, wordChallenge, thinkFast][i];
  catIntro(i, go);
}
function catDone(body, score, detail) {
  commitCat(score, detail);
  const b = h("b", {}, "0");
  body.append(h("div", { class: "cat-score" }, h("small", {}, "Category score"), b, h("small", {}, "/ 1,000")));
  countUp(b, score);
  if (session.scores.length >= 5) { setTimeout(() => { if (body.isConnected && session && session.scores.length >= 5) resultsPopup(); }, 500); }
  nextBtn(body, session.scores.length >= 5 ? "See final results" : "Next: " + CATS[session.scores.length].name + " →", runNext);
}

// ---------- maps ----------
function leafletMap(el, onPick) {
  const L = window.L;
  const map = L.map(el, { worldCopyJump: false, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, maxBounds: [[-85, -200], [85, 200]], maxBoundsViscosity: 1, attributionControl: true, tap: true });
  // Label-free basemap (no API key): Esri World Ocean Base has no place/country names (the Reference layer is NOT added).
  // Native tiles stop at z10 (z11+ shows "Map data not yet available"), so the map is capped at z9.
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}", {
    noWrap: true, bounds: [[-85.05, -180], [85.05, 180]], maxZoom: 9, maxNativeZoom: 10,
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, Garmin, GEBCO, NOAA NGDC, and other contributors'
  }).addTo(map);
  map.fitBounds([[-55, -170], [75, 175]]);
  setTimeout(() => map.invalidateSize(), 60);
  const icon = cls => L.divIcon({ className: "", html: `<div class="lpin ${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  let mk = null, locked = false;
  map.on("click", e => {
    if (locked) return;
    const ll = e.latlng.wrap();
    if (mk) mk.setLatLng(e.latlng); else mk = L.marker(e.latlng, { icon: icon("guess") }).addTo(map);
    onPick({ lat: ll.lat, lon: ll.lng });
  });
  return { reveal(t, g) {
    locked = true;
    const tm = L.marker([t.lat, t.lon], { icon: icon("target") }).addTo(map);
    if (g) {
      const gl = mk.getLatLng();
      L.polyline([gl, [t.lat, t.lon]], { color: "#ff2fd6", weight: 3, dashArray: "8 8" }).addTo(map);
      map.flyToBounds(L.latLngBounds([gl, [t.lat, t.lon]]).pad(0.4), { duration: 0.8, maxZoom: 6 });
    } else map.flyTo([t.lat, t.lon], 4, { duration: 0.8 });
    tm.bindTooltip(t.name, { permanent: true, direction: "top", className: "ltip", offset: [0, -10] });
  } };
}
// Offline fallback (used only if Leaflet can't load): neon SVG map with zoom buttons.
function svgMap(el, onPick) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  let vb = [0, 0, 1000, 500];
  svg.setAttribute("class", "map");
  svg.innerHTML = `<rect x="-500" y="-500" width="2000" height="1500" class="sea"/><path class="land" d="${window.LAND_PATH}"/><g class="marks"></g>`;
  const setVB = () => svg.setAttribute("viewBox", vb.join(" "));
  setVB();
  const zoom = f => { const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2; vb[2] = Math.min(1000, Math.max(80, vb[2] * f)); vb[3] = vb[2] / 2; vb[0] = cx - vb[2] / 2; vb[1] = cy - vb[3] / 2; setVB(); };
  el.append(svg, h("div", { class: "zbtns" }, h("button", { onclick: () => zoom(0.6) }, "+"), h("button", { onclick: () => zoom(1 / 0.6) }, "−")));
  const marks = svg.querySelector(".marks");
  const toXY = p => [(p.lon + 180) / 360 * 1000, (90 - p.lat) / 180 * 500];
  const r = () => vb[2] / 120;
  const draw = (p, cls) => { const [x, y] = toXY(p); const c = document.createElementNS(NS, "circle"); c.setAttribute("cx", x); c.setAttribute("cy", y); c.setAttribute("r", r()); c.setAttribute("class", "spin " + cls); marks.append(c); };
  let locked = false, down = null;
  svg.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, vb: vb.slice() }; svg.setPointerCapture(e.pointerId); });
  svg.addEventListener("pointermove", e => { if (!down) return; const k = vb[2] / svg.clientWidth; vb[0] = down.vb[0] - (e.clientX - down.x) * k; vb[1] = down.vb[1] - (e.clientY - down.y) * k; setVB(); });
  svg.addEventListener("pointerup", e => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6; down = null;
    if (moved || locked) return;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const g = { lon: Math.max(-180, Math.min(180, p.x / 1000 * 360 - 180)), lat: Math.max(-90, Math.min(90, 90 - p.y / 500 * 180)) };
    marks.innerHTML = ""; draw(g, "guess"); onPick(g);
  });
  return { reveal(t, g) { locked = true; draw(t, "target"); if (g) { const [x1, y1] = toXY(g), [x2, y2] = toXY(t); const l = document.createElementNS(NS, "line"); Object.entries({ x1, y1, x2, y2, class: "dist" }).forEach(([k, v]) => l.setAttribute(k, v)); marks.prepend(l); } } };
}

// ---------- 1. World Rush ----------
function haversine(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
const pinPoints = d => Math.round(450 * Math.max(0, 1 - d / 4000));
function worldRush() {
  const set = session.set.worldRush;
  let total = 0, step = 0; const log = [];
  const doPin = () => {
    const target = set.pins[step];
    const body = screen("🌎 World Rush", "Pin " + (step + 1) + " of 2 · up to 450 pts");
    body.classList.add("wr-body");
    body.append(h("p", { class: "prompt wr-prompt" }, "Where is ", h("b", { class: "hl" }, target.name), "?"));
    const mapEl = h("div", { class: "lmap" });
    const zhint = h("div", { class: "map-hint", "aria-hidden": "true" }, "Pinch or scroll to zoom, drag to move");
    const wrap = h("div", { class: "map-wrap" }, mapEl, zhint);
    body.append(wrap);
    const hideHint = () => zhint.classList.add("gone");
    ["pointerdown", "wheel", "touchstart", "keydown"].forEach(ev => wrap.addEventListener(ev, hideHint, { once: true, passive: true }));
    let guess = null, locked = false, api;
    const bar = actionBar(body);
    const btn = h("button", { class: "btn primary big", disabled: true, onclick: () => submit() }, "📍 Lock in pin");
    bar.append(btn);
    const onPick = p => { if (locked) return; guess = p; btn.disabled = false; hideHint(); };
    api = window.L ? leafletMap(mapEl, onPick) : svgMap(mapEl, onPick);
    const timer = Timer(TBD.pin, () => submit(), body.parentNode.querySelector(".game-head"));
    function submit() {
      if (locked) return; locked = true; timer.stop(); btn.remove();
      let pts = 0, msg;
      if (guess) {
        const d = haversine(guess, target); pts = pinPoints(d);
        msg = `${fmt(d)} km away → +${pts}`;
      } else msg = "Time's up — no pin placed → +0";
      api.reveal(target, guess);
      total += pts; log.push(pts); track(total);
      feedback(bar, pts > 300 ? true : pts > 0 ? null : false, msg);
      step++;
      nextBtn(bar, step < 2 ? "Next pin →" : "Geography question →", step < 2 ? doPin : doMC);
    }
  };
  const doMC = () => {
    const body = screen("🌎 World Rush", "Geography question · 100 pts");
    mcQuestion(body, withFlag(set.mc.q, set.mc.img), set.mc.optionImgs ? set.mc.options.map((o, k) => ic(o, set.mc.optionImgs[k], "flag")) : set.mc.options, set.mc.a, 100, TBD.mc, pts => { total += pts; track(total); log.push(pts); catDone(body, total, log.join("/")); });
  };
  doPin();
}
function mcQuestion(body, q, options, answer, value, seconds, done, visual) {
  if (visual) body.append(h("div", { class: "visual" }, visual));
  body.append(h("p", { class: "prompt" }, q));
  let over = false;
  const order = seededOrder(options.length, session.key + "|" + qText(q)); // order[pos] = original index
  const opts = h("div", { class: "options" }, order.map(i => h("button", { class: "opt", onclick: () => choose(i) }, options[i])));
  body.append(opts);
  const timer = seconds ? Timer(seconds, () => choose(-1), body.parentNode.querySelector(".game-head")) : null;
  function choose(i) {
    if (over) return; over = true; timer && timer.stop();
    [...opts.children].forEach((b, pos) => { const j = order[pos]; b.disabled = true; if (j === answer) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); });
    const ok = i === answer;
    feedback(body, ok, ok ? `Correct! +${value}` : i < 0 ? "Time's up. +0" : "Not quite. +0");
    done(ok ? value : 0);
  }
}

// ---------- 2. History Timeline ----------
function history() {
  const set = session.set.history;
  const rounds = [{ ...set.r1, secs: 30, max: 400 }, { ...set.r2, secs: 45, max: 600 }];
  let total = 0, r = 0; const log = [];
  const R = rng(session.day * 7 + 3);
  const play = () => {
    const rd = rounds[r];
    const body = screen("📜 History Timeline", `Round ${r + 1} of 2 · ${rd.theme} · up to ${rd.max} pts`);
    body.append(h("p", { class: "prompt" }, "Drag the cards into order — ", h("b", {}, "earliest → latest"), "."));
    let order = shuffle(rd.events.map((_, i) => i), R);
    if (order.every((v, i) => v === i)) order.reverse();
    const line = h("div", { class: "timeline" });
    const axis = h("div", { class: "axis" }, h("span", {}, "Earlier"), h("span", {}, "Later"));
    body.append(h("p", { class: "drag-hint" }, "☝️ Touch and drag to reorder"), axis, line);
    let locked = false;
    const render = () => {
      line.innerHTML = "";
      order.forEach((ev, pos) => {
        const e = rd.events[ev];
        const card = h("div", { class: "card", "data-ev": ev, tabindex: locked ? -1 : 0, "aria-label": e[1] + (locked ? "" : " — drag to reorder, or use arrow keys") },
          h("div", { class: "pic" }, ic(e[0], e[3])), h("div", { class: "cap" }, e[1]),
          locked ? h("div", { class: "yr" }, e[2] < 0 ? -e[2] + " BC" : e[2]) : h("div", { class: "grip", "aria-hidden": "true" }, "⠿"));
        if (!locked) enableDrag(card);
        line.append(card);
      });
      line.classList.toggle("locked", locked);
    };
    const syncOrder = () => { order = [...line.children].filter(c => c.dataset.ev != null).map(c => +c.dataset.ev); };
    // Pointer-event drag: floating preview follows the finger/mouse, a placeholder shows the drop slot,
    // the page auto-scrolls near the edges and never scrolls under the drag (touch-action: none on cards).
    function enableDrag(card) {
      card.addEventListener("keydown", e => {
        const k = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!k || locked) return;
        e.preventDefault(); const kids = [...line.children], i = kids.indexOf(card), j = i + k; if (j < 0 || j >= kids.length) return;
        if (k < 0) line.insertBefore(card, kids[j]); else line.insertBefore(kids[j], card); syncOrder(); card.focus();
      });
      card.addEventListener("pointerdown", e => {
        if (locked || (e.pointerType === "mouse" && e.button !== 0)) return;
        e.preventDefault();
        const r0 = card.getBoundingClientRect(), dx = e.clientX - r0.left, dy = e.clientY - r0.top;
        const vertical = getComputedStyle(line).gridAutoFlow.startsWith("row");
        const ghost = card.cloneNode(true); ghost.classList.add("drag-ghost"); ghost.removeAttribute("tabindex");
        Object.assign(ghost.style, { width: r0.width + "px", height: r0.height + "px", left: r0.left + "px", top: r0.top + "px" });
        document.body.append(ghost); card.classList.add("drag-placeholder"); document.body.classList.add("is-dragging");
        try { card.setPointerCapture(e.pointerId); } catch {}
        let lastY = e.clientY, lastX = e.clientX, raf = 0;
        const place = () => {
          const others = [...line.children].filter(c => c !== card);
          let before = null;
          for (const o of others) { const r = o.getBoundingClientRect(); if (vertical ? lastY < r.top + r.height / 2 : lastX < r.left + r.width / 2) { before = o; break; } }
          if (before ? card.nextSibling !== before : line.lastChild !== card) line.insertBefore(card, before);
        };
        const scroller = () => {
          const edge = 70, H = window.innerHeight; let v = 0;
          if (lastY < edge) v = -Math.ceil((edge - lastY) / 6); else if (lastY > H - edge) v = Math.ceil((lastY - (H - edge)) / 6);
          if (v) { window.scrollBy(0, v); place(); }
          raf = requestAnimationFrame(scroller);
        };
        raf = requestAnimationFrame(scroller);
        const mv = ev => { if (ev.pointerId !== e.pointerId) return; lastX = ev.clientX; lastY = ev.clientY; ghost.style.left = (lastX - dx) + "px"; ghost.style.top = (lastY - dy) + "px"; place(); };
        const up = ev => {
          if (ev && ev.pointerId !== e.pointerId) return;
          cancelAnimationFrame(raf);
          window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
          ghost.remove(); card.classList.remove("drag-placeholder"); document.body.classList.remove("is-dragging");
          syncOrder();
        };
        // listen on window: re-inserting the card in the DOM drops pointer capture
        window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
      });
    }
    render();
    const bar = actionBar(body);
    const btn = h("button", { class: "btn primary big", onclick: () => submit() }, "Lock in order");
    bar.append(btn);
    const timer = Timer(rd.secs, () => submit(), body.parentNode.querySelector(".game-head"));
    function submit() {
      if (locked) return; locked = true; timer.stop(); btn.remove();
      let good = 0, pairs = 0;
      for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) { pairs++; if (rd.events[order[i]][2] < rd.events[order[j]][2]) good++; }
      const pts = Math.round(rd.max * good / pairs);
      render();
      const correct = rd.events.map((e, i) => i).sort((a, b) => rd.events[a][2] - rd.events[b][2]);
      body.append(h("p", { class: "muted" }, "Correct order: " + correct.map(i => rd.events[i][1] + " (" + (rd.events[i][2] < 0 ? -rd.events[i][2] + " BC" : rd.events[i][2]) + ")").join(" → ")));
      feedback(body, good === pairs ? true : good > pairs / 2 ? null : false, `${good}/${pairs} pairs in order → ${pts} pts`);
      total += pts; log.push(pts); track(total); r++;
      body.querySelector(".drag-hint")?.remove();
      if (r < 2) nextBtn(bar, "Round 2 →", play); else catDone(body, total, log.join("/"));
    }
  };
  play();
}

// ---------- 3. Sports IQ ----------
function sports() {
  const qs = session.set.sports, vals = [250, 350, 400], labels = ["Easy", "Medium", "Hard"];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], body = screen("🏆 Sports IQ", `Question ${i + 1} of 3 · ${labels[i]} · ${vals[i]} pts`);
    const after = pts => { total += pts; track(total); log.push(pts); i++; if (i < 3) nextBtn(body, "Next question →", ask); else catDone(body, total, log.join("/")); };
    if (q.type === "mc") mcQuestion(body, q.q, q.options, q.a, vals[i], 0, after, q.img ? ic(q.visual, q.img) : q.visual);
    else textQuestion(body, q.q, q.answers, vals[i], 0, after, q.img ? ic(q.visual, q.img) : q.visual, q.answers[0], null, q);
  };
  ask();
}
function textQuestion(body, q, answers, value, seconds, done, visual, display, explain, src) {
  if (visual) body.append(h("div", { class: "visual" }, visual));
  body.append(h("p", { class: "prompt" }, q));
  let over = false;
  const input = h("input", { class: "txt", placeholder: "Type your answer", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); if (input.value.trim()) submit(input.value); } }, input, h("button", { class: "btn primary", type: "submit" }, "Lock in"));
  body.append(form); setTimeout(() => input.focus(), 50);
  const timer = seconds ? Timer(seconds, () => submit(input.value), body.parentNode.querySelector(".game-head")) : null;
  function submit(v) {
    if (over) return; over = true; timer && timer.stop(); input.disabled = true; form.querySelector("button").remove();
    const ok = window.Answers ? window.Answers.checkAnswer(v || "", answers, { aliases: src && src.aliases, wrong: src && (src.wrong || src.options), noSurname: src && src.noSurname })
      : answers.some(a => norm(a) === norm(v || ""));
    feedback(body, ok, (ok ? `Correct! +${value}` : `Answer: ${display.replace(/\b\w/g, c => c.toUpperCase())}. +0`) + (explain ? " — " + explain : ""));
    done(ok ? value : 0);
  }
}

// ---------- 4. Word Challenge ----------
function wordChallenge() { ({ flip: wordFlip, bridge: wordBridge, conn: connections, odd: oddOneOut, anag: anagramRush })[wordGameFor(session.day).id](); }

function wordFlip() {
  const list = session.set.wordFlip, R = rng(session.day);
  const body = screen("📝 Word Flip", "6 words · 60 seconds");
  let i = 0, total = 0, over = false, busy = false, built = [];
  // Any dictionary word using exactly the same letters also counts (e.g. LISTEN for SILENT).
  const dict = new Set(Object.values(window.ANAGRAM_SETS || {}).flatMap(s => s.valid || []).map(w => w.toUpperCase()));
  const sorted = x => x.split("").sort().join("");
  const hintEl = h("div", { class: "hint" }), slots = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), prog = h("div", { class: "prog" });
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { if (busy) return; built.pop(); draw(); } }, "↩ Undo"), h("button", { class: "btn", onclick: () => { if (busy) return; built = []; draw(); } }, "Clear"), h("button", { class: "btn", onclick: () => { if (busy) return; skip(); } }, "Skip →"));
  const results = [];
  // Skipped words go to the back of the queue and come back while time remains.
  let queue = list.slice(0, 6).map((_, k) => k), cur = 0;
  body.append(prog, hintEl, slots, tiles, ctrls, h("p", { class: "skip-note" }, "Skipped words come back at the end if time remains."));
  let letters = [];
  const val = k => k < 4 ? 150 : 200;
  const load = () => {
    i = queue[0]; const [w] = list[i];
    do letters = shuffle(w.split("").map((c, k) => ({ c, k })), R); while (letters.map(l => l.c).join("") === w);
    built = []; draw();
  };
  const draw = () => {
    const [w, style, hint] = list[i];
    prog.textContent = `Word ${i + 1}/6 · ${val(i)} pts · Score ${total}` + (queue.length < 6 ? ` · ${queue.length} left` : "");
    hintEl.innerHTML = ""; hintEl.append(h("span", { class: "badge" }, style), " ", hint);
    slots.innerHTML = ""; w.split("").forEach((_, k) => slots.append(h("span", { class: "slot" + (built[k] != null ? " on" : "") }, built[k] != null ? letters[built[k]].c : "")));
    tiles.innerHTML = ""; letters.forEach((l, k) => tiles.append(h("button", { class: "tile", disabled: built.includes(k), onclick: () => { if (busy) return; built.push(k); draw(); check(); } }, l.c)));
  };
  const check = () => {
    const w = list[i][0];
    if (built.length < w.length) return;
    const guess = built.map(k => letters[k].c).join("");
    busy = true; // block input during the win/shake animation
    if (guess === w || (sorted(guess) === sorted(w) && dict.has(guess))) { total += val(i); track(total); results[i] = true; slots.classList.add("win"); setTimeout(() => { slots.classList.remove("win"); busy = false; advance(); }, 350); }
    else { slots.classList.add("shake"); setTimeout(() => { slots.classList.remove("shake"); busy = false; if (over) return; built = []; draw(); }, 400); }
  };
  const advance = () => { if (over) return; queue.shift(); if (!queue.length) end(); else load(); };
  const skip = () => { if (over) return; results[i] = false; queue.push(queue.shift()); load(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); ctrls.remove(); tiles.remove(); slots.remove(); hintEl.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([w], k) => h("li", { class: results[k] ? "ok" : "no" }, (results[k] ? "✓ " : "✗ ") + w))));
    catDone(body, total, "flip");
  };
  onKey = e => {
    if (over) return false;
    if (busy) return /^[a-z]$/i.test(e.key) || e.key === "Backspace" ? undefined : false;
    if (e.key === "Backspace") { built.pop(); draw(); return; }
    if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((l, idx) => l.c === e.key.toUpperCase() && !built.includes(idx)); if (k >= 0) { built.push(k); draw(); check(); } return; }
    return false;
  };
  body.append(h("p", { class: "kbd-tip" }, "⌨️ Type letters on your keyboard · Backspace to undo"));
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  load();
}

function wordBridge() {
  const list = session.set.wordBridge;
  const body = screen("📝 Word Bridge", "6 puzzles · 60 seconds");
  let i = 0, total = 0, over = false; const res = [];
  const val = k => k < 4 ? 150 : 200;
  const prog = h("div", { class: "prog" }), puzzle = h("div", { class: "bridge" });
  const input = h("input", { class: "txt", placeholder: "Missing word", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); guess(); } }, input, h("button", { class: "btn primary", type: "submit" }, "Submit"), h("button", { class: "btn", type: "button", onclick: () => skipB() }, "Skip"));
  let queue = list.slice(0, 6).map((_, k) => k);
  body.append(prog, puzzle, form, h("p", { class: "skip-note" }, "Skipped puzzles come back at the end if time remains."));
  const draw = () => { i = queue[0]; const [a, b] = list[i]; prog.textContent = `Puzzle ${i + 1}/6 · ${val(i)} pts · Score ${total}` + (queue.length < 6 ? ` · ${queue.length} left` : ""); puzzle.innerHTML = ""; puzzle.append(h("span", {}, a), h("span", { class: "gap" }, "?"), h("span", {}, b)); input.value = ""; input.focus(); };
  const guess = () => {
    const v = norm(input.value).toUpperCase().replace(/ /g, ""); if (!v) return;
    if (v === list[i][2]) { total += val(i); track(total); res[i] = true; puzzle.classList.add("win"); setTimeout(() => { puzzle.classList.remove("win"); adv(); }, 300); }
    else { form.classList.add("shake"); setTimeout(() => form.classList.remove("shake"), 400); input.select(); }
  };
  const adv = () => { if (over) return; queue.shift(); if (!queue.length) end(); else draw(); };
  const skipB = () => { if (over) return; res[i] = false; queue.push(queue.shift()); draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); form.remove(); puzzle.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([a, b, w], k) => h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : "✗"} ${a} ${w} · ${w} ${b}`))));
    catDone(body, total, "bridge");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function connections() {
  const set = session.set.connections;
  const body = screen("📝 Connections 3×3", "Find 3 groups of 3 · 90 seconds");
  let words = shuffle(set.groups.flatMap(g => g.words), rng(session.day)), sel = [], found = [], mistakes = 0, total = 0, over = false;
  const solved = h("div", { class: "solved" }), grid = h("div", { class: "grid3" }), info = h("div", { class: "prog" });
  const ctrls = h("div", { class: "row" },
    h("button", { class: "btn", onclick: () => { words = shuffle(words); draw(); } }, "Shuffle"),
    h("button", { class: "btn", onclick: () => { sel = []; draw(); } }, "Deselect"),
    h("button", { class: "btn primary", id: "csub", onclick: () => submit() }, "Submit"));
  body.append(info, solved, grid, ctrls);
  // Incremental updates: solved groups are appended once (their animation plays once);
  // selecting a word only toggles that tile's class; the grid is rebuilt only when words change.
  const shown = new Set(); let gridKey = "";
  const draw = () => {
    info.innerHTML = ""; info.append(`Score ${total} · Mistakes left: `, h("b", {}, "●".repeat(3 - mistakes) + "○".repeat(mistakes)));
    found.forEach(g => { if (shown.has(g.name)) return; shown.add(g.name); solved.append(h("div", { class: "group g" + set.groups.findIndex(x => x.name === g.name) + (g.pts === 0 ? " missed" : "") }, h("b", {}, g.name + " · " + g.pts), h("span", {}, g.words.join(", ")))); });
    const key = words.join("|");
    if (key !== gridKey) {
      gridKey = key; grid.innerHTML = "";
      words.forEach(w => grid.append(h("button", { class: "wtile", "data-w": w, onclick: () => { if (over) return; if (sel.includes(w)) sel = sel.filter(x => x !== w); else if (sel.length < 3) sel.push(w); draw(); } }, w)));
    }
    [...grid.children].forEach(b => b.classList.toggle("sel", sel.includes(b.dataset.w)));
    const cs = $("#csub"); if (cs) cs.disabled = sel.length !== 3;
  };
  const submit = () => {
    const g = set.groups.find(g => g.words.every(w => sel.includes(w)));
    if (g) { found.push(g); total += g.pts; track(total); words = words.filter(w => !g.words.includes(w)); sel = []; if (found.length === 3) return end(); }
    else { mistakes++; const one = set.groups.some(g => g.words.filter(w => sel.includes(w)).length === 2); grid.classList.add("shake"); setTimeout(() => grid.classList.remove("shake"), 400); if (one) feedbackTmp("One away…"); sel = []; if (mistakes >= 3) return end(); }
    draw();
  };
  const feedbackTmp = t => { const f = feedback(body, null, t); setTimeout(() => f.remove(), 1200); };
  const end = () => {
    if (over) return; over = true; timer.stop(); grid.remove(); ctrls.remove();
    found = found.concat(set.groups.filter(g => !found.includes(g)).map(g => Object.assign({}, g, { pts: 0 })));
    draw();
    catDone(body, total, "conn");
  };
  const timer = Timer(90, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function oddOneOut() {
  const list = session.set.oddOneOut;
  const body = screen("📝 Odd One Out", "8 puzzles · 60 seconds");
  let i = 0, total = 0, over = false; const res = [];
  const val = k => k < 4 ? 100 : 150;
  const prog = h("div", { class: "prog" }), opts = h("div", { class: "options two" });
  body.append(prog, h("p", { class: "prompt" }, "Which one doesn't belong?"), opts);
  const draw = () => {
    prog.textContent = `Puzzle ${i + 1}/8 · ${i < 4 ? "Medium" : "Hard"} · ${val(i)} pts · Score ${total}`;
    opts.innerHTML = ""; seededOrder(list[i].words.length, session.key + "|odd|" + list[i].words.join(",")).forEach(k => { const w = list[i].words[k]; opts.append(h("button", { class: "opt", onclick: () => pickIt(k) }, w)); });
  };
  const pickIt = k => { if (over) return; const ok = k === list[i].odd; res.push(ok); if (ok) { total += val(i); track(total); } i++; if (i >= 8) end(); else draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); opts.remove(); prog.remove(); body.querySelector(".prompt").remove();
    body.append(h("ul", { class: "review" }, list.map((p, k) => h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : res[k] === false ? "✗" : "–"} ${p.words.join(" · ")} — ${p.why}`))));
    catDone(body, total, "odd");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function anagramRush() {
  const set = session.set.anagram;
  const valid = new Set(set.valid), PTS = { 3: 10, 4: 25, 5: 50, 6: 100 };
  // Behind-the-scenes conversion (NOT finalized in spec): 1,000 = 60% of the raw points available from common words.
  const target = 0.6 * set.common.reduce((a, w) => a + PTS[w.length], 0);
  const body = screen("📝 Anagram Rush", "6 letters · 60 seconds");
  let letters = shuffle(set.letters.split(""), rng(session.day)), built = [], found = [], raw = 0, over = false;
  const scoreEl = h("div", { class: "raw" }), cur = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), list = h("div", { class: "found" });
  const form = h("p", { class: "kbd-tip" }, "⌨️ Type letters · Enter to submit · Backspace to delete · Space to shuffle");
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { letters = shuffle(letters); built = []; draw(); } }, "🔀 Shuffle"), h("button", { class: "btn", onclick: () => { built = []; draw(); } }, "Clear"), h("button", { class: "btn primary", onclick: () => tryWord(built.map(k => letters[k]).join("")) }, "Submit word"));
  body.append(scoreEl, cur, tiles, ctrls, form, list);
  const draw = () => {
    scoreEl.innerHTML = ""; scoreEl.append(h("b", {}, raw), " pts · ", found.length, " words");
    cur.innerHTML = ""; for (let k = 0; k < 6; k++) cur.append(h("span", { class: "slot" + (built[k] != null ? " on" : "") }, built[k] != null ? letters[built[k]] : ""));
    tiles.innerHTML = ""; letters.forEach((l, k) => tiles.append(h("button", { class: "tile", disabled: built.includes(k), onclick: () => { built.push(k); draw(); } }, l)));
    list.innerHTML = ""; found.forEach(w => list.append(h("span", { class: "chip" }, w.toUpperCase() + " +" + PTS[w.length])));
  };
  const flash = (t, ok) => { const f = feedback(body, ok, t); setTimeout(() => f.remove(), 900); };
  const tryWord = w => {
    if (over) return; w = w.toLowerCase().trim(); built = [];
    if (w.length < 3) { draw(); return; }
    if (found.includes(w)) flash("Already found", null);
    else if (valid.has(w)) { found.unshift(w); raw += PTS[w.length]; track(Math.min(1000, Math.round(raw / target * 1000))); flash("+" + PTS[w.length], true); }
    else flash("Not a word", false);
    draw();
  };
  const end = () => {
    if (over) return; over = true; timer.stop(); tiles.remove(); ctrls.remove(); form.remove(); cur.remove();
    const missed = set.common.filter(w => !found.includes(w));
    body.append(h("p", { class: "muted" }, "Missed words: " + (missed.length ? missed.map(w => w.toUpperCase()).join(", ") : "none — wow!")));
    const conv = Math.min(1000, Math.round(raw / target * 1000));
    commitCat(conv, "anag raw " + raw);
    body.append(h("div", { class: "cat-score" }, h("small", {}, "Your Anagram Rush score"), h("b", {}, fmt(raw)), h("small", {}, "points")));
    nextBtn(body, "Next: Think Fast →", runNext);
  };
  onKey = e => {
    if (over) return false;
    if (e.key === "Enter") { tryWord(built.map(k => letters[k]).join("")); return; }
    if (e.key === "Backspace") { built.pop(); draw(); return; }
    if (e.key === " ") { letters = shuffle(letters); built = []; draw(); return; }
    if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((l, idx) => l === e.key.toUpperCase() && !built.includes(idx)); if (k >= 0) { built.push(k); draw(); } else { cur.classList.add("shake"); setTimeout(() => cur.classList.remove("shake"), 300); } return; }
    return false;
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

// ---------- 5. Think Fast ----------
function thinkFast() {
  const qs = session.set.thinkFast, vals = [400, 600];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], body = screen("🧠 Think Fast", `Puzzle ${i + 1} of 2 · ${vals[i]} pts · one submission`);
    textQuestion(body, q.q, q.answers, vals[i], TBD.think, pts => { total += pts; track(total); log.push(pts); i++; if (i < 2) nextBtn(body, "Final puzzle →", ask); else catDone(body, total, log.join("/")); }, null, q.answers[0], q.explain, q);
  };
  ask();
}

// ---------- results ----------
const blocks = s => s >= 900 ? "🟩" : s >= 600 ? "🟨" : s >= 300 ? "🟧" : "🟥";
const shareText = () => `Daily Gauntlet ${session.practice ? "(practice)" : "#" + gameNumber(dayOfKey(session.key)) + " · " + session.key}\n${session.scores.map((s, i) => CATS[i].icon + " " + blocks(s) + " " + s).join("\n")}\n🏁 ${session.scores.reduce((a, b) => a + b, 0).toLocaleString()} / 5,000`;
async function doShare(btn) { const t = shareText(); try { if (navigator.share) await navigator.share({ text: t }); else { await navigator.clipboard.writeText(t); btn.textContent = "Copied!"; } } catch {} }
// Lightweight confetti on a single canvas (~1.5 s, no library).
function confetti(host) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = h("canvas", { class: "confetti-canvas", "aria-hidden": "true" }); host.append(c);
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = c.width = innerWidth * dpr, H = c.height = innerHeight * dpr, ctx = c.getContext("2d");
  const cols = ["#00f0ff", "#ff2fd6", "#ffe600", "#39ff88"];
  const ps = Array.from({ length: 90 }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .35, vx: (Math.random() - .5) * 14 * dpr, vy: (-6 - Math.random() * 10) * dpr, r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[Math.random() * 4 | 0] }));
  const t0 = performance.now();
  const step = t => {
    if (!c.isConnected) return; const k = t - t0; ctx.clearRect(0, 0, W, H);
    ps.forEach(p => { p.vy += .35 * dpr; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - k / 2200); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (k < 2200) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}
function countStats() {
  if (session.practice || session.counted) return;
  session.counted = true; save();
  const tot = session.scores.reduce((a, b) => a + b, 0);
  const st = store.get("dg-stats", { played: 0, best: 0, streak: 0, last: null });
  // Streak credits the day the run STARTED (session.key), even if it finishes after the reset.
  const gap = st.last ? dayOfKey(session.key) - dayOfKey(st.last) : null;
  st.streak = gap === 1 ? st.streak + 1 : gap === 0 ? st.streak : 1; st.last = session.key; st.played++; st.best = Math.max(st.best, tot);
  store.set("dg-stats", st);
}
// Pop-up shown the moment the 5th category finishes. Styling: .result-modal* / .confetti-canvas in style.css.
function resultsPopup() {
  if ($(".result-modal")) return;
  countStats();
  const tot = session.scores.reduce((a, b) => a + b, 0);
  const num = h("b", { class: "result-modal__score" }, "0");
  const close = () => { m.remove(); document.removeEventListener("keydown", esc); };
  const esc = e => { if (e.key === "Escape") close(); };
  const shareBtn = h("button", { class: "btn primary big result-modal__share", onclick: () => doShare(shareBtn) }, "📤 Share result");
  const m = h("div", { class: "result-modal", role: "dialog", "aria-modal": "true", "aria-label": "Gauntlet complete" },
    h("div", { class: "result-modal__card" },
      h("small", { class: "result-modal__kicker" }, session.practice ? "Practice complete" : "Gauntlet complete!"),
      num, h("small", { class: "result-modal__of" }, "/ 5,000"),
      h("div", { class: "result-modal__blocks" }, session.scores.map(x => h("span", {}, blocks(x)))),
      shareBtn,
      h("button", { class: "btn result-modal__full", onclick: () => { close(); results(); } }, "See full results")));
  document.addEventListener("keydown", esc);
  document.body.append(m); confetti(m); countUp(num, tot, 1200);
}
function results() {
  const tot = session.scores.reduce((a, b) => a + b, 0);
  clearScreenTimers(); onKey = null;
  $(".result-modal")?.remove();
  countStats();
  app.innerHTML = ""; window.scrollTo(0, 0);
  const share = `Daily Gauntlet ${session.practice ? "(practice)" : "#" + gameNumber(dayOfKey(session.key)) + " · " + session.key}\n${session.scores.map((s, i) => CATS[i].icon + " " + blocks(s) + " " + s).join("\n")}\n🏁 ${tot.toLocaleString()} / 5,000`;
  app.append(
    h("div", { class: "hero small" }, h("div", { class: "logo" }, "DAILY", h("span", {}, "GAUNTLET")), h("p", { class: "tag" }, session.practice ? "Practice run complete" : "Today's Gauntlet complete")),
    h("div", { class: "final" }, h("small", {}, "Final score"), h("b", { id: "finalnum" }, "0"), h("small", {}, "/ 5,000")),
    h("ol", { class: "path" }, CATS.map((c, i) => h("li", { class: "step done" }, h("span", { class: "num" }, blocks(session.scores[i])), h("span", { class: "ic" }, ic(c.icon, c.img)), h("span", { class: "nm" }, h("b", {}, c.name), c.id === "word" ? h("small", {}, wordGameFor(session.day).name) : null), h("span", { class: "pts" }, fmt(session.scores[i]))))),
    h("pre", { class: "share" }, share),
    h("div", { class: "row center" },
      h("button", { class: "btn primary", onclick: e => doShare(e.currentTarget) }, "Share result"),
      h("button", { class: "btn", onclick: home }, "Home")),
    h("p", { class: "fine" }, "Global & friends leaderboards arrive with accounts in a future version."));
  countUp($("#finalnum"), tot, 1600);
  setTimeout(() => { const f = $("#finalnum"); if (!f) return; const r = f.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40); }, 1600);
}

document.addEventListener("click", e => { if (e.target.closest(".brand")) { if (!session || session.inProgress == null || confirm("Leave this game? Progress in the current category is lost.")) home(); } });
syncClock();
home();
})();
