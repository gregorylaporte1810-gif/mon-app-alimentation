import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} introuvable. Lance ce script depuis la racine de mon-app-alimentation.`);
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

console.log("Installation Wellness 5.2.1 - micro-polish final...\n");

const pkg = JSON.parse(read("package.json"));
pkg.version = "5.2.1";
pkg.description = "Wellness 5.2.1 - final iPhone micro polish";
pkg.scripts["test:micro"] = "node scripts/test-v521-micro.mjs";
if (!pkg.scripts.test.includes("test:micro")) {
  pkg.scripts.test += " && npm run test:micro";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let style = read("style.css");
if (!style.includes("WELLNESS V5.2.1 — MICRO POLISH")) {
  style += "\n\n" + read("v521-style.css");
}
write("style.css", style);

let index = read("index.html");
index = index.replace(/Wellness 5\.2\.0/g, "Wellness 5.2.1");
write("index.html", index);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.2.1";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.2.1";');
write("wellness2.js", w2);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.2.1";');
write("sw.js", sw);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.2\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.2.1-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.2\.0"/g, '"appVersion": "5.2.1"');
ota = replaceRequired(
  ota,
  '      - "scripts/test-final-v52.mjs"',
  '      - "scripts/test-final-v52.mjs"\n      - "scripts/test-v521-micro.mjs"',
  "test V5.2.1 dans OTA"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.2.1 installée.");
console.log("Changements uniquement visuels : repas vides compacts + FAB plus discret.");
console.log("Aucun plugin natif : OTA et PWA uniquement.");
