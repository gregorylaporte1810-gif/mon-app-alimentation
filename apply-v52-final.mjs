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

console.log("Installation Wellness 5.2 - final audit polish...\n");

const pkg = JSON.parse(read("package.json"));
pkg.version = "5.2.0";
pkg.description = "Wellness 5.2 - final audit polish and usability fixes";
pkg.scripts["test:final"] = "node scripts/test-final-v52.mjs";
if (!pkg.scripts.test.includes("test:final")) pkg.scripts.test += " && npm run test:final";
for (const check of ["node --check final-v52-core.js", "node --check final-v52.js"]) {
  if (!pkg.scripts["check:syntax"].includes(check)) pkg.scripts["check:syntax"] += ` && ${check}`;
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 5\.1\.0/g, "Wellness 5.2.0");
index = replaceRequired(
  index,
  '  <script src="polish-v51.js"></script>',
  '  <script src="polish-v51.js"></script>\n  <script src="final-v52-core.js"></script>\n  <script src="final-v52.js"></script>',
  "scripts V5.2"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "polish-v51.js",',
  '  "polish-v51.js",\n  "final-v52-core.js",\n  "final-v52.js",',
  "build V5.2"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.2.0";');
sw = replaceRequired(
  sw,
  '  "./polish-v51.js",',
  '  "./polish-v51.js",\n  "./final-v52-core.js",\n  "./final-v52.js",',
  "cache V5.2"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.2.0";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.2.0";');
write("wellness2.js", w2);

let style = read("style.css");
if (!style.includes("WELLNESS V5.2 — FINAL AUDIT POLISH")) {
  style += "\n\n" + read("v52-style.css");
}
write("style.css", style);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.1\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.2.0-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.1\.0"/g, '"appVersion": "5.2.0"');
ota = replaceRequired(
  ota,
  '      - "polish-v51.js"',
  '      - "polish-v51.js"\n      - "final-v52-core.js"\n      - "final-v52.js"',
  "OTA V5.2 files"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-polish-v51.mjs"',
  '      - "scripts/test-polish-v51.mjs"\n      - "scripts/test-final-v52.mjs"',
  "OTA V5.2 test"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.2 installée.");
console.log("Aucun plugin natif ajouté : OTA + PWA uniquement, aucune nouvelle IPA.");
