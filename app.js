(() => {
"use strict";
const C = window.CONTENT;
const $ = (s, r = document) => r.querySelector(s);
const app = $("#app");
const CATS = [
  { id: "world", name: "World Rush", icon: "🌎", sub: "2 map pins + 1 geography question" },
  { id: "history", name: "History Timeline", icon: "📜", sub: "2 timelines · drag cards into order" },
  { id: "sports", name: "Sports IQ", icon: "🏆", sub: "3 questions · easy → hard" },
  { id: "word", name: "Word Challenge", icon: "📝", sub: "" },
  { id: "think", name: "Think Fast", icon: "🧠", sub: "2 brain-benders · one shot each" }
];
const WORD_GAMES = [
  { id: "flip", name: "Word Flip", sub: "Unscramble 6 words from hints · 60s" },
  { id: "bridge", name: "Word Bridge", sub: "Find the word linking two phrases · 60s" },
  { id: "conn", name: "Connections 3×3", sub: "Find 3 groups of 3 · 90s" },
  { id: "odd", name: "Odd One Out", sub: "Spot the word that doesn't fit · 60s" },
  { id: "anag", name: "Anagram Rush", sub: "Make words from 6 letters · 60s" }
];
// Placeholder timers for categories whose time limits are not yet locked.
const TBD = { pin: 30, mc: 20, think: 120 };

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
const norm = s => s.toLowerCase().replace(/[^a-z0-9$. ]/g, "").replace(/\s+/g, " ").trim();
function shuffle(a, rnd = Math.random) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------- day / storage ----------
function todayKey(d = new Date()) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function dayIndex(d = new Date()) { return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }
const pick = (arr, i) => arr[((i % arr.length) + arr.length) % arr.length];
const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let session = null;
let onKey = null; // per-screen physical keyboard handler
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

function newSession(practice) {
  const day = practice ? Math.floor(Math.random() * 1000) : dayIndex();
  if (!practice) {
    const saved = store.get("dg-" + todayKey());
    if (saved) return Object.assign(saved, { practice: false });
  }
  return { key: todayKey(), day, practice, scores: [], details: [] };
}
function save() { if (session && !session.practice) store.set("dg-" + session.key, session); }
const wordGameFor = day => pick(WORD_GAMES, day);

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
  tick();
  return { stop() { stopped = true; }, get left() { return Math.max(0, end - Date.now()) / 1000; } };
}

function screen(title, sub) {
  onKey = null;
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
function nextBtn(parent, label, fn) { const b = h("button", { class: "btn primary big", onclick: fn }, label); parent.append(b); b.focus({ preventScroll: true }); return b; }

// ---------- home ----------
function home() {
  session = null; onKey = null;
  app.innerHTML = ""; app.classList.remove("enter"); void app.offsetWidth; app.classList.add("enter");
  const s = store.get("dg-" + todayKey());
  const done = s && s.scores.length === 5;
  const stats = store.get("dg-stats", { played: 0, best: 0, streak: 0, last: null });
  const day = dayIndex();
  const wg = wordGameFor(day);
  app.append(
    h("div", { class: "hero" },
      h("div", { class: "logo" }, "DAILY", h("span", {}, "GAUNTLET")),
      h("p", { class: "tag" }, "Five categories. One shot a day. 5,000 points on the line."),
      h("p", { class: "date" }, new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))),
    h("ol", { class: "path" }, CATS.map((c, i) => {
      const sc = s && s.scores[i];
      const state = sc != null ? "done" : (s ? s.scores.length : 0) === i ? "next" : "locked";
      return h("li", { class: "step " + state },
        h("span", { class: "num" }, sc != null ? "✓" : i + 1),
        h("span", { class: "ic" }, c.icon),
        h("span", { class: "nm" }, h("b", {}, c.name), h("small", {}, c.id === "word" ? "Today: " + wg.name : c.sub)),
        h("span", { class: "pts" }, sc != null ? fmt(sc) : state === "locked" ? "🔒" : "1,000"));
    })),
    done
      ? h("div", { class: "cta" }, h("p", {}, "You've finished today's Gauntlet: ", h("b", {}, fmt(s.scores.reduce((a, b) => a + b, 0)) + " / 5,000")),
          h("button", { class: "btn primary big", onclick: () => { session = s; results(); } }, "View results"),
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
        h("li", {}, "Same challenge for everyone, new every day at midnight."),
        h("li", {}, "Fixed order: World Rush → History Timeline → Sports IQ → Word Challenge → Think Fast."),
        h("li", {}, "Each category is worth up to 1,000 points. No speed bonuses — accuracy wins."),
        h("li", {}, "Finish a category to unlock the next. No skipping or replays."),
        h("li", {}, "The Word Challenge rotates daily between Word Flip, Word Bridge, Connections 3×3, Odd One Out and Anagram Rush."))),
    h("p", { class: "fine" }, "Beta prototype · scores saved on this device only. Leaderboards, friends and prize pools coming later."));
  const cd = () => {
    const el = $("#countdown"); if (!el) return;
    const n = new Date(), m = new Date(n); m.setHours(24, 0, 0, 0);
    const t = Math.floor((m - n) / 1000);
    el.textContent = (done ? "Next Gauntlet in " : "Resets in ") + [t / 3600, t % 3600 / 60, t % 60].map(x => String(Math.floor(x)).padStart(2, "0")).join(":");
    setTimeout(cd, 1000);
  };
  cd();
}

