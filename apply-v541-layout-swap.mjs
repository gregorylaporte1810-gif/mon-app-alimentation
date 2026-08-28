import fs from "node:fs";

const VERSION = "5.4.1";

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`${path} introuvable. Lance ce script depuis la racine du projet Wellness.`);
  return fs.readFileSync(path, "utf8");
}
function write(path, value) {
  fs.writeFileSync(path, value, "utf8");
  console.log(`✅ ${path}`);
}
function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Point de correction introuvable : ${label}`);
  return source.replace(from, to);
}
function replaceRegexRequired(source, regex, replacement, label) {
  if (regex.test(source)) return source.replace(regex, replacement);
  if (source.includes(replacement)) return source;
  throw new Error(`Point de correction introuvable : ${label}`);
}

console.log("Installation Wellness 5.4.1 — responsive + journal/repas...\n");

// ==========================================================
// 1) Écran Aujourd'hui : journal alimentaire à la place de
//    l'ancienne validation des repas.
// ==========================================================
let ux = read("ux-shell.js");

const homeMeals = `      <section class="px-meals-card px-card">
        <div class="px-section-row"><strong>🍴 Aujourd'hui</strong><span id="px-meals-count">0 / 3 repas</span></div>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Petit-déjeuner"><span>🌅</span><strong>Petit-déjeuner</strong><i id="px-check-breakfast"></i></button>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Déjeuner"><span>☀️</span><strong>Déjeuner</strong><i id="px-check-lunch"></i></button>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Dîner"><span>🌙</span><strong>Dîner</strong><i id="px-check-dinner"></i></button>
      </section>`;

const homeJournal = `      <section class="px-journal-card px-card px-home-journal-card">
        <p class="px-kicker">JOURNAL ALIMENTAIRE</p>
        <div id="px-journal-list" class="px-journal-list"></div>
      </section>`;

ux = replaceRequired(ux, homeMeals, homeJournal, "journal dans Aujourd'hui");

// ==========================================================
// 2) Écran Nutrition : validation des repas à la place du
//    journal. L'ancre garde Saisie express / Ajout rapide /
//    Il te reste / Repères du jour dans Nutrition.
// ==========================================================
const nutritionJournal = `      <section class="px-journal-card px-card">
        <p class="px-kicker">JOURNAL ALIMENTAIRE</p>
        <div id="px-journal-list" class="px-journal-list"></div>
      </section>`;

const nutritionMeals = `      <div id="px-nutrition-tools-anchor" aria-hidden="true"></div>

      <section class="px-meals-card px-card px-nutrition-meals-card">
        <div class="px-section-row"><strong>🍴 Repas du jour</strong><span id="px-meals-count">0 / 3 repas</span></div>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Petit-déjeuner"><span>🌅</span><strong>Petit-déjeuner</strong><i id="px-check-breakfast"></i></button>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Déjeuner"><span>☀️</span><strong>Déjeuner</strong><i id="px-check-lunch"></i></button>
        <button type="button" class="px-meal-check-row" data-meal-toggle="Dîner"><span>🌙</span><strong>Dîner</strong><i id="px-check-dinner"></i></button>
      </section>`;

ux = replaceRequired(ux, nutritionJournal, nutritionMeals, "validation des repas dans Nutrition");

// Le journal est maintenant sur Aujourd'hui : préserver le scroll de cette page.
ux = ux.replace(
  'document.getElementById("page-recettes")?.classList.contains("active") && scrollBefore > 0',
  'document.getElementById("page-accueil")?.classList.contains("active") && scrollBefore > 0'
);
write("ux-shell.js", ux);

// ==========================================================
// 3) Outils Nutrition V4.3 : ils restent dans Nutrition et
//    ne suivent pas le journal vers Aujourd'hui.
// ==========================================================
let daily = read("daily-ux-v43.js");
daily = replaceRequired(
  daily,
  `    const journal = document.querySelector(".px-journal-card");
    if (!journal || document.getElementById("v43-smart-tools")) return;`,
  `    const journal = document.querySelector(".px-journal-card");
    const anchor = document.getElementById("px-nutrition-tools-anchor") || journal;
    if (!journal || !anchor || document.getElementById("v43-smart-tools")) return;`,
  "ancre outils Nutrition V4.3"
);

daily = replaceRequired(
  daily,
  `    journal.parentElement.insertBefore(tools, journal);
    journal.parentElement.insertBefore(remaining, journal);
    journal.parentElement.insertBefore(quality, journal);`,
  `    anchor.parentElement.insertBefore(tools, anchor);
    anchor.parentElement.insertBefore(remaining, anchor);
    anchor.parentElement.insertBefore(quality, anchor);`,
  "position des outils Nutrition V4.3"
);
write("daily-ux-v43.js", daily);

// ==========================================================
// 4) Saisie express V4.4 : priorité à l'ancre Nutrition.
// ==========================================================
let smart = read("smart-v44.js");
smart = replaceRequired(
  smart,
  `    const anchor = document.getElementById("v43-smart-tools") || document.querySelector(".px-journal-card");`,
  `    const anchor = document.getElementById("v43-smart-tools") || document.getElementById("px-nutrition-tools-anchor") || document.querySelector(".px-journal-card");`,
  "ancre saisie express V4.4"
);
write("smart-v44.js", smart);

// ==========================================================
// 5) iPhone : suppression de l'ancien hack CSS zoom.
//    On repart sur le vrai viewport mobile, stable à 100 %.
// ==========================================================
const viewport = `(() => {
  "use strict";

  function normalizeViewport() {
    const html = document.documentElement;
    html.classList.remove("v53-mobile-viewport-repair");
    html.style.removeProperty("--v53-device-width");
    html.style.removeProperty("--v53-mobile-scale");
    document.body?.style.removeProperty("zoom");
  }

  normalizeViewport();
  document.addEventListener("DOMContentLoaded", normalizeViewport, { once: true });
  window.addEventListener("pageshow", normalizeViewport);
  window.addEventListener("orientationchange", normalizeViewport);
  window.addEventListener("resize", normalizeViewport);
})();
`;
write("viewport-v53.js", viewport);

// Verrouille l'échelle web-app à 100 % : évite les états géants / miniatures.
let index = read("index.html");
index = index.replace(
  /<meta name="viewport" content="[^"]+">/,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
);
index = index.replace(/Wellness 5\.4\.0/g, `Wellness ${VERSION}`);
write("index.html", index);

// ==========================================================
// 6) CSS responsive supplémentaire
// ==========================================================
let style = read("style.css");
const cssPatch = read("v541-layout.css");
if (!style.includes("WELLNESS V5.4.1 — RESPONSIVE + JOURNAL / REPAS SWAP")) {
  style += `\n\n${cssPatch}\n`;
}
write("style.css", style);

// ==========================================================
// 7) Versions / cache / OTA
// ==========================================================
const pkg = JSON.parse(read("package.json"));
pkg.version = VERSION;
pkg.description = "Wellness 5.4.1 - responsive iPhone et nouvelle organisation journal/repas";
pkg.scripts["test:layout-v541"] = "node scripts/test-v541-layout.mjs";
if (!pkg.scripts.test.includes("test:layout-v541")) {
  pkg.scripts.test += " && npm run test:layout-v541";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let hard = read("hardening-core.js");
hard = hard.replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${VERSION}";`);
write("hardening-core.js", hard);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, `const W2_VERSION = "${VERSION}";`);
write("wellness2.js", w2);

