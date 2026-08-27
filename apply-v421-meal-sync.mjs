import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MARKER = "WELLNESS V4.2.1 JOURNAL TODAY MEAL SYNC";

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

console.log("Installation Wellness 4.2.1 - synchronisation Journal ↔ Aujourd'hui...\n");

let core = read("food-units-core.js");

if (!core.includes("function journalMealPresence")) {
  core = replaceRequired(
    core,
    `  function stripQuantitySuffix(name = "") {`,
    `  function journalMealPresence(journal = []) {
    const result = {
      "Petit-déjeuner": false,
      "Déjeuner": false,
      "Dîner": false,
    };

    if (!Array.isArray(journal)) return result;

    journal.forEach((entry) => {
      const slot = String(entry?.repasSlot || "").trim();
      if (Object.prototype.hasOwnProperty.call(result, slot)) {
        result[slot] = true;
      }
    });

    return result;
  }

  function stripQuantitySuffix(name = "") {`,
    "helper journalMealPresence"
  );

  core = replaceRequired(
    core,
    `    formatQuantity,
    stripQuantitySuffix,`,
    `    formatQuantity,
    journalMealPresence,
    stripQuantitySuffix,`,
    "export journalMealPresence"
  );
}

write("food-units-core.js", core);

let food = read("food-v42.js");

if (!food.includes(MARKER)) {
  food += `

/* ======================================================
   ${MARKER}
====================================================== */
(() => {
  "use strict";

  const U = window.WellnessFoodUnits;
  const MEALS = ["Petit-déjeuner", "Déjeuner", "Dîner"];

  function ensureAutoState(account) {
    if (!account.repas || typeof account.repas !== "object") {
      account.repas = {
        "Petit-déjeuner": false,
        "Déjeuner": false,
        "Dîner": false,
      };
    }

    if (!account.repasAutoJournal || typeof account.repasAutoJournal !== "object") {
      account.repasAutoJournal = {
        "Petit-déjeuner": false,
        "Déjeuner": false,
        "Dîner": false,
      };
    }

    MEALS.forEach((meal) => {
      if (!(meal in account.repas)) account.repas[meal] = false;
      if (!(meal in account.repasAutoJournal)) account.repasAutoJournal[meal] = false;
    });

    return account.repasAutoJournal;
  }

  function syncMealsFromJournal({ refresh = false } = {}) {
    if (typeof obtenirCompteActif !== "function") return false;

    const account = obtenirCompteActif();
    if (!account) return false;

    const auto = ensureAutoState(account);
    const presence = U?.journalMealPresence
      ? U.journalMealPresence(account.journalCalories || [])
      : {
          "Petit-déjeuner": (account.journalCalories || []).some((entry) => entry.repasSlot === "Petit-déjeuner"),
          "Déjeuner": (account.journalCalories || []).some((entry) => entry.repasSlot === "Déjeuner"),
          "Dîner": (account.journalCalories || []).some((entry) => entry.repasSlot === "Dîner"),
        };

    let changed = false;

    MEALS.forEach((meal) => {
      if (presence[meal]) {
        if (account.repas[meal] !== true) {
          account.repas[meal] = true;
          changed = true;
        }
        if (auto[meal] !== true) {
          auto[meal] = true;
          changed = true;
        }
        return;
      }

      if (auto[meal] === true) {
        if (account.repas[meal] !== false) {
          account.repas[meal] = false;
          changed = true;
        }
        auto[meal] = false;
        changed = true;
      }
    });

    if (changed && typeof sauvegarderEtatApplication === "function") {
      sauvegarderEtatApplication();
    }

    if (changed && refresh && typeof rafraichirApplication === "function") {
      queueMicrotask(() => rafraichirApplication());
    }

    return changed;
  }

  function wrapMutation(name, refreshAfter) {
    const original = window[name];
    if (typeof original !== "function" || original.__wellnessMealSyncWrapped) return;

    const wrapped = function wellnessMealSyncMutation(...args) {
      const result = original.apply(this, args);
      if (result && typeof result.then === "function") {
        return result.then((value) => {
          if (value !== false) syncMealsFromJournal({ refresh: refreshAfter });
          return value;
        });
      }
      if (result !== false) syncMealsFromJournal({ refresh: refreshAfter });
      return result;
    };

    wrapped.__wellnessMealSyncWrapped = true;
    wrapped.__wellnessMealSyncOriginal = original;
    window[name] = wrapped;
  }

  wrapMutation("ajouterCaloriesAuJournal", false);
  wrapMutation("modifierEntreeJournal", true);
  wrapMutation("supprimerEntreeJournal", true);

  syncMealsFromJournal({ refresh: true });

  window.WellnessMealJournalSync = {
    sync: syncMealsFromJournal,
  };
})();
`;
}

write("food-v42.js", food);

let tests = read("scripts/test-food-v42.mjs");

if (!tests.includes("journal valide petit-déjeuner")) {
  const insertion = `
test("journal valide petit-déjeuner", () => {
  const p = U.journalMealPresence([{ repasSlot: "Petit-déjeuner" }]);
  if (!p["Petit-déjeuner"] || p["Déjeuner"] || p["Dîner"]) throw new Error("présence repas incorrecte");
});
test("journal valide plusieurs repas", () => {
  const p = U.journalMealPresence([
    { repasSlot: "Petit-déjeuner" },
    { repasSlot: "Déjeuner" },
    { repasSlot: "Collation" },
  ]);
  if (!p["Petit-déjeuner"] || !p["Déjeuner"] || p["Dîner"]) throw new Error("présence multiple incorrecte");
});
test("collation ne valide pas un des 3 repas", () => {
  const p = U.journalMealPresence([{ repasSlot: "Collation" }]);
  if (Object.values(p).some(Boolean)) throw new Error("la collation ne doit pas compter dans 0/3 repas");
});
test("journal vide ne valide aucun repas", () => {
  const p = U.journalMealPresence([]);
  if (Object.values(p).some(Boolean)) throw new Error("journal vide incorrect");
});
`;
  tests = tests.replace(
    'console.log(`\\n${ok} / ${total} tests Food Database réussis`);',
    insertion + '\nconsole.log(`\\n${ok} / ${total} tests Food Database réussis`);'
  );
}

write("scripts/test-food-v42.mjs", tests);

const pkg = JSON.parse(read("package.json"));
pkg.version = "4.2.1";
pkg.description = "Wellness 4.2.1 - Food Database & automatic meal sync";
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let hardening = read("hardening-core.js");
hardening = hardening.replace('const APP_VERSION = "4.2.0";', 'const APP_VERSION = "4.2.1";');
write("hardening-core.js", hardening);

let sw = read("sw.js");
sw = sw.replace('const CACHE = "wellness-4.2.0";', 'const CACHE = "wellness-4.2.1";');
write("sw.js", sw);

let index = read("index.html");
index = index.replace(/Wellness 4\.2(?!\.\d)/g, "Wellness 4.2.1");
write("index.html", index);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="4\.2\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="4.2.1-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "4\.2\.0"/g, '"appVersion": "4.2.1"');
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 4.2.1 installée.");
console.log("Le journal valide maintenant automatiquement Petit-déjeuner, Déjeuner et Dîner dans Aujourd'hui.");
console.log("Supprimer ou déplacer le dernier aliment d'un repas retire aussi sa validation automatique.");