function finishCat(score, detail) {
  session.scores.push(Math.round(Math.max(0, Math.min(1000, score))));
  session.details.push(detail || "");
  save();
  runNext();
}
function catIntro(i, start) {
  const c = CATS[i];
  const body = screen(c.icon + " " + c.name, i === 3 ? "Today's word game: " + wordGameFor(session.day).name + " — " + wordGameFor(session.day).sub : c.sub);
  body.append(h("div", { class: "intro" }, h("div", { class: "big-ic" }, c.icon), h("p", {}, "Worth up to ", h("b", {}, "1,000 points"), "."), introText(c.id)));
  nextBtn(body, "Start " + (i === 3 ? wordGameFor(session.day).name : c.name), start);
}
function introText(id) {
  const t = {
    world: "Drop a pin as close as you can to two cities (up to 450 pts each — 0 at 4,000 km+), then answer one geography question (100 pts). Tap the map to place your pin; tap again to move it.",
    history: "Drag the picture cards into chronological order, earliest on the left. Round 1: 4 events in 30s (400 pts). Round 2: 5 events in 45s (600 pts). Partial credit for every correctly ordered pair.",
    sports: "Three questions of rising difficulty: 250, 350, then 400 points. All or nothing.",
    word: { flip: "Unscramble 6 medium–hard words using the hint (definition, synonym, antonym or riddle). Tap letters to spell; correct answers auto-advance. First 4 words 150 pts, last 2 worth 200. 60 seconds.",
      bridge: "Find the one word that completes both phrases, e.g. HOT ___ + ___ HOUSE → DOG. First 4 are 150 pts, last 2 are 200. 60 seconds.",
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
  const b = h("b", {}, "0");
  body.append(h("div", { class: "cat-score" }, h("small", {}, "Category score"), b, h("small", {}, "/ 1,000")));
  countUp(b, score);
  nextBtn(body, session.scores.length === 4 ? "See final results" : "Next: " + CATS[session.scores.length + 1].name + " →", () => finishCat(score, detail));
}

// ---------- maps ----------
function leafletMap(el, onPick) {
  const L = window.L;
  const map = L.map(el, { worldCopyJump: false, minZoom: 1, maxZoom: 9, zoomSnap: 0.5, maxBounds: [[-85, -200], [85, 200]], maxBoundsViscosity: 1, attributionControl: true, tap: true });
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    noWrap: true, bounds: [[-85.05, -180], [85.05, 180]], maxZoom: 16,
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors'
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
  const set = pick(C.worldRush, session.day);
  let total = 0, step = 0; const log = [];
  const doPin = () => {
    const target = set.pins[step];
    const body = screen("🌎 World Rush", "Pin " + (step + 1) + " of 2 · up to 450 pts");
    body.append(h("p", { class: "prompt" }, "Where is ", h("b", { class: "hl" }, target.name), "?"),
      h("p", { class: "hint-sm" }, "Tap to drop your pin · pinch or scroll to zoom · drag to pan"));
    const mapEl = h("div", { class: "lmap" });
    body.append(h("div", { class: "map-wrap" }, mapEl));
    let guess = null, locked = false, api;
    const btn = h("button", { class: "btn primary big", disabled: true, onclick: () => submit() }, "📍 Lock in pin");
    body.append(btn);
    const onPick = p => { if (locked) return; guess = p; btn.disabled = false; };
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
      total += pts; log.push(pts);
      feedback(body, pts > 300 ? true : pts > 0 ? null : false, msg);
      step++;
      nextBtn(body, step < 2 ? "Next pin →" : "Geography question →", step < 2 ? doPin : doMC);
    }
  };
  const doMC = () => {
    const body = screen("🌎 World Rush", "Geography question · 100 pts");
    mcQuestion(body, set.mc.q, set.mc.options, set.mc.a, 100, TBD.mc, pts => { total += pts; log.push(pts); catDone(body, total, log.join("/")); });
  };
  doPin();
}
function mcQuestion(body, q, options, answer, value, seconds, done, visual) {
  if (visual) body.append(h("div", { class: "visual" }, visual));
  body.append(h("p", { class: "prompt" }, q));
  let over = false;
  const opts = h("div", { class: "options" }, options.map((o, i) => h("button", { class: "opt", onclick: () => choose(i) }, o)));
  body.append(opts);
  const timer = seconds ? Timer(seconds, () => choose(-1), body.parentNode.querySelector(".game-head")) : null;
  function choose(i) {
    if (over) return; over = true; timer && timer.stop();
    [...opts.children].forEach((b, j) => { b.disabled = true; if (j === answer) b.classList.add("right"); else if (j === i) b.classList.add("wrong"); });
    const ok = i === answer;
    feedback(body, ok, ok ? `Correct! +${value}` : i < 0 ? "Time's up. +0" : "Not quite. +0");
    done(ok ? value : 0);
  }
}

// ---------- 2. History Timeline ----------
function history() {
  const set = pick(C.history, session.day);
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
    body.append(axis, line);
    let locked = false;
    const render = () => {
      line.innerHTML = "";
      order.forEach((ev, pos) => {
        const e = rd.events[ev];
        const card = h("div", { class: "card", "data-pos": pos },
          h("div", { class: "pic" }, e[0]), h("div", { class: "cap" }, e[1]),
          locked ? h("div", { class: "yr" }, e[2] < 0 ? -e[2] + " BC" : e[2]) : null,
          locked ? null : h("div", { class: "arrows" },
            h("button", { class: "mini", "aria-label": "Move earlier", disabled: pos === 0, onclick: ev2 => { ev2.stopPropagation(); move(pos, pos - 1); } }, "◀"),
            h("button", { class: "mini", "aria-label": "Move later", disabled: pos === order.length - 1, onclick: ev2 => { ev2.stopPropagation(); move(pos, pos + 1); } }, "▶")));
        if (!locked) enableDrag(card, pos);
        line.append(card);
      });
    };
    const move = (a, b) => { if (b < 0 || b >= order.length) return; const [x] = order.splice(a, 1); order.splice(b, 0, x); render(); };
    function enableDrag(card, pos) {
      card.addEventListener("pointerdown", e => {
        if (e.target.closest("button")) return;
        e.preventDefault(); card.setPointerCapture(e.pointerId);
        const cards = [...line.children]; const rects = cards.map(c => c.getBoundingClientRect());
        const vertical = rects.length > 1 && Math.abs(rects[1].top - rects[0].top) > Math.abs(rects[1].left - rects[0].left);
        const start = vertical ? e.clientY : e.clientX;
        card.classList.add("dragging");
        const mv = ev => { const d = (vertical ? ev.clientY : ev.clientX) - start; card.style.transform = vertical ? `translateY(${d}px)` : `translateX(${d}px)`; };
        const up = ev => {
          card.removeEventListener("pointermove", mv); card.removeEventListener("pointerup", up); card.removeEventListener("pointercancel", up);
          const c = vertical ? ev.clientY : ev.clientX;
          let target = 0;
          rects.forEach((rc, i) => { const mid = vertical ? rc.top + rc.height / 2 : rc.left + rc.width / 2; if (c > mid) target = i; });
          if (c < (vertical ? rects[0].top + rects[0].height / 2 : rects[0].left + rects[0].width / 2)) target = 0;
          move(pos, target); if (target === pos) render();
        };
        card.addEventListener("pointermove", mv); card.addEventListener("pointerup", up); card.addEventListener("pointercancel", up);
      });
    }
    render();
    const btn = h("button", { class: "btn primary big", onclick: () => submit() }, "Lock in order");
    body.append(btn);
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
      total += pts; log.push(pts); r++;
      if (r < 2) nextBtn(body, "Round 2 →", play); else catDone(body, total, log.join("/"));
    }
  };
  play();
}

