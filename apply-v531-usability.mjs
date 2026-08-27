import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) {
    throw new Error(`${path} introuvable. Lance ce script depuis la racine de mon-app-alimentation.`);
  }
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

console.log("Installation Wellness 5.3.1 - iPhone, pas, liquides et anti double-tap...\n");

// ----------------------------------------------------------
// Food units: volume-first for liquids + broader detection.
// ----------------------------------------------------------
let units = read("food-units-core.js");

units = units.replace(
  /  function inferLiquid\(food = \{\}\) \{[\s\S]*?\n  \}\n\n  function inferPieceWeight/,
`  function inferLiquid(food = {}) {
    if (food.basisUnit === "ml") return true;
    if (food.liquid === true) return true;

    const text = normalizeText(\`\${food.name || ""} \${food.category || ""} \${food.subcategory || ""} \${food.brand || ""}\`);
    return /(^| )(boisson|eau|jus|nectar|smoothie|soda|cola|limonade|lait|cafe|the|infusion|tisane|vin|biere|cidre|alcool|spiritueux|cocktail|soupe|potage|bouillon|huile|sirop|vinaigre|sauce|kefir|kombucha|shake|milkshake|boisson vegetale|boisson lactee|boisson energetique|boisson sportive|yaourt a boire|creme liquide|lait de coco|a boire)( |$)/.test(text);
  }

  function inferPieceWeight`
);

units = units.replace(
`  function allowedUnits(food = {}) {
    const units = ["g", "kg"];
    if (inferLiquid(food)) units.push("ml", "cl", "l");
    units.push("unit");
    return units;
  }`,
`  function allowedUnits(food = {}) {
    if (inferLiquid(food)) {
      return ["ml", "cl", "l", "g", "kg", "unit"];
    }
    return ["g", "kg", "unit"];
  }`
);

write("food-units-core.js", units);

// ----------------------------------------------------------
// Food UI: infer liquid at opening time, volume labels, close
// both portion and parent food/search modal after validation.
// ----------------------------------------------------------
let food = read("food-v42.js");

food = food.replaceAll(
  'food.liquid ? "ml" : "g"',
  'U.inferLiquid(food) ? "ml" : "g"'
);
food = food.replaceAll(
  'food.liquid ? "250" : "100"',
  'U.inferLiquid(food) ? "250" : "100"'
);
food = food.replace(
  'const labels = { g: "g", kg: "kg", ml: "ml", cl: "cl", l: "L", unit: "unité" };',
  'const labels = { g: "g", kg: "kg", ml: "mL", cl: "cL", l: "L", unit: "unité" };'
);

food = replaceRequired(
  food,
  '      megaCloseOverlay(document.getElementById("w2-portion-overlay"));',
`      megaCloseOverlay(document.getElementById("w2-portion-overlay"));
      ["w2-food-overlay", "w2-barcode-overlay"].forEach((id) => {
        const parentOverlay = document.getElementById(id);
        if (parentOverlay) megaCloseOverlay(parentOverlay);
      });
      document.activeElement?.blur?.();`,
  "fermeture automatique après ajout d'un aliment"
);

write("food-v42.js", food);

// ----------------------------------------------------------
// package.json
// ----------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
pkg.version = "5.3.1";
pkg.description = "Wellness 5.3.1 - iPhone compatibility, editable steps, liquid units and double-tap zoom guard";
pkg.scripts["test:usability"] = "node scripts/test-v53.mjs";
if (!pkg.scripts.test.includes("test:usability")) {
  pkg.scripts.test += " && npm run test:usability";
}
for (const check of [
  "node --check viewport-v53.js",
  "node --check ux-v53-core.js",
  "node --check ux-v53.js",
]) {
  if (!pkg.scripts["check:syntax"].includes(check)) {
    pkg.scripts["check:syntax"] += ` && ${check}`;
  }
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

// ----------------------------------------------------------
// index.html
// ----------------------------------------------------------
let index = read("index.html");
index = index.replace(/Wellness 5\.2\.1/g, "Wellness 5.3.1");
index = index.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">'
);

index = replaceRequired(
  index,
  '  <link rel="stylesheet" href="style.css">',
  '  <script src="viewport-v53.js"></script>\n  <link rel="stylesheet" href="style.css">',
  "bootstrap viewport V5.3"
);

index = replaceRequired(
  index,
  '  <script src="final-v52.js"></script>',
  '  <script src="final-v52.js"></script>\n  <script src="ux-v53-core.js"></script>\n  <script src="ux-v53.js"></script>',
  "scripts V5.3"
);

write("index.html", index);

// ----------------------------------------------------------
// CSS
// ----------------------------------------------------------
let style = read("style.css");
if (!style.includes("WELLNESS V5.3 — USABILITY + IPHONE COMPATIBILITY")) {
  style += "\n\n" + read("v53-style.css");
}
write("style.css", style);

// ----------------------------------------------------------
// Version display / cache
// ----------------------------------------------------------
let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.3.1";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.3.1";');
write("wellness2.js", w2);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.3.1";');
sw = replaceRequired(
  sw,
  '  "./final-v52.js",',
  '  "./final-v52.js",\n  "./viewport-v53.js",\n  "./ux-v53-core.js",\n  "./ux-v53.js",',
  "cache V5.3"
);
write("sw.js", sw);

// ----------------------------------------------------------
// Web bundle
// ----------------------------------------------------------
let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "final-v52.js",',
  '  "final-v52.js",\n  "viewport-v53.js",\n  "ux-v53-core.js",\n  "ux-v53.js",',
  "build V5.3"
);
write("scripts/build-web.mjs", build);

// ----------------------------------------------------------
// OTA
// ----------------------------------------------------------
let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.2\.1-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.3.1-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.2\.1"/g, '"appVersion": "5.3.1"');

ota = replaceRequired(
  ota,
  '      - "final-v52.js"',
  '      - "final-v52.js"\n      - "viewport-v53.js"\n      - "ux-v53-core.js"\n      - "ux-v53.js"',
  "paths OTA V5.3"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-v521-micro.mjs"',
  '      - "scripts/test-v521-micro.mjs"\n      - "scripts/test-v53.mjs"',
  "test OTA V5.3"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.3.1 installée.");
console.log("• Affichage iPhone anormalement zoomé : garde de compatibilité automatique.");
console.log("• Pas : le total du jour est maintenant modifiable, y compris à la baisse.");
console.log("• Liquides : mL / cL / L disponibles en priorité, sans saisir un grammage.");
console.log("• Aliment validé : la fenêtre d'ajout se ferme entièrement.\n• Double-tap : le zoom accidentel est bloqué, sans désactiver le pincement à deux doigts.");
console.log("Aucun plugin natif ajouté : OTA + PWA uniquement.");
