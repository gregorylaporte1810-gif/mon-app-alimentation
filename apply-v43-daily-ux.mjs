import { readFileSync, writeFileSync, existsSync } from "node:fs";

const VERSION = "4.3.0";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} introuvable. Lance ce script depuis la racine du projet.`);
  return readFileSync(path, "utf8");
}
function write(path, content) {
  writeFileSync(path, content, "utf8");
  console.log(`✅ ${path}`);
}
function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Point d'insertion introuvable : ${label}`);
  return source.replace(from, to);
}

console.log("Installation Wellness 4.3 - Usage quotidien...\n");

// Package
const pkg = JSON.parse(read("package.json"));
pkg.version = VERSION;
pkg.description = "Wellness 4.3 - Daily nutrition productivity";
pkg.scripts["test:daily"] = "node scripts/test-daily-v43.mjs";
if (!pkg.scripts.test.includes("test:daily")) pkg.scripts.test += " && npm run test:daily";
for (const check of ["node --check daily-ux-core-v43.js", "node --check daily-ux-v43.js"]) {
  if (!pkg.scripts["check:syntax"].includes(check)) pkg.scripts["check:syntax"] += ` && ${check}`;
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

// index.html
let index = read("index.html");
index = index.replace(/Wellness 4\.2\.1/g, "Wellness 4.3.0");
index = replaceRequired(
  index,
  '  <script src="food-v42.js"></script>',
  '  <script src="food-v42.js"></script>\n  <script src="daily-ux-core-v43.js"></script>\n  <script src="daily-ux-v43.js"></script>',
  "scripts V4.3"
);
write("index.html", index);

// Build
let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "food-v42.js",',
  '  "food-v42.js",\n  "daily-ux-core-v43.js",\n  "daily-ux-v43.js",',
  "build V4.3"
);
write("scripts/build-web.mjs", build);

// Service worker
let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-4.3.0";');
sw = replaceRequired(
  sw,
  '  "./food-v42.js",',
  '  "./food-v42.js",\n  "./daily-ux-core-v43.js",\n  "./daily-ux-v43.js",',
  "cache V4.3"
);
write("sw.js", sw);

// Hardening
let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "4.3.0";');
write("hardening-core.js", hardening);

// Wellness internal version
let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "4.3.0";');
write("wellness2.js", w2);

// Archive du journal avant le reset quotidien
let app = read("app.js");
const archiveMarker = "WELLNESS V4.3 ARCHIVE JOURNAL BEFORE DAILY RESET";
if (!app.includes(archiveMarker)) {
  const resetNeedle = `  compte.caloriesConsommees = 0;
  compte.journalCalories = [];`;
  const resetPatch = `  // ${archiveMarker}
  if (Array.isArray(compte.journalCalories) && compte.journalCalories.length && compte.dateDonneesJour) {
    compte.v43 = compte.v43 && typeof compte.v43 === "object" ? compte.v43 : {};
    compte.v43.dailyJournals = compte.v43.dailyJournals && typeof compte.v43.dailyJournals === "object"
      ? compte.v43.dailyJournals
      : {};
    compte.v43.dailyJournals[compte.dateDonneesJour] = JSON.parse(JSON.stringify(compte.journalCalories));
    const joursArchives = Object.keys(compte.v43.dailyJournals).sort();
    while (joursArchives.length > 90) delete compte.v43.dailyJournals[joursArchives.shift()];
  }

  compte.caloriesConsommees = 0;
  compte.journalCalories = [];`;
  app = replaceRequired(app, resetNeedle, resetPatch, "archive journal avant reset");
}
write("app.js", app);


// CSS
let style = read("style.css");
const cssMarker = "WELLNESS V4.3 — DAILY NUTRITION PRODUCTIVITY";
if (!style.includes(cssMarker)) {
  style += "\n\n" + read("v43-style.css");
}
write("style.css", style);

// OTA
let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="4\.2\.1-\$\{GITHUB_SHA::12\}"/g, 'VERSION="4.3.0-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "4\.2\.1"/g, '"appVersion": "4.3.0"');
ota = replaceRequired(
  ota,
  '      - "food-v42.js"',
  '      - "food-v42.js"\n      - "daily-ux-core-v43.js"\n      - "daily-ux-v43.js"',
  "OTA V4.3 files"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-food-v42.mjs"',
  '      - "scripts/test-food-v42.mjs"\n      - "scripts/test-daily-v43.mjs"',
  "OTA V4.3 tests"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 4.3 installée.");
console.log("Lance maintenant : npm install puis npm run verify");
