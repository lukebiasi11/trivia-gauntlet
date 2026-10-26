/* Daily Gauntlet — lenient typed-answer checking (shared by app.js and tools/answers.test.js).
   checkAnswer(input, answers, { aliases, wrong }) -> true/false
   - answers : accepted spellings from content.js (unchanged format)
   - aliases : OPTIONAL extra accepted spellings (nicknames, abbreviations, other languages)
   - wrong   : OPTIONAL known wrong answers / MC options; typo tolerance never lands on these */
(function (root) {
  "use strict";
  const ARTICLE = /^(the|a|an) /;
  const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1e6, half: 0.5, dozen: 12 };
  // First-name nicknames -> canonical name (applied to the FIRST word only).
  const NICK = { mike: "michael", mick: "michael", bill: "william", will: "william", billy: "william", bob: "robert", rob: "robert", bobby: "robert", bert: "robert",
    tom: "thomas", tommy: "thomas", jim: "james", jimmy: "james", joe: "joseph", joey: "joseph", dave: "david", dan: "daniel", danny: "daniel",
    chris: "christopher", matt: "matthew", nick: "nicholas", tony: "anthony", steve: "steven", stephen: "steven", rick: "richard", dick: "richard",
    rich: "richard", ed: "edward", eddie: "edward", ted: "edward", ken: "kenneth", larry: "lawrence", pete: "peter", sam: "samuel", ben: "benjamin",
    alex: "alexander", andy: "andrew", drew: "andrew", greg: "gregory", jeff: "jeffrey", jon: "jonathan", tim: "timothy", charlie: "charles", chuck: "charles",
    hank: "henry", harry: "henry", jack: "john", johnny: "john", fred: "frederick", liz: "elizabeth", beth: "elizabeth", kate: "katherine", katie: "katherine",
    jen: "jennifer", jenny: "jennifer", sue: "susan", patty: "patricia", pat: "patrick", peggy: "margaret", maggie: "margaret", meg: "margaret", abby: "abigail" };

  // Surnames too ambiguous to accept on their own, even if content lists them.
  const AMBIGUOUS_SURNAMES = new Set(["ronaldo", "james", "bonds", "payton", "schumacher", "gore", "ali",
    "williams", "johnson", "smith", "jones", "brown", "davis", "jackson", "manning", "griffey", "ripken", "watt", "harrison", "curry"]);
  // First words that signal a place/team, not a person ("New York" must not accept "york").
  const NOT_A_FIRST_NAME = new Set(["new", "san", "los", "las", "st", "saint", "fort", "north", "south", "east", "west", "united", "real", "el", "la", "le", "de", "port", "mount", "lake", "great", "old", "upper", "lower", "central", "golden", "green", "red", "blue", "white", "black", "kansas", "tampa", "green", "dallas", "boston", "chicago", "miami", "denver", "houston", "seattle", "atlanta", "detroit"]);
  function norm(s) {
    return String(s == null ? "" : s).replace(/(\d),(?=\d{3}\b)/g, "$1").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/&/g, " and ").replace(/['’`]/g, "")
      .replace(/[^a-z0-9$.%/ ]+/g, " ")           // keep $ . % / for numbers and fractions
      .replace(/(^|\s)\.(?!\d)|\.(?=\s|$)/g, " ")   // drop sentence dots, keep ".05"
      .replace(/\s+/g, " ").trim().replace(ARTICLE, "");
  }
  // Returns a number, a fraction string like "2/15", or null.
  function parseNum(raw) {
    let s = norm(raw).replace(/,/g, "");
    let m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) return m[1] + "/" + m[2];                // fractions compared exactly (2/15 never becomes 215)
    let scale = 1;
    if (/(\d|\b(?!per)[a-z]+) ?(cents?|c|¢)$/.test(s) && !/percent$/.test(s)) { scale = 0.01; s = s.replace(/ ?(cents?|c|¢)$/, ""); }
    s = s.replace(/ ?(percent|per cent|%)$/, "").replace(/ ?(dollars?|bucks|usd)$/, "").replace(/^\$ ?/, "").trim();
    if (/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return +s * scale;
    const w = s.replace(/-/g, " ").replace(/ and /g, " ").split(" ").filter(Boolean);
    if (!w.length || !w.every(x => x in SMALL)) return null;
    let total = 0, cur = 0;
    for (const x of w) { const v = SMALL[x]; if (v === 100) cur = (cur || 1) * 100; else if (v >= 1000) { total += (cur || 1) * v; cur = 0; } else cur += v; }
    return (total + cur) * scale;
  }
  const numEq = (a, b) => typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : a === b;
  // Optimal-string-alignment Damerau–Levenshtein.
  function dl(a, b) {
    const d = [];
    for (let i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  const allowed = len => len <= 3 ? 0 : len <= 7 ? 1 : 2;
  const canonName = s => { const w = s.split(" "); if (w.length > 1 && NICK[w[0]]) w[0] = NICK[w[0]]; return w.join(" "); };
  const isNumeric = s => parseNum(s) !== null || /\d/.test(s);

  function checkAnswer(input, answers, opts) {
    opts = opts || {};
    const good = [].concat(answers || [], opts.aliases || []).filter(x => x != null && String(x).trim());
    const v = norm(input); if (!v) return false;
    const goodN = good.map(norm);
    // An ambiguous surname alone is rejected whenever a full name ending in it is listed (even if the bare surname is listed too).
    if (AMBIGUOUS_SURNAMES.has(v) && goodN.some(g => g.includes(" ") && g.split(" ").pop() === v)) return false;
    if (goodN.includes(v)) return true;
    // Numbers: compare by value; never typo-tolerant.
    const vn = parseNum(input);
    if (vn !== null) return good.some(g => { const gn = parseNum(g); return gn !== null && numEq(gn, vn); });
    if (good.some(isNumeric) && /\d/.test(v)) return false;
    // Names: nickname on the first word ("Mike Jordan" = "Michael Jordan").
    const vc = canonName(v), goodC = goodN.map(canonName);
    if (goodC.includes(vc)) return true;
    // Last name alone for person-like answers ("Barry Bonds" -> "bonds"), unless ambiguous or the question opts out.
    if (!opts.noSurname) goodN.forEach(g => {
      const w = g.split(" ");
      if (w.length >= 2 && w.length <= 3 && w.every(x => /^[a-z]+$/.test(x)) && !NOT_A_FIRST_NAME.has(w[0])) {
        const last = w[w.length - 1];
        if (last.length >= 3 && !AMBIGUOUS_SURNAMES.has(last) && !goodC.includes(last)) goodC.push(last);
      }
    });
    // Typos, scaled by length; only for non-numeric answers, and never toward a listed wrong answer.
    const wrongC = [].concat(opts.wrong || []).map(norm).filter(w => w && !goodN.includes(w)).map(canonName);
    const vs = vc.replace(/ /g, "");
    let best = Infinity, ok = false;
    goodC.forEach(g => {
      if (isNumeric(g)) return;
      const gs = g.replace(/ /g, ""), dist = dl(vs, gs);
      if (dist <= allowed(gs.length)) { ok = true; best = Math.min(best, dist); }
    });
    if (!ok) return false;
    return !wrongC.some(w => dl(vs, w.replace(/ /g, "")) <= best);
  }
  const api = { checkAnswer, norm, parseNum, dl, NICK, AMBIGUOUS_SURNAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.Answers = api;
})(typeof window !== "undefined" ? window : globalThis);
