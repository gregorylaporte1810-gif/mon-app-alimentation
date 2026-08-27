import { readFileSync, writeFileSync, existsSync } from "node:fs";

const VERSION = "4.3.1";
const CSS_MARKER = "WELLNESS V4.3.1 IPHONE SAFE AREA + SUGGESTION CARDS";

function read(path) {
  if (!existsSync(path)) {
    throw new Error(`${path} introuvable. Lance ce script depuis la racine de mon-app-alimentation.`);
  }
  return readFileSync(path, "utf8");
}

function write(path, content) {
  writeFileSync(path, content, "utf8");
  console.log(`✅ ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Point de mise à jour introuvable : ${label}`);
  return source.replace(from, to);
}

console.log("Installation Wellness 4.3.1 - polish iPhone...\n");

// ---------------------------------------------------------
// Native iOS marker
// ---------------------------------------------------------
let native = read("native-bridge.js");

if (!native.includes('classList.add("wellness-native-ios")')) {
  native = replaceRequired(
    native,
    `  function configureNativeUi() {
    if (!isNative()) return;

    const pwaStatus = document.getElementById("mega-pwa-status");`,
    `  function configureNativeUi() {
    if (!isNative()) return;

    const nativePlatform = cap.getPlatform?.();
    document.documentElement.classList.add("wellness-native");
    if (nativePlatform === "ios") {
      document.documentElement.classList.add("wellness-native-ios");
    }

    const pwaStatus = document.getElementById("mega-pwa-status");`,
    "classe native iOS"
  );
}

write("native-bridge.js", native);

// ---------------------------------------------------------
// CSS fixes
// ---------------------------------------------------------
let style = read("style.css");

if (!style.includes(CSS_MARKER)) {
  style += `

/* ======================================================
   ${CSS_MARKER}
====================================================== */

/*
  Dans le WebView Capacitor iOS, env(safe-area-inset-top) peut être
  inférieur à l'espace réellement occupé par la Dynamic Island.
  On réserve donc une hauteur minimale uniquement dans l'app native iOS.
*/
@media (max-width: 700px) {
  html.wellness-native-ios.premium-v3 .app {
    padding-top: max(68px, calc(env(safe-area-inset-top) + 18px)) !important;
  }

  html.wellness-native-ios.premium-v3 .px-header {
    padding-top: 0 !important;
  }
}

/*
  V4.3 utilisait la même grille pour les cartes "Récents" et les
  suggestions. Les suggestions n'ont pas d'icône en première colonne :
  leur titre finissait donc comprimé dans une colonne très étroite.
*/
.v43-suggestion {
  flex: 0 0 min(270px, 78vw) !important;
  min-height: 88px !important;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) !important;
  grid-template-rows: auto auto !important;
  align-content: center !important;
  gap: 7px !important;
  padding: 13px 14px !important;
}

.v43-suggestion strong {
  display: -webkit-box;
  width: 100%;
  overflow: hidden;
  color: #eef4ff;
  font-size: .79rem !important;
  font-weight: 800;
  line-height: 1.28 !important;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.v43-suggestion small {
  display: block;
  width: 100%;
  color: #8294af !important;
  font-size: .67rem !important;
  line-height: 1.35 !important;
  white-space: normal;
}

.v43-suggestion-row {
  gap: 10px !important;
  scroll-snap-type: x proximity;
  scroll-padding-inline: 1px;
}

.v43-suggestion {
  scroll-snap-align: start;
}

/* Un peu plus de respiration sur les très petits iPhone. */
@media (max-width: 410px) {
  html.wellness-native-ios.premium-v3 .app {
    padding-top: max(66px, calc(env(safe-area-inset-top) + 17px)) !important;
  }

  .v43-suggestion {
    flex-basis: min(250px, 82vw) !important;
  }
}
`;
}

write("style.css", style);

// ---------------------------------------------------------
// Version metadata
// ---------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
pkg.version = VERSION;
pkg.description = "Wellness 4.3.1 - iPhone safe area and nutrition suggestion polish";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "4.3.1";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "4.3.1";');
write("wellness2.js", w2);

let index = read("index.html");
index = index.replace(/Wellness 4\.3\.0/g, "Wellness 4.3.1");
write("index.html", index);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-4.3.1";');
write("sw.js", sw);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="4\.3\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="4.3.1-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "4\.3\.0"/g, '"appVersion": "4.3.1"');
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 4.3.1 installée.");
console.log("Corrections : safe-area iPhone + cartes de suggestions lisibles.");
console.log("Aucun plugin natif ajouté : OTA uniquement.");
