import fs from "node:fs";
import path from "node:path";

const VERSION = "5.4.1";
const root = process.cwd();

function file(name) { return path.join(root, name); }
function read(name) {
  if (!fs.existsSync(file(name))) {
    throw new Error(`${name} introuvable. Lance ce script depuis la racine du projet Wellness.`);
  }
  return fs.readFileSync(file(name), "utf8");
}
function write(name, content) {
  fs.mkdirSync(path.dirname(file(name)), { recursive: true });
  fs.writeFileSync(file(name), content, "utf8");
  console.log(`✅ ${name}`);
}
function addAfterOnce(text, anchor, addition, label) {
  if (text.includes(addition.trim())) return text;
  const count = text.split(anchor).length - 1;
  if (count !== 1) throw new Error(`${label}: ancre trouvée ${count} fois.`);
  return text.replace(anchor, `${anchor}\n${addition}`);
}

console.log("Installation Wellness 5.4.1 — responsive + réorganisation...\n");

// ----------------------------------------------------------
// 1. Corrige le crash du validateur si journalCalories ou
//    weightHistory n'est pas un tableau.
// ----------------------------------------------------------
let hard = read("hardening-core.js");

if (hard.includes("(account.journalCalories || []).forEach")) {
  hard = hard.replace(
    `(account.journalCalories || []).forEach((entry, index) => {`,
    `const journalEntries = Array.isArray(account.journalCalories) ? account.journalCalories : [];
    journalEntries.forEach((entry, index) => {`
  );
}

if (hard.includes("(account.weightHistory || []).forEach")) {
  hard = hard.replace(
    `(account.weightHistory || []).forEach((entry, index) => {`,
    `const weightEntries = Array.isArray(account.weightHistory) ? account.weightHistory : [];
    weightEntries.forEach((entry, index) => {`
  );
}

hard = hard.replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${VERSION}";`);
write("hardening-core.js", hard);

// ----------------------------------------------------------
// 2. Le test maintenance ne doit plus être figé sur 5.4.0.
// ----------------------------------------------------------
write("scripts/test-v54-maintenance.mjs", read("patch-v541-test-maintenance.mjs"));

// ----------------------------------------------------------
// 3. Supprime le correctif iPhone basé sur CSS zoom.
// ----------------------------------------------------------
write("viewport-v53.js", read("patch-v541-viewport.js"));

// ----------------------------------------------------------
// 4. Nouveau runtime de disposition.
// ----------------------------------------------------------
write("layout-v541.js", read("patch-v541-layout.js"));

// ----------------------------------------------------------
// 5. CSS responsive.
// ----------------------------------------------------------
let style = read("style.css");
const v541Style = read("patch-v541-style.css");
if (!style.includes("WELLNESS V5.4.1 — RESPONSIVE IPHONE + CONTENT SWAP")) {
  style += `\n\n${v541Style}\n`;
}
write("style.css", style);

// ----------------------------------------------------------
// 6. index.html
// ----------------------------------------------------------
let index = read("index.html");
index = index.replace(
  /<meta name="viewport" content="[^"]*">/,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, viewport-fit=cover, shrink-to-fit=no">'
);
index = index.replace(/Wellness 5\.4\.0/g, `Wellness ${VERSION}`);

if (!index.includes('src="layout-v541.js"')) {
  index = addAfterOnce(
    index,
    '  <script src="barcode-v534.js"></script>',
    '  <script src="layout-v541.js"></script>',
    "index layout V5.4.1"
  );
}
write("index.html", index);

// ----------------------------------------------------------
// 7. Versions principales.
// ----------------------------------------------------------
let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, `const W2_VERSION = "${VERSION}";`);
write("wellness2.js", w2);

let otaUpdater = read("ota-updater.js");
otaUpdater = otaUpdater.replace(
  /const BUNDLED_APP_VERSION = "[^"]+";/,
  `const BUNDLED_APP_VERSION = "${VERSION}";`
);
write("ota-updater.js", otaUpdater);

// ----------------------------------------------------------
// 8. Service worker.
// ----------------------------------------------------------
let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, `const CACHE = "wellness-${VERSION}";`);
if (!sw.includes('"./layout-v541.js"')) {
  sw = addAfterOnce(
    sw,
    '  "./barcode-v534.js",',
    '  "./layout-v541.js",',
    "service worker layout"
  );
}
write("sw.js", sw);

// ----------------------------------------------------------
// 9. Build web.
// ----------------------------------------------------------
let build = read("scripts/build-web.mjs");
if (!build.includes('"layout-v541.js"')) {
  build = addAfterOnce(
    build,
    '  "barcode-v534.js",',
    '  "layout-v541.js",',
    "build web layout"
  );
}
write("scripts/build-web.mjs", build);

// ----------------------------------------------------------
// 10. Package + tests.
// ----------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
pkg.version = VERSION;
pkg.description = "Wellness 5.4.1 - responsive iPhone and journal/meal layout";
pkg.scripts["test:layout-v541"] = "node scripts/test-v541-layout.mjs";

if (!pkg.scripts.test.includes("test:layout-v541")) {
  pkg.scripts.test += " && npm run test:layout-v541";
}
if (!pkg.scripts["check:syntax"].includes("node --check layout-v541.js")) {
  pkg.scripts["check:syntax"] += " && node --check layout-v541.js";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");
write("scripts/test-v541-layout.mjs", read("patch-v541-test-layout.mjs"));

// ----------------------------------------------------------
// 11. Workflow OTA.
// ----------------------------------------------------------
let workflow = read(".github/workflows/ota-web-update.yml");
workflow = workflow.replace(/VERSION="5\.4\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.4.1-${GITHUB_SHA::12}"');
workflow = workflow.replace(/"appVersion": "5\.4\.0"/g, '"appVersion": "5.4.1"');

if (!workflow.includes('- "layout-v541.js"')) {
  workflow = addAfterOnce(
    workflow,
    '      - "barcode-v534.js"',
    '      - "layout-v541.js"',
    "workflow layout"
  );
}
if (!workflow.includes('- "scripts/test-v541-layout.mjs"')) {
  workflow = addAfterOnce(
    workflow,
    '      - "scripts/test-v54-maintenance.mjs"',
    '      - "scripts/test-v541-layout.mjs"',
    "workflow test layout"
  );
}
write(".github/workflows/ota-web-update.yml", workflow);

// ----------------------------------------------------------
// 12. README version.
// ----------------------------------------------------------
let readme = read("README.md");
readme = readme.replace(/^# Wellness 5\.4\b/m, "# Wellness 5.4.1");
write("README.md", readme);

console.log("\n🎉 Wellness 5.4.1 installée.");
console.log("• crash test 'bad journal' corrigé");
console.log("• tests Maintenance rendus dynamiques");
console.log("• ancien CSS zoom iPhone supprimé");
console.log("• Nutrition forcée à rester dans la largeur de l'iPhone");
console.log("• Journal alimentaire déplacé dans Aujourd'hui");
console.log("• Validation des repas déplacée dans Nutrition");
console.log("Aucun plugin natif ajouté : OTA + PWA uniquement.");