// ---------- 3. Sports IQ ----------
function sports() {
  const qs = pick(C.sports, session.day), vals = [250, 350, 400], labels = ["Easy", "Medium", "Hard"];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], body = screen("🏆 Sports IQ", `Question ${i + 1} of 3 · ${labels[i]} · ${vals[i]} pts`);
    const after = pts => { total += pts; log.push(pts); i++; if (i < 3) nextBtn(body, "Next question →", ask); else catDone(body, total, log.join("/")); };
    if (q.type === "mc") mcQuestion(body, q.q, q.options, q.a, vals[i], 0, after, q.visual);
    else textQuestion(body, q.q, q.answers, vals[i], 0, after, q.visual, q.answers[0]);
  };
  ask();
}
function textQuestion(body, q, answers, value, seconds, done, visual, display, explain) {
  if (visual) body.append(h("div", { class: "visual" }, visual));
  body.append(h("p", { class: "prompt" }, q));
  let over = false;
  const input = h("input", { class: "txt", placeholder: "Type your answer", autocomplete: "off", autocapitalize: "off", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); if (input.value.trim()) submit(input.value); } }, input, h("button", { class: "btn primary", type: "submit" }, "Lock in"));
  body.append(form); setTimeout(() => input.focus(), 50);
  const timer = seconds ? Timer(seconds, () => submit(input.value), body.parentNode.querySelector(".game-head")) : null;
  function submit(v) {
    if (over) return; over = true; timer && timer.stop(); input.disabled = true; form.querySelector("button").remove();
    const ok = answers.some(a => norm(a) === norm(v || ""));
    feedback(body, ok, (ok ? `Correct! +${value}` : `Answer: ${display.replace(/\b\w/g, c => c.toUpperCase())}. +0`) + (explain ? " — " + explain : ""));
    done(ok ? value : 0);
  }
}

