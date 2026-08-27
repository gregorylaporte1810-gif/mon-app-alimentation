import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} introuvable. Lance le script depuis la racine du projet.`);
  return readFileSync(path, "utf8");
}
function write(path, value) {
  writeFileSync(path, value, "utf8");
  console.log(`✅ ${path}`);
}
function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Point d'insertion introuvable : ${label}`);
  return source.replace(from, to);
}

console.log("Installation Wellness 4.4 - Smart Daily...\n");

const pkg = JSON.parse(read("package.json"));
pkg.version = "4.4.0";
pkg.description = "Wellness 4.4 - calendar, weekly insights, smart recipes and express logging";
pkg.scripts["test:smart"] = "node scripts/test-smart-v44.mjs";
if (!pkg.scripts.test.includes("test:smart")) pkg.scripts.test += " && npm run test:smart";
for (const check of ["node --check smart-v44-core.js", "node --check smart-v44.js"]) {
  if (!pkg.scripts["check:syntax"].includes(check)) pkg.scripts["check:syntax"] += ` && ${check}`;
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 4\.3\.1/g, "Wellness 4.4.0");
index = replaceRequired(
  index,
  '  <script src="daily-ux-v43.js"></script>',
  '  <script src="daily-ux-v43.js"></script>\n  <script src="smart-v44-core.js"></script>\n  <script src="smart-v44.js"></script>',
  "scripts V4.4"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "daily-ux-v43.js",',
  '  "daily-ux-v43.js",\n  "smart-v44-core.js",\n  "smart-v44.js",',
  "build V4.4"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-4.4.0";');
sw = replaceRequired(
  sw,
  '  "./daily-ux-v43.js",',
  '  "./daily-ux-v43.js",\n  "./smart-v44-core.js",\n  "./smart-v44.js",',
  "cache V4.4"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "4.4.0";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "4.4.0";');
write("wellness2.js", w2);

let daily = read("daily-ux-v43.js");
daily = daily.replace(/const VERSION = "4\.3\.0";/, 'const VERSION = "4.4.0";');
write("daily-ux-v43.js", daily);

let food = read("food-v42.js");
const smartHook = `  function searchLocal(query = "") {
    if (window.WellnessSmartV44?.searchFoods) {
      return window.WellnessSmartV44.searchFoods(query);
    }`;
if (!food.includes("window.WellnessSmartV44?.searchFoods")) {
  food = replaceRequired(
    food,
    `  function searchLocal(query = "") {
    return localFoods`,
    `${smartHook}
    return localFoods`,
    "recherche intelligente"
  );
}
write("food-v42.js", food);

let css = read("style.css");
if (!css.includes("WELLNESS V4.4 — SMART DAILY")) css += "\n\n" + read("v44-style.css");
write("style.css", css);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="4\.3\.1-\$\{GITHUB_SHA::12\}"/g, 'VERSION="4.4.0-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "4\.3\.1"/g, '"appVersion": "4.4.0"');
ota = replaceRequired(
  ota,
  '      - "daily-ux-v43.js"',
  '      - "daily-ux-v43.js"\n      - "smart-v44-core.js"\n      - "smart-v44.js"',
  "OTA V4.4 files"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-daily-v43.mjs"',
  '      - "scripts/test-daily-v43.mjs"\n      - "scripts/test-smart-v44.mjs"',
  "OTA V4.4 tests"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 4.4 installée.");
console.log("Lance : npm install puis npm run verify");
