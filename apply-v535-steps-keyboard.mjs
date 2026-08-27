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
  if (!source.includes(from)) throw new Error(`Point de correction introuvable : ${label}`);
  return source.replace(from, to);
}

console.log("Installation Wellness 5.3.5 - clavier des pas...\n");

// ==========================================================
// 1. Pas : ne plus ouvrir automatiquement le clavier iOS.
//    La fenêtre s'ouvre entièrement visible.
//    Le clavier n'apparaît que si l'utilisateur touche le champ.
// ==========================================================
let ux = read("ux-v53.js");

const oldFocus = `    setTimeout(() => {
      input?.focus();
      input?.select?.();
    }, 80);`;

const newFocus = `    // V5.3.5 : ne pas forcer le focus sur iPhone.
    // Le clavier ne s'ouvre plus automatiquement et toute la fenêtre
    // reste visible. L'utilisateur touche le champ uniquement s'il
    // veut saisir le total au clavier.
    setTimeout(() => {
      input?.blur?.();
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur?.();
      }
      document.querySelector(".v53-steps-sheet")?.scrollTo?.({ top: 0, behavior: "instant" });
    }, 80);`;

ux = replaceRequired(ux, oldFocus, newFocus, "autofocus du champ pas");
ux = ux.replace(/const VERSION = "5\.3\.\d+";/, 'const VERSION = "5.3.5";');
write("ux-v53.js", ux);

// ==========================================================
// 2. Un petit texte d'aide plus explicite.
// ==========================================================
ux = read("ux-v53.js");
ux = ux.replace(
  `Saisis le <strong>total réel</strong> de pas pour aujourd'hui. Tu peux aussi diminuer la valeur si tu t'es trompé.`,
  `Le total actuel est affiché ci-dessous. Utilise les raccourcis ou touche le champ seulement si tu veux saisir une valeur précise.`
);
write("ux-v53.js", ux);

// ==========================================================
// 3. Version
// ==========================================================
const pkg = JSON.parse(read("package.json"));
pkg.version = "5.3.5";
pkg.description = "Wellness 5.3.5 - steps editor without automatic iOS keyboard";
pkg.scripts["test:steps-keyboard"] = "node scripts/test-v535-steps-keyboard.mjs";
if (!pkg.scripts.test.includes("test:steps-keyboard")) {
  pkg.scripts.test += " && npm run test:steps-keyboard";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 5\.3\.\d+/g, "Wellness 5.3.5");
write("index.html", index);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.3.5";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.3.5";');
write("wellness2.js", w2);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.3.5";');
write("sw.js", sw);

// ==========================================================
// 4. OTA
// ==========================================================
let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.3\.\d+-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.3.5-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.3\.\d+"/g, '"appVersion": "5.3.5"');

const possibleAnchors = [
  '      - "scripts/test-v534-barcode.mjs"',
  '      - "scripts/test-v533-barcode.mjs"',
  '      - "scripts/test-v532-barcode.mjs"',
  '      - "scripts/test-v53.mjs"',
];

if (!ota.includes('scripts/test-v535-steps-keyboard.mjs')) {
  const anchor = possibleAnchors.find((line) => ota.includes(line));
  if (!anchor) throw new Error("Impossible d'insérer le test V5.3.5 dans le workflow OTA.");
  ota = ota.replace(
    anchor,
    `${anchor}\n      - "scripts/test-v535-steps-keyboard.mjs"`
  );
}
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.3.5 installée.");
console.log("La fenêtre Corriger mes pas s'ouvre désormais sans clavier.");
console.log("Le clavier n'apparaît que si tu touches volontairement le champ.");
console.log("Les raccourcis -1000 / +500 / +1000 / +5000 restent utilisables sans clavier.");
console.log("OTA uniquement, aucun plugin natif.");
