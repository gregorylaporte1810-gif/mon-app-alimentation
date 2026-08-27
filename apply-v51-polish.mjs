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

console.log("Installation Wellness 5.1 - polish final...\n");

// ----------------------------------------------------------
// Fix principal Nutrition : le journal premium était recréé
// périodiquement même sans changement, ce qui faisait sauter
// le scroll iOS et effaçait les décorations V4.3.
// ----------------------------------------------------------
let ux = read("ux-shell.js");

if (!ux.includes("premiumJournalSignature")) {
  ux = replaceRequired(
    ux,
    "  let plannerEditSource = null;",
    `  let plannerEditSource = null;
  let premiumJournalSignature = "";`,
    "signature journal"
  );

  ux = replaceRequired(
    ux,
    `    const entries = account.journalCalories || [];
    const slots = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];

    list.innerHTML = slots.map((slot) => {`,
    `    const entries = account.journalCalories || [];
    const slots = ["Petit-déjeuner", "Déjeuner", "Dîner", "Collation"];
    const journalSignature = JSON.stringify(entries.map((entry) => [
      entry.id,
      entry.nom,
      entry.calories,
      entry.proteines,
      entry.glucides,
      entry.lipides,
      entry.repasSlot,
      entry.quantity,
      entry.unit,
    ]));

    // Ne reconstruit pas le DOM toutes les 1,5 s si rien n'a changé.
    // Cela préserve le scroll, les boutons Recettes/Favoris et les
    // décorations ajoutées par V4.3.
    if (journalSignature === premiumJournalSignature) return;
    premiumJournalSignature = journalSignature;

    const scrollBefore = window.scrollY;
    const preserveScroll = document.getElementById("page-recettes")?.classList.contains("active") && scrollBefore > 0;

    list.innerHTML = slots.map((slot) => {`,
    "garde rendu journal"
  );

  ux = replaceRequired(
    ux,
    `    }).join("");
  }

  function plannerCards()`,
    `    }).join("");

    if (preserveScroll) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollBefore, behavior: "auto" });
      });
    }
  }

  function plannerCards()`,
    "restauration scroll"
  );
}

ux = ux.replace(
  "window.setInterval(syncPremiumUI, 1500);",
  `window.setInterval(() => {
      if (document.visibilityState === "visible") syncPremiumUI();
    }, 3000);`
);
write("ux-shell.js", ux);

// ----------------------------------------------------------
// Package / tests
// ----------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
pkg.version = "5.1.0";
pkg.description = "Wellness 5.1 - premium polish, stable Nutrition scroll and universal UX";
pkg.scripts["test:polish"] = "node scripts/test-polish-v51.mjs";
if (!pkg.scripts.test.includes("test:polish")) pkg.scripts.test += " && npm run test:polish";
for (const check of ["node --check polish-v51-core.js", "node --check polish-v51.js"]) {
  if (!pkg.scripts["check:syntax"].includes(check)) pkg.scripts["check:syntax"] += ` && ${check}`;
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

// ----------------------------------------------------------
// Scripts web
// ----------------------------------------------------------
let index = read("index.html");
index = index.replace(/Wellness 5\.0\.1/g, "Wellness 5.1.0");
index = replaceRequired(
  index,
  '  <script src="health-v501-guard.js"></script>',
  '  <script src="health-v501-guard.js"></script>\n  <script src="polish-v51-core.js"></script>\n  <script src="polish-v51.js"></script>',
  "scripts V5.1"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "health-v501-guard.js",',
  '  "health-v501-guard.js",\n  "polish-v51-core.js",\n  "polish-v51.js",',
  "build V5.1"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.1.0";');
sw = replaceRequired(
  sw,
  '  "./health-v501-guard.js",',
  '  "./health-v501-guard.js",\n  "./polish-v51-core.js",\n  "./polish-v51.js",',
  "cache V5.1"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.1.0";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.1.0";');
write("wellness2.js", w2);

let style = read("style.css");
if (!style.includes("WELLNESS V5.1 — PREMIUM POLISH")) {
  style += "\n\n" + read("v51-style.css");
}
write("style.css", style);

// ----------------------------------------------------------
// OTA
// ----------------------------------------------------------
let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.0\.1-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.1.0-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.0\.1"/g, '"appVersion": "5.1.0"');
ota = replaceRequired(
  ota,
  '      - "health-v501-guard.js"',
  '      - "health-v501-guard.js"\n      - "polish-v51-core.js"\n      - "polish-v51.js"',
  "OTA V5.1 files"
);
ota = replaceRequired(
  ota,
  '      - "scripts/test-smart-v44.mjs"',
  '      - "scripts/test-smart-v44.mjs"\n      - "scripts/test-polish-v51.mjs"',
  "OTA V5.1 test"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.1 installée.");
console.log("Correction majeure : Nutrition ne doit plus remonter toute seule en bas de page.");
console.log("V5.1 est 100% web : OTA uniquement, pas de nouvelle IPA.");
