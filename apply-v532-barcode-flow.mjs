import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} introuvable. Lance ce script depuis la racine de mon-app-alimentation.`);
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

console.log("Installation Wellness 5.3.2 - flux code-barres...\n");

let w2 = read("wellness2.js");

const oldFlow = `    result.innerHTML=\`<div class="w2-barcode-product"><h3>\${w2Escape(food.name)}</h3><p>\${w2Escape(food.category)} · \${Math.round(food.kcal)} kcal / 100 g · P \${W2_CORE.round1(food.protein)} · G \${W2_CORE.round1(food.carbs)} · L \${W2_CORE.round1(food.fat)}</p><button id="w2-add-barcode-product">Choisir la portion</button></div>\`;
    document.getElementById("w2-add-barcode-product").addEventListener("click",()=>{w2OpenPortion(food);w2StopBarcodeCamera();});
    w2AwardXpOnce(\`barcode|\${w2Today()}|\${value}\`,4); w2Haptic(25);`;

const newFlow = `    result.innerHTML=\`<p class="mega-help">✅ Produit trouvé : \${w2Escape(food.name)}. Ouverture de la quantité…</p>\`;
    w2AwardXpOnce(\`barcode|\${w2Today()}|\${value}\`,4);
    w2Haptic(25);

    // V5.3.2 : plus besoin de toucher "Choisir la quantité".
    // Le scanner se ferme et la fenêtre de portion s'ouvre immédiatement.
    if (window.WellnessBarcodeFlowV532?.closeBarcodeThenOpenPortion) {
      window.WellnessBarcodeFlowV532.closeBarcodeThenOpenPortion(food);
    } else {
      w2StopBarcodeCamera();
      megaCloseOverlay(document.getElementById("w2-barcode-overlay"));
      setTimeout(() => w2OpenPortion(food), 40);
    }`;

w2 = replaceRequired(w2, oldFlow, newFlow, "ouverture automatique portion après scan");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.3.2";');
write("wellness2.js", w2);

const pkg = JSON.parse(read("package.json"));
pkg.version = "5.3.2";
pkg.description = "Wellness 5.3.2 - automatic barcode-to-portion flow";
pkg.scripts["test:barcode-flow"] = "node scripts/test-v532-barcode.mjs";
if (!pkg.scripts.test.includes("test:barcode-flow")) pkg.scripts.test += " && npm run test:barcode-flow";
if (!pkg.scripts["check:syntax"].includes("node --check barcode-v532.js")) {
  pkg.scripts["check:syntax"] += " && node --check barcode-v532.js";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 5\.3\.1/g, "Wellness 5.3.2");
index = replaceRequired(
  index,
  '  <script src="ux-v53.js"></script>',
  '  <script src="ux-v53.js"></script>\n  <script src="barcode-v532.js"></script>',
  "script barcode V5.3.2"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "ux-v53.js",',
  '  "ux-v53.js",\n  "barcode-v532.js",',
  "build barcode V5.3.2"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.3.2";');
sw = replaceRequired(
  sw,
  '  "./ux-v53.js",',
  '  "./ux-v53.js",\n  "./barcode-v532.js",',
  "cache barcode V5.3.2"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.3.2";');
write("hardening-core.js", hardening);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.3\.1-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.3.2-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.3\.1"/g, '"appVersion": "5.3.2"');

ota = replaceRequired(
  ota,
  '      - "ux-v53.js"',
  '      - "ux-v53.js"\n      - "barcode-v532.js"',
  "OTA barcode file"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-v53.mjs"',
  '      - "scripts/test-v53.mjs"\n      - "scripts/test-v532-barcode.mjs"',
  "OTA barcode test"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.3.2 installée.");
console.log("Produit reconnu : scanner fermé → quantité ouverte automatiquement.");
console.log("Produit inconnu : le scanner reste ouvert avec le message Open Food Facts.");
console.log("Validation de la quantité : retour direct à Nutrition.");
console.log("Aucun nouveau plugin natif : OTA + PWA uniquement.");