let otaUpdater = read("ota-updater.js");
otaUpdater = otaUpdater.replace(/const BUNDLED_APP_VERSION = "[^"]+";/, `const BUNDLED_APP_VERSION = "${VERSION}";`);
write("ota-updater.js", otaUpdater);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, `const CACHE = "wellness-${VERSION}";`);
write("sw.js", sw);

let workflow = read(".github/workflows/ota-web-update.yml");
workflow = workflow.replace(/VERSION="5\.4\.0-\$\{GITHUB_SHA::12\}"/g, `VERSION="${VERSION}-\${GITHUB_SHA::12}"`);
workflow = workflow.replace(/"appVersion": "5\.4\.0"/g, `"appVersion": "${VERSION}"`);
if (!workflow.includes('scripts/test-v541-layout.mjs')) {
  workflow = workflow.replace(
    '      - "scripts/test-v54-maintenance.mjs"',
    '      - "scripts/test-v54-maintenance.mjs"\n      - "scripts/test-v541-layout.mjs"'
  );
}
write(".github/workflows/ota-web-update.yml", workflow);

// README : version seulement, sans réécrire le reste.
let readme = read("README.md");
readme = readme.replace(/^# Wellness 5\.4\s*$/m, "# Wellness 5.4.1");
write("README.md", readme);

console.log("\n✅ Wellness 5.4.1 installée.");
console.log("• Journal alimentaire → Aujourd'hui");
console.log("• Validation des repas → Nutrition");
console.log("• Saisie express / Ajout rapide / Repères restent dans Nutrition");
console.log("• Ancien hack de zoom iPhone supprimé");
console.log("• Vue mobile verrouillée à 100 % pour éviter les rendus géant / miniature");
console.log("• OTA + PWA, aucun plugin natif ajouté");
