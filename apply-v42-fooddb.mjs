import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} introuvable. Lance ce script depuis la racine du projet.`);
  return readFileSync(path, "utf8");
}
function write(path, value) {
  writeFileSync(path, value, "utf8");
  console.log(`✅ ${path}`);
}
function ensureContains(source, needle, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(needle)) throw new Error(`Point d'insertion introuvable : ${label}`);
  return source.replace(needle, replacement);
}

console.log("Installation Wellness 4.2 Food Database...\n");

// package.json
const pkg = JSON.parse(read("package.json"));
pkg.version = "4.2.0";
pkg.description = "Wellness 4.2 - Food Database & smart quantities";
pkg.devDependencies = pkg.devDependencies || {};
pkg.devDependencies.exceljs = "^4.4.0";
pkg.scripts["fooddb:ciqual"] = "node scripts/import-ciqual-2025.mjs";
pkg.scripts["test:food"] = "node scripts/test-food-v42.mjs";
if (!pkg.scripts.test.includes("test:food")) {
  pkg.scripts.test = `${pkg.scripts.test} && npm run test:food`;
}
const syntaxParts = ["node --check food-units-core.js", "node --check food-v42.js", "node --check data-foods-ciqual.js"];
for (const part of syntaxParts) {
  if (!pkg.scripts["check:syntax"].includes(part)) pkg.scripts["check:syntax"] += ` && ${part}`;
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

// index.html
let index = read("index.html");
index = index.replace(/Wellness 4\.1/g, "Wellness 4.2");
index = ensureContains(
  index,
  '  <script src="data-foods.js"></script>',
  '  <script src="data-foods.js"></script>\n  <script src="data-foods-ciqual.js"></script>\n  <script src="food-units-core.js"></script>',
  "scripts Food DB"
);
index = ensureContains(
  index,
  '  <script src="wellness2.js"></script>',
  '  <script src="wellness2.js"></script>\n  <script src="food-v42.js"></script>',
  "script Food 4.2"
);
write("index.html", index);

// build-web
let build = read("scripts/build-web.mjs");
build = ensureContains(
  build,
  '  "data-foods.js",',
  '  "data-foods.js",\n  "data-foods-ciqual.js",\n  "food-units-core.js",\n  "food-v42.js",',
  "build web Food DB"
);
write("scripts/build-web.mjs", build);

// service worker
let sw = read("sw.js").replace('const CACHE = "wellness-4.1.0";', 'const CACHE = "wellness-4.2.0";');
sw = ensureContains(
  sw,
  '  "./data-foods.js",',
  '  "./data-foods.js",\n  "./data-foods-ciqual.js",\n  "./food-units-core.js",\n  "./food-v42.js",',
  "cache Food DB"
);
write("sw.js", sw);

// hardening version
let hc = read("hardening-core.js").replace('const APP_VERSION = "4.1.0";', 'const APP_VERSION = "4.2.0";');
write("hardening-core.js", hc);

// OTA workflow
let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="4\.1\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="4.2.0-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "4\.1\.0"/g, '"appVersion": "4.2.0"');
ota = ensureContains(
  ota,
  '      - "data-foods.js"',
  '      - "data-foods.js"\n      - "data-foods-ciqual.js"\n      - "food-units-core.js"\n      - "food-v42.js"',
  "OTA paths Food DB"
);
ota = ensureContains(
  ota,
  '      - "scripts/test-core.mjs"',
  '      - "scripts/test-core.mjs"\n      - "scripts/test-food-v42.mjs"\n      - "scripts/import-ciqual-2025.mjs"',
  "OTA scripts Food DB"
);
write(".github/workflows/ota-web-update.yml", ota);

// CSS
let css = read("style.css");
const marker = "WELLNESS V4.2 FOOD DATABASE";
if (!css.includes(marker)) {
  css += `

/* ======================================================
   ${marker}
====================================================== */
.v42-fooddb-info {
  margin: 8px 2px 0 !important;
  color: #7f91ab !important;
  font-size: .72rem;
  line-height: 1.4;
}
.v42-food-card .v42-food-source {
  margin-top: 8px;
  color: #6f84a4;
  font-size: .62rem;
  font-style: normal;
  font-weight: 750;
}
.v42-unit-select {
  min-width: 92px;
  margin: 0 !important;
  padding: 12px 34px 12px 12px !important;
  border-radius: 14px !important;
}
.v42-piece-weight-row {
  display: grid;
  gap: 7px;
  margin-top: 12px;
}
.v42-piece-weight-row[hidden] { display: none !important; }
.v42-manual-quantity-grid {
  display: grid;
  grid-template-columns: minmax(0,1fr) 130px;
  gap: 10px;
  margin: 12px 0;
}
#mega-journal-edit-quantity-wrap {
  display: grid;
  grid-template-columns: minmax(0,1fr) 105px;
  gap: 8px;
  align-items: end;
}
#mega-journal-edit-quantity-wrap > span {
  grid-column: 1 / -1;
}
@media (max-width: 520px) {
  .v42-manual-quantity-grid { grid-template-columns: minmax(0,1fr) 112px; }
  #mega-journal-edit-quantity-wrap { grid-template-columns: minmax(0,1fr) 96px; }
}
`;
}
write("style.css", css);

console.log("\n✅ Structure V4.2 installée.");
console.log("Étapes suivantes :");
console.log("1. npm install");
console.log("2. npm run fooddb:ciqual");
console.log("3. npm run verify");