// ---------- 4. Word Challenge ----------
function wordChallenge() { ({ flip: wordFlip, bridge: wordBridge, conn: connections, odd: oddOneOut, anag: anagramRush })[wordGameFor(session.day).id](); }

function wordFlip() {
  const list = pick(C.wordFlip, session.day), R = rng(session.day);
  const body = screen("📝 Word Flip", "6 words · 60 seconds");
  let i = 0, total = 0, over = false, built = [];
  const hintEl = h("div", { class: "hint" }), slots = h("div", { class: "slots" }), tiles = h("div", { class: "tiles" }), prog = h("div", { class: "prog" });
  const ctrls = h("div", { class: "row" }, h("button", { class: "btn", onclick: () => { built.pop(); draw(); } }, "↩ Undo"), h("button", { class: "btn", onclick: () => { built = []; draw(); } }, "Clear"), h("button", { class: "btn", onclick: () => { results.push(false); advance(); } }, "Skip →"));
  const results = [];
  body.append(prog, hintEl, slots, tiles, ctrls);
  let letters = [];
  const val = k => k < 4 ? 150 : 200;
  const load = () => {
    const [w] = list[i];
    do letters = shuffle(w.split("").map((c, k) => ({ c, k })), R); while (letters.map(l => l.c).join("") === w);
    built = []; draw();
  };
  const draw = () => {
    const [w, style, hint] = list[i];
    prog.textContent = `Word ${i + 1}/6 · ${val(i)} pts · Score ${total}`;
    hintEl.innerHTML = ""; hintEl.append(h("span", { class: "badge" }, style), " ", hint);
    slots.innerHTML = ""; w.split("").forEach((_, k) => slots.append(h("span", { class: "slot" + (built[k] != null ? " on" : "") }, built[k] != null ? letters[built[k]].c : "")));
    tiles.innerHTML = ""; letters.forEach((l, k) => tiles.append(h("button", { class: "tile", disabled: built.includes(k), onclick: () => { built.push(k); draw(); check(); } }, l.c)));
  };
  const check = () => {
    const w = list[i][0];
    if (built.length < w.length) return;
    if (built.map(k => letters[k].c).join("") === w) { total += val(i); results.push(true); slots.classList.add("win"); setTimeout(() => { slots.classList.remove("win"); advance(); }, 350); }
    else { slots.classList.add("shake"); setTimeout(() => { slots.classList.remove("shake"); built = []; draw(); }, 400); }
  };
  const advance = () => { if (over) return; i++; if (i >= 6) end(); else load(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); ctrls.remove(); tiles.remove(); slots.remove(); hintEl.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([w], k) => h("li", { class: results[k] ? "ok" : "no" }, (results[k] ? "✓ " : "✗ ") + w))));
    catDone(body, total, "flip");
  };
  onKey = e => {
    if (over) return false;
    if (e.key === "Backspace") { built.pop(); draw(); return; }
    if (/^[a-z]$/i.test(e.key)) { const k = letters.findIndex((l, idx) => l.c === e.key.toUpperCase() && !built.includes(idx)); if (k >= 0) { built.push(k); draw(); check(); } return; }
    return false;
  };
  body.append(h("p", { class: "kbd-tip" }, "⌨️ Type letters on your keyboard · Backspace to undo"));
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  load();
}

