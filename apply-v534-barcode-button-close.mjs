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

console.log("Installation Wellness 5.3.4 - fermeture du panneau Code-barres...\n");

const pkg = JSON.parse(read("package.json"));
pkg.version = "5.3.4";
pkg.description = "Wellness 5.3.4 - close barcode modal when choosing quantity";
pkg.scripts["test:barcode-button-close"] = "node scripts/test-v534-barcode.mjs";
if (!pkg.scripts.test.includes("test:barcode-button-close")) {
  pkg.scripts.test += " && npm run test:barcode-button-close";
}
if (!pkg.scripts["check:syntax"].includes("node --check barcode-v534.js")) {
  pkg.scripts["check:syntax"] += " && node --check barcode-v534.js";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 5\.3\.3/g, "Wellness 5.3.4");
index = replaceRequired(
  index,
  '  <script src="barcode-v532.js"></script>',
  '  <script src="barcode-v532.js"></script>\n  <script src="barcode-v534.js"></script>',
  "script V5.3.4"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "barcode-v532.js",',
  '  "barcode-v532.js",\n  "barcode-v534.js",',
  "build V5.3.4"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.3.4";');
sw = replaceRequired(
  sw,
  '  "./barcode-v532.js",',
  '  "./barcode-v532.js",\n  "./barcode-v534.js",',
  "cache V5.3.4"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.3.4";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.3.4";');
write("wellness2.js", w2);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.3\.3-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.3.4-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.3\.3"/g, '"appVersion": "5.3.4"');

ota = replaceRequired(
  ota,
  '      - "barcode-v532.js"',
  '      - "barcode-v532.js"\n      - "barcode-v534.js"',
  "OTA V5.3.4 runtime"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-v533-barcode.mjs"',
  '      - "scripts/test-v533-barcode.mjs"\n      - "scripts/test-v534-barcode.mjs"',
  "OTA V5.3.4 test"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.3.4 installée.");
console.log("Quand tu touches « Choisir la quantité » :");
console.log("1. Quantité s'ouvre.");
console.log("2. Code-barres se ferme immédiatement derrière.");
console.log("3. Seule la fenêtre Quantité reste affichée.");
console.log("Aucun plugin natif ajouté : OTA uniquement.");
