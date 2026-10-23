/* =====================================================================
   DAILY GAUNTLET — QUESTION FILE  (this is the only file you need to edit
   to change questions. Edit it in GitHub, click "Commit", done.)
   ---------------------------------------------------------------------
   HOW DAYS WORK: each section below is a LIST of days, written [ day, day, ... ].
   The site rotates through the list one day at a time and starts over
   at the end. To add a new day, copy one whole day block (from its
   opening { or [ to its matching } or ]), paste it after the last one, put
   a comma between them, and change the text.

   GOLDEN RULES (most mistakes come from these):
     • Text goes inside "double quotes". Need a quote inside? Write \"
     • Items are separated by commas. No comma after the LAST item is fine.
     • Multiple-choice "a" is the POSITION of the right answer, counting
       from 0:  options: ["Japan", "South Korea", "Taiwan"], a: 1  → South Korea
     • Typed answers: list every spelling you'll accept in "answers".
       Capitals and punctuation are ignored ("Tom Brady" = "tom brady").
     • After editing, open the site — if it shows a blank page, a comma or
       quote is missing. Undo your last change in GitHub and try again.

   SECTIONS (in game order):
     worldRush   – 2 map pins (name + lat/lon from Google Maps) + 1 multiple choice
     history     – r1 = 4 events, r2 = 5 events: ["emoji", "Event name", year]
                   (use a negative year for BC, e.g. -44 = 44 BC)
     sports      – 3 questions: easy (250), medium (350), hard (400)
                   type "mc" = multiple choice, type "text" = typed answer
     wordFlip    – 6 words: ["ANSWER", "hint type", "hint text"]  (CAPITALS)
     wordBridge  – 6 puzzles: ["FIRST", "SECOND", "ANSWER"]  → FIRST+ANSWER, ANSWER+SECOND
     connections – 3 groups of 3 words, worth 300 / 300 / 400
     oddOneOut   – 8 puzzles: 4 words, odd = position (from 0) of the odd one, why = explanation
     thinkFast   – 2 puzzles (400 + 600), typed answers
   Anagram Rush letter sets live in anagrams.js (generated from a dictionary).
   Scoring rules live in app.js — no need to touch it for content.
   ===================================================================== */
