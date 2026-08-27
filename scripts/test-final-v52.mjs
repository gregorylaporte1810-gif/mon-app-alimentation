import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync("final-v52-core.js", "utf8");
const context = { console, Intl, Date };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);

const C = context.WellnessFinalCoreV52;
let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const assert = (ok, msg = "assertion") => { if (!ok) throw new Error(msg); };

test("format semaine française même mois", () => {
  assert(C.frenchWeekRange("2026-08-24", "2026-08-30") === "24 → 30 août");
});

test("format semaine française deux mois", () => {
  const s = C.frenchWeekRange("2026-08-31", "2026-09-06");
  assert(s.includes("31") && s.includes("6"));
});

test("query sauvegarde reconnue comme réglage", () => {
  assert(C.isLikelySettingsQuery("sauvegarde", ["Sauvegarde et restauration"]) === true);
});

test("query poulet non réglage", () => {
  assert(C.isLikelySettingsQuery("poulet", ["Sauvegarde et restauration"]) === false);
});

test("food exact très fort", () => {
  assert(C.foodQueryStrength({ name: "Riz" }, "riz") === 1000);
});

test("food starts strong", () => {
  assert(C.foodQueryStrength({ name: "Riz basmati cuit" }, "riz") >= 800);
});

test("faux food sauvegarde faible", () => {
  assert(C.foodQueryStrength({ name: "Préparation à base de fromage pour fondue savoyarde" }, "sauvegarde") < 650);
});

test("simple rice ranks above rice dessert", () => {
  const simple = C.simpleFoodRank({ name: "Riz basmati cuit" }, "riz");
  const dessert = C.simpleFoodRank({ name: "Riz au lait vanille, rayon frais" }, "riz");
  assert(simple > dessert);
});

test("empty meal compact", () => {
  assert(C.compactEmptyMeal([]) === true);
});

test("non-empty meal stays expanded", () => {
  assert(C.compactEmptyMeal([{ nom: "Riz" }]) === false);
});

test("health blocked is compact", () => {
  const state = C.healthDisplayState({ entitlementBlocked: true });
  assert(state.kind === "blocked" && state.compact);
});

test("health installed without data", () => {
  const state = C.healthDisplayState({ last: {} });
  assert(state.kind === "installed");
});

test("health ready with real data", () => {
  const state = C.healthDisplayState({ last: { steps: 5000 } });
  assert(state.kind === "ready" && !state.compact);
});

test("graph empty detection", () => {
  assert(C.graphEmpty("Aucune donnée. Ajoute des pesées pour voir ta courbe.") === true);
});

for (const [name, fn] of tests) {
  try {
    fn();
    passed += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed} / ${tests.length} tests Final V5.2 réussis`);
if (passed !== tests.length) process.exit(1);