function wordBridge() {
  const list = pick(C.wordBridge, session.day);
  const body = screen("📝 Word Bridge", "6 puzzles · 60 seconds");
  let i = 0, total = 0, over = false; const res = [];
  const val = k => k < 4 ? 150 : 200;
  const prog = h("div", { class: "prog" }), puzzle = h("div", { class: "bridge" });
  const input = h("input", { class: "txt", placeholder: "Missing word", autocomplete: "off", autocapitalize: "characters", spellcheck: "false" });
  const form = h("form", { class: "answer", onsubmit: e => { e.preventDefault(); guess(); } }, input, h("button", { class: "btn primary", type: "submit" }, "Submit"), h("button", { class: "btn", type: "button", onclick: () => { res.push(false); adv(); } }, "Skip"));
  body.append(prog, puzzle, form);
  const draw = () => { const [a, b] = list[i]; prog.textContent = `Puzzle ${i + 1}/6 · ${val(i)} pts · Score ${total}`; puzzle.innerHTML = ""; puzzle.append(h("span", {}, a), h("span", { class: "gap" }, "?"), h("span", {}, b)); input.value = ""; input.focus(); };
  const guess = () => {
    const v = norm(input.value).toUpperCase().replace(/ /g, ""); if (!v) return;
    if (v === list[i][2]) { total += val(i); res.push(true); puzzle.classList.add("win"); setTimeout(() => { puzzle.classList.remove("win"); adv(); }, 300); }
    else { form.classList.add("shake"); setTimeout(() => form.classList.remove("shake"), 400); input.select(); }
  };
  const adv = () => { if (over) return; i++; if (i >= 6) end(); else draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); form.remove(); puzzle.remove(); prog.remove();
    body.append(h("ul", { class: "review" }, list.map(([a, b, w], k) => h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : "✗"} ${a} ${w} · ${w} ${b}`))));
    catDone(body, total, "bridge");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function connections() {
  const set = pick(C.connections, session.day);
  const body = screen("📝 Connections 3×3", "Find 3 groups of 3 · 90 seconds");
  let words = shuffle(set.groups.flatMap(g => g.words), rng(session.day)), sel = [], found = [], mistakes = 0, total = 0, over = false;
  const solved = h("div", { class: "solved" }), grid = h("div", { class: "grid3" }), info = h("div", { class: "prog" });
  const ctrls = h("div", { class: "row" },
    h("button", { class: "btn", onclick: () => { words = shuffle(words); draw(); } }, "Shuffle"),
    h("button", { class: "btn", onclick: () => { sel = []; draw(); } }, "Deselect"),
    h("button", { class: "btn primary", id: "csub", onclick: () => submit() }, "Submit"));
  body.append(info, solved, grid, ctrls);
  const draw = () => {
    info.innerHTML = ""; info.append(`Score ${total} · Mistakes left: `, h("b", {}, "●".repeat(3 - mistakes) + "○".repeat(mistakes)));
    solved.innerHTML = ""; found.forEach(g => solved.append(h("div", { class: "group g" + set.groups.indexOf(g) }, h("b", {}, g.name + " · " + g.pts), h("span", {}, g.words.join(", ")))));
    grid.innerHTML = ""; words.forEach(w => grid.append(h("button", { class: "wtile" + (sel.includes(w) ? " sel" : ""), onclick: () => { if (sel.includes(w)) sel = sel.filter(x => x !== w); else if (sel.length < 3) sel.push(w); draw(); } }, w)));
    const cs = $("#csub"); if (cs) cs.disabled = sel.length !== 3;
  };
  const submit = () => {
    const g = set.groups.find(g => g.words.every(w => sel.includes(w)));
    if (g) { found.push(g); total += g.pts; words = words.filter(w => !g.words.includes(w)); sel = []; if (found.length === 3) return end(); }
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
  const list = pick(C.oddOneOut, session.day);
  const body = screen("📝 Odd One Out", "8 puzzles · 60 seconds");
  let i = 0, total = 0, over = false; const res = [];
  const val = k => k < 4 ? 100 : 150;
  const prog = h("div", { class: "prog" }), opts = h("div", { class: "options two" });
  body.append(prog, h("p", { class: "prompt" }, "Which one doesn't belong?"), opts);
  const draw = () => {
    prog.textContent = `Puzzle ${i + 1}/8 · ${i < 4 ? "Medium" : "Hard"} · ${val(i)} pts · Score ${total}`;
    opts.innerHTML = ""; list[i].words.forEach((w, k) => opts.append(h("button", { class: "opt", onclick: () => pickIt(k) }, w)));
  };
  const pickIt = k => { if (over) return; const ok = k === list[i].odd; res.push(ok); if (ok) total += val(i); i++; if (i >= 8) end(); else draw(); };
  const end = () => {
    if (over) return; over = true; timer.stop(); opts.remove(); prog.remove(); body.querySelector(".prompt").remove();
    body.append(h("ul", { class: "review" }, list.map((p, k) => h("li", { class: res[k] ? "ok" : "no" }, `${res[k] ? "✓" : res[k] === false ? "✗" : "–"} ${p.words.join(" · ")} — ${p.why}`))));
    catDone(body, total, "odd");
  };
  const timer = Timer(60, end, body.parentNode.querySelector(".game-head"));
  draw();
}

function anagramRush() {
  const set = pick(window.ANAGRAM_SETS, session.day);
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
    else if (valid.has(w)) { found.unshift(w); raw += PTS[w.length]; flash("+" + PTS[w.length], true); }
    else flash("Not a word", false);
    draw();
  };
  const end = () => {
    if (over) return; over = true; timer.stop(); tiles.remove(); ctrls.remove(); form.remove(); cur.remove();
    const missed = set.common.filter(w => !found.includes(w));
    body.append(h("p", { class: "muted" }, "Missed words: " + (missed.length ? missed.map(w => w.toUpperCase()).join(", ") : "none — wow!")));
    const conv = Math.min(1000, Math.round(raw / target * 1000));
    body.append(h("div", { class: "cat-score" }, h("small", {}, "Your Anagram Rush score"), h("b", {}, fmt(raw)), h("small", {}, "points")));
    nextBtn(body, "Next: Think Fast →", () => finishCat(conv, "anag raw " + raw));
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
  const qs = pick(C.thinkFast, session.day), vals = [400, 600];
  let total = 0, i = 0; const log = [];
  const ask = () => {
    const q = qs[i], body = screen("🧠 Think Fast", `Puzzle ${i + 1} of 2 · ${vals[i]} pts · one submission`);
    textQuestion(body, q.q, q.answers, vals[i], TBD.think, pts => { total += pts; log.push(pts); i++; if (i < 2) nextBtn(body, "Final puzzle →", ask); else catDone(body, total, log.join("/")); }, null, q.answers[0], q.explain);
  };
  ask();
}

// ---------- results ----------
function results() {
  const tot = session.scores.reduce((a, b) => a + b, 0);
  if (!session.practice && !session.counted) {
    session.counted = true; save();
    const st = store.get("dg-stats", { played: 0, best: 0, streak: 0, last: null });
    const y = new Date(); y.setDate(y.getDate() - 1);
    st.streak = st.last === todayKey(y) ? st.streak + 1 : 1; st.last = session.key; st.played++; st.best = Math.max(st.best, tot);
    store.set("dg-stats", st);
  }
  app.innerHTML = "";
  const blocks = s => s >= 900 ? "🟩" : s >= 600 ? "🟨" : s >= 300 ? "🟧" : "🟥";
  const share = `Daily Gauntlet ${session.practice ? "(practice)" : session.key}\n${session.scores.map((s, i) => CATS[i].icon + " " + blocks(s) + " " + s).join("\n")}\n🏁 ${tot.toLocaleString()} / 5,000`;
  app.append(
    h("div", { class: "hero small" }, h("div", { class: "logo" }, "DAILY", h("span", {}, "GAUNTLET")), h("p", { class: "tag" }, session.practice ? "Practice run complete" : "Today's Gauntlet complete")),
    h("div", { class: "final" }, h("small", {}, "Final score"), h("b", { id: "finalnum" }, "0"), h("small", {}, "/ 5,000")),
    h("ol", { class: "path" }, CATS.map((c, i) => h("li", { class: "step done" }, h("span", { class: "num" }, blocks(session.scores[i])), h("span", { class: "ic" }, c.icon), h("span", { class: "nm" }, h("b", {}, c.name), c.id === "word" ? h("small", {}, wordGameFor(session.day).name) : null), h("span", { class: "pts" }, fmt(session.scores[i]))))),
    h("pre", { class: "share" }, share),
    h("div", { class: "row center" },
      h("button", { class: "btn primary", onclick: async e => { try { if (navigator.share) await navigator.share({ text: share }); else { await navigator.clipboard.writeText(share); e.target.textContent = "Copied!"; } } catch {} } }, "Share result"),
      h("button", { class: "btn", onclick: home }, "Home")),
    h("p", { class: "fine" }, "Global & friends leaderboards arrive with accounts in a future version."));
  countUp($("#finalnum"), tot, 1600);
  setTimeout(() => { const r = $("#finalnum").getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40); }, 1600);
}

document.addEventListener("click", e => { if (e.target.closest(".brand")) { if (!session || confirm("Leave this game? Progress in the current category is lost.")) home(); } });
home();
})();
