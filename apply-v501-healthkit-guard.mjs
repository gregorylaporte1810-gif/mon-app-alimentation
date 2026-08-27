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

console.log("Installation Wellness 5.0.1 - garde HealthKit...\n");

const pkg = JSON.parse(read("package.json"));
pkg.version = "5.0.1";
pkg.description = "Wellness 5.0.1 - truthful HealthKit signing status";
if (!pkg.scripts["check:syntax"].includes("node --check health-v501-guard.js")) {
  pkg.scripts["check:syntax"] += " && node --check health-v501-guard.js";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 5\.0\.0/g, "Wellness 5.0.1");
index = replaceRequired(
  index,
  '  <script src="health-v5.js"></script>',
  '  <script src="health-v5.js"></script>\n  <script src="health-v501-guard.js"></script>',
  "guard HealthKit"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "health-v5.js",',
  '  "health-v5.js",\n  "health-v501-guard.js",',
  "build guard HealthKit"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.0.1";');
sw = replaceRequired(
  sw,
  '  "./health-v5.js",',
  '  "./health-v5.js",\n  "./health-v501-guard.js",',
  "cache guard HealthKit"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.0.1";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.0.1";');
write("wellness2.js", w2);

let css = read("style.css");
if (!css.includes("WELLNESS V5.0.1 — HEALTHKIT SIGNING GUARD")) {
  css += "\n\n" + read("v501-style.css");
}
write("style.css", css);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.0\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.0.1-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.0\.0"/g, '"appVersion": "5.0.1"');
ota = replaceRequired(
  ota,
  '      - "health-v5.js"',
  '      - "health-v5.js"\n      - "health-v501-guard.js"',
  "OTA guard HealthKit"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.0.1 installée.");
console.log("Cette OTA corrige le faux succès de synchronisation et affiche clairement un entitlement HealthKit manquant.");
console.log("Aucune nouvelle IPA n'est nécessaire pour ce correctif d'interface.");