window.CONTENT = {
  // ---------- 1. WORLD RUSH ----------
  worldRush: [
    { pins: [{ name: "Cairo, Egypt", lat: 30.04, lon: 31.24 }, { name: "Lima, Peru", lat: -12.05, lon: -77.04 }],
      mc: { q: "Which country's flag is this? 🇰🇷", options: ["Japan", "South Korea", "Taiwan", "Vietnam"], a: 1 } },
    { pins: [{ name: "Reykjavík, Iceland", lat: 64.15, lon: -21.94 }, { name: "Perth, Australia", lat: -31.95, lon: 115.86 }],
      mc: { q: "What is the capital of Canada?", options: ["Toronto", "Vancouver", "Ottawa", "Montreal"], a: 2 } },
    { pins: [{ name: "Nairobi, Kenya", lat: -1.29, lon: 36.82 }, { name: "Anchorage, Alaska", lat: 61.22, lon: -149.9 }],
      mc: { q: "Which country has this flag? 🇳🇬", options: ["Nigeria", "Ireland", "Italy", "Mexico"], a: 0 } },
    { pins: [{ name: "Mumbai, India", lat: 19.08, lon: 72.88 }, { name: "Buenos Aires, Argentina", lat: -34.6, lon: -58.38 }],
      mc: { q: "Which river flows through Baghdad?", options: ["Nile", "Euphrates", "Tigris", "Jordan"], a: 2 } },
    { pins: [{ name: "Istanbul, Türkiye", lat: 41.01, lon: 28.98 }, { name: "Honolulu, Hawaii", lat: 21.31, lon: -157.86 }],
      mc: { q: "Which is the largest country in Africa by area?", options: ["Nigeria", "Algeria", "Egypt", "DR Congo"], a: 1 } },
    { pins: [{ name: "Bangkok, Thailand", lat: 13.76, lon: 100.5 }, { name: "Cape Town, South Africa", lat: -33.92, lon: 18.42 }],
      mc: { q: "Which flag is Brazil's?", options: ["🇵🇹", "🇧🇷", "🇨🇴", "🇦🇷"], a: 1 } },
    { pins: [{ name: "Moscow, Russia", lat: 55.76, lon: 37.62 }, { name: "Mexico City, Mexico", lat: 19.43, lon: -99.13 }],
      mc: { q: "Mount Kilimanjaro is in which country?", options: ["Kenya", "Uganda", "Tanzania", "Ethiopia"], a: 2 } }
  ],
  // ---------- 2. HISTORY TIMELINE ----------
  history: [
    { r1: { theme: "Inventions", events: [["📞", "Telephone patented", 1876], ["💡", "Edison's light bulb", 1879], ["✈️", "Wright brothers' first flight", 1903], ["📺", "First TV demonstration", 1926]] },
      r2: { theme: "World history", events: [["🐀", "Black Death reaches Europe", 1347], ["⛵", "Columbus reaches the Americas", 1492], ["🇺🇸", "Declaration of Independence", 1776], ["🗼", "Eiffel Tower completed", 1889], ["🌕", "Apollo 11 Moon landing", 1969]] } },
    { r1: { theme: "Brands", events: [["🥤", "Coca-Cola invented", 1886], ["🍔", "McDonald's founded", 1940], ["🍎", "Apple founded", 1976], ["🔎", "Google founded", 1998]] },
      r2: { theme: "Wars & revolutions", events: [["⚔️", "Battle of Hastings", 1066], ["📜", "Magna Carta signed", 1215], ["🔫", "American Revolution begins", 1775], ["🥖", "Storming of the Bastille", 1789], ["🎖️", "World War I begins", 1914]] } },
    { r1: { theme: "Technology", events: [["🖨️", "Gutenberg printing press", 1440], ["🚂", "First steam locomotive", 1804], ["📻", "First radio transmission", 1895], ["💻", "World Wide Web invented", 1989]] },
      r2: { theme: "Science", events: [["🔭", "Galileo's telescope", 1609], ["🍏", "Newton's Principia", 1687], ["🧬", "Darwin's Origin of Species", 1859], ["☢️", "Curie discovers radium", 1898], ["🧪", "Penicillin discovered", 1928]] } },
    { r1: { theme: "Sports history", events: [["🏛️", "First modern Olympics", 1896], ["⚽", "First FIFA World Cup", 1930], ["🏈", "First Super Bowl", 1967], ["🏀", "Michael Jordan's first title", 1991]] },
      r2: { theme: "Ancient & medieval", events: [["🔺", "Great Pyramid of Giza built", -2560], ["🏛️", "Founding of Rome (legend)", -753], ["🗡️", "Julius Caesar assassinated", -44], ["🏰", "Fall of Western Rome", 476], ["🧭", "Marco Polo reaches China", 1275]] } },
    { r1: { theme: "Entertainment", events: [["🎬", "First Academy Awards", 1929], ["🐭", "Mickey Mouse debuts", 1928], ["🎸", "The Beatles' first album", 1963], ["🎮", "Nintendo Entertainment System (US)", 1985]] },
      r2: { theme: "Modern history", events: [["🚢", "Titanic sinks", 1912], ["💥", "Pearl Harbor attack", 1941], ["🧱", "Berlin Wall built", 1961], ["🧱", "Berlin Wall falls", 1989], ["📱", "First iPhone released", 2007]] } }
  ],
  // ---------- 3. SPORTS IQ ----------
  sports: [
    [ { type: "mc", visual: "🏈", q: "Which team won Super Bowl LVIII (Feb 2024)?", options: ["San Francisco 49ers", "Kansas City Chiefs", "Philadelphia Eagles", "Buffalo Bills"], a: 1 },
      { type: "text", visual: "🏀👤", q: "Silhouette clue: NBA, 6'9\", nicknamed \"King James\", 4 titles with 3 franchises. Who is it?", answers: ["lebron", "lebron james", "james"] },
      { type: "text", visual: "⚾", q: "Who holds MLB's career home run record (762)?", answers: ["barry bonds", "bonds"] } ],
    [ { type: "mc", visual: "⚽", q: "Which country won the 2022 FIFA World Cup?", options: ["France", "Brazil", "Argentina", "Croatia"], a: 2 },
      { type: "text", visual: "🛡️❓", q: "Logo clue: NFL team, star on the helmet, plays in Arlington, TX.", answers: ["dallas cowboys", "cowboys", "dallas"] },
      { type: "text", visual: "🎾", q: "Which man has won the most Grand Slam singles titles (24)?", answers: ["novak djokovic", "djokovic"] } ],
    [ { type: "mc", visual: "🏒", q: "How many players does each NHL team have on the ice (incl. goalie) at even strength?", options: ["5", "6", "7", "11"], a: 1 },
      { type: "text", visual: "⛳👤", q: "Silhouette clue: golfer famous for the red Sunday shirt, 15 majors.", answers: ["tiger woods", "tiger", "woods"] },
      { type: "text", visual: "🏀", q: "Fill in the blank: Wilt Chamberlain scored ___ points in a single NBA game in 1962.", answers: ["100", "one hundred"] } ],
    [ { type: "mc", visual: "🏀", q: "Which franchise has Michael Jordan's six NBA titles?", options: ["Lakers", "Celtics", "Bulls", "Pistons"], a: 2 },
      { type: "text", visual: "🛡️❓", q: "Logo clue: MLB team with interlocking 'NY', 27 World Series titles.", answers: ["new york yankees", "yankees"] },
      { type: "text", visual: "🏈", q: "Which QB has the most Super Bowl wins (7)?", answers: ["tom brady", "brady"] } ],
    [ { type: "mc", visual: "🏃", q: "Who holds the men's 100m world record (9.58s)?", options: ["Carl Lewis", "Usain Bolt", "Tyson Gay", "Yohan Blake"], a: 1 },
      { type: "text", visual: "⚽👤", q: "Silhouette clue: Portuguese forward, 'SIUUU' celebration, played for Man United, Real Madrid, Juventus.", answers: ["cristiano ronaldo", "ronaldo", "cr7"] },
      { type: "text", visual: "🏊", q: "Which swimmer has won the most Olympic gold medals (23)?", answers: ["michael phelps", "phelps"] } ]
  ],
  // ---------- 4. WORD CHALLENGE (one game per day, rotating) ----------
  // Word Flip hint types: "definition", "synonym", "antonym", "riddle"
  wordFlip: [
    [ ["CASTLE", "definition", "A large fortified building with towers"], ["BRIGHT", "synonym", "Vivid, luminous"], ["SILENT", "antonym", "Opposite of noisy"], ["GARDEN", "riddle", "I have beds but no one sleeps in me"], ["JOURNEY", "definition", "Traveling from one place to another"], ["FORTUNE", "synonym", "Wealth, luck"] ],
    [ ["PLANET", "definition", "A large body orbiting a star"], ["ANCIENT", "antonym", "Opposite of modern"], ["MIRROR", "riddle", "I show you yourself but I'm not alive"], ["HARBOR", "definition", "A sheltered place for ships"], ["GENUINE", "synonym", "Authentic, real"], ["WHISPER", "antonym", "Opposite of shout"] ],
    [ ["CANDLE", "riddle", "The longer I stand, the shorter I grow"], ["FROZEN", "synonym", "Icy, solid"], ["VOLCANO", "definition", "Mountain that erupts lava"], ["HUMBLE", "antonym", "Opposite of arrogant"], ["CAPTAIN", "definition", "Leader of a ship or team"], ["MYSTERY", "synonym", "Puzzle, enigma"] ]
  ],
  wordBridge: [
    [ ["HOT", "HOUSE", "DOG"], ["FIRE", "SHOP", "WORK"], ["SUN", "HOUSE", "LIGHT"], ["BOOK", "FISH", "SHELF"], ["FOOT", "ROOM", "BALL"], ["TOOTH", "WORK", "PASTE"] ],
    [ ["BIRTH", "BREAK", "DAY"], ["RAIN", "TIE", "BOW"], ["SNOW", "PARK", "BALL"], ["KEY", "BOARD", "CHAIN"], ["DOOR", "MAN", "BELL"], ["HEART", "THROUGH", "BREAK"] ],
    [ ["PAN", "STACK", "CAKE"], ["BACK", "CASE", "PACK"], ["EYE", "SHIP", "BROW"], ["HONEY", "WAX", "BEE"], ["MOON", "HOUSE", "LIGHT"], ["SAND", "BOX", "PAPER"] ]
  ],
  connections: [
    { groups: [ { name: "Card games", words: ["POKER", "RUMMY", "BRIDGE"], pts: 300 }, { name: "Planets", words: ["MARS", "VENUS", "SATURN"], pts: 300 }, { name: "Chocolate bars", words: ["SNICKERS", "TWIX", "MILKY WAY"], pts: 400 } ] },
    { groups: [ { name: "Shades of blue", words: ["NAVY", "TEAL", "COBALT"], pts: 300 }, { name: "Coffee drinks", words: ["LATTE", "MOCHA", "CORTADO"], pts: 300 }, { name: "___ ball", words: ["FOOT", "BASKET", "SNOW"], pts: 400 } ] },
    { groups: [ { name: "Trees", words: ["OAK", "MAPLE", "BIRCH"], pts: 300 }, { name: "Chess pieces", words: ["KNIGHT", "BISHOP", "ROOK"], pts: 300 }, { name: "Things with keys", words: ["PIANO", "MAP", "LOCK"], pts: 400 } ] }
  ],
  oddOneOut: [
    [ { words: ["Mercury", "Venus", "Pluto", "Mars"], odd: 2, why: "Pluto isn't a planet (others are planets)" },
      { words: ["Violin", "Cello", "Flute", "Viola"], odd: 2, why: "Flute isn't a string instrument" },
      { words: ["Python", "Cobra", "Viper", "Gecko"], odd: 3, why: "Gecko isn't a snake" },
      { words: ["Euro", "Yen", "Peso", "Bitcoin"], odd: 3, why: "Bitcoin isn't government-issued currency" },
      { words: ["Tokyo", "Kyoto", "Seoul", "Osaka"], odd: 2, why: "Seoul isn't in Japan" },
      { words: ["Sapphire", "Ruby", "Emerald", "Pearl"], odd: 3, why: "Pearl isn't a mineral gemstone" },
      { words: ["Hamlet", "Macbeth", "Othello", "Beowulf"], odd: 3, why: "Beowulf isn't by Shakespeare" },
      { words: ["Whale", "Dolphin", "Shark", "Seal"], odd: 2, why: "Shark isn't a mammal" } ],
    [ { words: ["Lime", "Lemon", "Grapefruit", "Mango"], odd: 3, why: "Mango isn't a citrus fruit" },
      { words: ["Oxygen", "Hydrogen", "Water", "Helium"], odd: 2, why: "Water isn't an element" },
      { words: ["Rome", "Athens", "Madrid", "Barcelona"], odd: 3, why: "Barcelona isn't a capital" },
      { words: ["Soccer", "Tennis", "Hockey", "Rugby"], odd: 1, why: "Tennis isn't a team sport" },
      { words: ["Bat", "Penguin", "Ostrich", "Emu"], odd: 0, why: "Bat isn't a bird (others are flightless birds)" },
      { words: ["Tomato", "Cucumber", "Carrot", "Pepper"], odd: 2, why: "Carrot is the only true vegetable (others are botanically fruits)" },
      { words: ["Everest", "K2", "Kilimanjaro", "Lhotse"], odd: 2, why: "Kilimanjaro isn't in the Himalayas/Karakoram" },
      { words: ["Mozart", "Beethoven", "Picasso", "Bach"], odd: 2, why: "Picasso isn't a composer" } ]
  ],
  // ---------- 5. THINK FAST ----------
  thinkFast: [
    [ { q: "What comes next? 2, 6, 12, 20, 30, ___", answers: ["42"], explain: "Differences +4,+6,+8,+10,+12" },
      { q: "A bat and a ball cost $1.10 total. The bat costs $1.00 more than the ball. How many cents does the ball cost?", answers: ["5", "5 cents", "0.05", "$0.05", "five"], explain: "Ball 5¢, bat $1.05" } ],
    [ { q: "I'm tall when I'm young and short when I'm old. What am I?", answers: ["candle", "a candle"], explain: "A candle burns down" },
      { q: "If 5 machines take 5 minutes to make 5 widgets, how many minutes do 100 machines take to make 100 widgets?", answers: ["5", "five", "5 minutes"], explain: "Each machine makes 1 widget per 5 minutes" } ],
    [ { q: "What comes next? 1, 1, 2, 3, 5, 8, 13, ___", answers: ["21"], explain: "Fibonacci: add the previous two" },
      { q: "Anna is older than Ben. Cara is younger than Ben. Dev is older than Anna. Who is the second-youngest?", answers: ["ben"], explain: "Order: Cara < Ben < Anna < Dev" } ],
    [ { q: "A lily pad patch doubles every day and covers the whole pond on day 48. On what day did it cover half the pond?", answers: ["47", "day 47"], explain: "One doubling before day 48" },
      { q: "How many times does the digit 7 appear when writing all whole numbers from 1 to 100?", answers: ["20", "twenty"], explain: "10 in the ones place + 10 in the tens place" } ]
  ]
};
