# Daily Gauntlet — Locked-in Spec (working name)

Source of truth: friend's ChatGPT conversation "Daily Brain Game Idea" (share 6adbd39f…).
Mixed in from Luke's "Start Invention Development" conversation (share 6adbdbc8…) only where compatible.

## Format
- One daily challenge, same content for everyone, **5 categories × 1,000 pts = 5,000 max**.
- **Fixed order every day:** 1 World Rush → 2 History Timeline → 3 Sports IQ → 4 Word Challenge → 5 Think Fast.
- Only the current category is playable; finishing it unlocks the next. No skipping, reordering, or replaying for points.
- No speed bonuses anywhere.

## 1. World Rush (geography) — 1,000
- 2 map-pin challenges (450 each) + 1 multiple-choice geography question (100).
- Pin points = round(450 × max(0, 1 − d/4000)), d = great-circle km.
- Time limits: **not finalized**.

## 2. History Timeline — 1,000
- 2 rounds of picture cards dragged onto a timeline in chronological order.
- Round 1: 4 events, 30 s, 400 pts. Round 2: 5 events, 45 s, 600 pts.
- Partial credit by correctly ordered pairs (6 pairs / 10 pairs). Auto-submit at time-out, then reveal correct order + dates.

## 3. Sports IQ — 1,000
- 3 questions of rising difficulty: Easy 250, Medium 350, Hard 400.
- Formats: multiple choice, athlete silhouette, team logo, fill-in-the-blank. No partial credit.

## 4. Word Challenge — 1,000 (one game per day, rotating among 5)
- **Word Flip:** 60 s, 6 medium/hard scrambled words, tap letters, hint style varies (definition/synonym/antonym/riddle); undo/skip; 4×150 + 2×200.
- **Word Bridge:** 60 s, 6 puzzles (HOT ___ / ___ HOUSE → DOG); type or skip; 4×150 + 2×200.
- **Connections 3×3:** 90 s, 9 words → 3 groups of 3; 3 wrong submissions end the round; shuffle/deselect; 300 + 300 + 400.
- **Odd One Out:** 60 s, 8 puzzles (4 medium @100, 4 hard @150), pick the word that doesn't fit, one tap advances, connections revealed after.
- **Anagram Rush:** 60 s, one set of 6 letters, unlimited guesses, 3–6 letter words: 10/25/50/100; no penalties/duplicates; shows missed words. Player sees only raw points; conversion to /1000 happens behind the scenes (**formula not finalized**).

## 5. Think Fast (logic/reasoning) — 1,000
- 2 hard puzzles: 400 + 600. One final submission each. Typed answers/numbers (riddles, deduction, sequences, estimation, visual).
- Time limit: **not finalized**.

## From Luke's brainstorm (compatible additions)
- Daily challenge unlocks at midnight; anytime practice mode separate from the ranked daily.
- Leaderboards / friends / head-to-head, paid buy-ins and prize pools: planned for later (need backend + legal review) — not in this static beta.

## Daily reset
- One reset for every player: **midnight US Eastern** (`RESET_TIMEZONE = "America/New_York"` at the top of app.js, DST-aware).
- The day key (`YYYY-MM-DD`) is the New York calendar date, computed with `Intl.DateTimeFormat("en-US", { timeZone: "America/New_York" })`. The same day number seeds the content rotation and shuffles, the "Gauntlet #N" game number (counted from `LAUNCH_DATE`), and streaks.
- The home countdown runs to the next New York midnight. It is correct on DST change days (23 h or 25 h days).
- A run is credited to the day it **started**: finishing after midnight doesn't break the streak.
- If the page is closed or reloaded mid-category, that category is locked in at the points earned so far (no replays).
- Anti-clock-tamper (best effort, client-only):
  - The highest day the device has reached is stored (`dg-maxday`). Turning the clock back never serves an earlier day than that.
  - On load, the site sends one HEAD request to itself and reads the HTTP `Date` header. If the device clock is more than 10 minutes ahead, server time is used (and a future `dg-maxday` is pulled back). This fails silently when offline.
  - This is not secure: all content ships in content.js, so a determined player can read future days.

## Future work: server-released questions (not built)
- Luke wants a backend that releases each day's questions to everyone at once (e.g. 12 PM ET) for anti-cheat.
- All content lookup already goes through a single function, `getDailySet(dayKey)` in app.js. Later it can be swapped for a `fetch("/api/daily/" + dayKey)` (made async), with content.js removed from the public site.

## Content selection rules (app.js)
- Word Challenge format rotates daily (5 formats). Each format's list is indexed by `floor(day / 5)`, so any list length works.
- Multiple-choice options and Odd One Out word positions are shuffled with a deterministic seed (day key + question), so everyone sees the same order on a given day. Write `a`/`odd` against the order in content.js; the app keeps the mapping.
- Text answers are compared after lowercasing and stripping punctuation, except `$ . /` (so "2/15" stays "2/15").
