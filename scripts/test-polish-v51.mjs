import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync("polish-v51-core.js", "utf8");
const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);

const C = context.WellnessPolishCoreV51;
let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const assert = (value, message = "assertion") => { if (!value) throw new Error(message); };

test("evening hidden before 18h", () => assert(C.shouldShowEveningSummary(17) === false));
test("evening shown at 18h", () => assert(C.shouldShowEveningSummary(18) === true));
test("evening preview forced", () => assert(C.shouldShowEveningSummary(9, true) === true));

test("dedupe repeated date labels", () => {
  const result = C.labelsToHide(["27/08", "27/08", "28/08"]);
  assert(result[0] === false && result[1] === true && result[2] === false);
});

test("does not dedupe weekday initials", () => {
  const result = C.labelsToHide(["M", "M", "J"]);
  assert(result.every((x) => x === false));
});

test("home prefs defaults visible", () => {
  const p = C.mergeHomePrefs({});
  assert(Object.values(p).every(Boolean));
});

test("home prefs keep hidden coach", () => {
  assert(C.mergeHomePrefs({ coach: false }).coach === false);
});

test("evening summary produces max two tips", () => {
  const result = C.eveningSummary({
    account: { objectifCalories: 2000, macroTargets: { protein: 150 }, objectifEau: 8, verresEau: 2, objectifPas: 10000, pasEffectues: 1000 },
    totals: { calories: 600, protein: 40, fiber: 5 },
    goals: { fiberDaily: 30, sleepAverage: 8 },
    sleepHours: 6,
  });
  assert(result.tips.length === 2);
});

test("empty activity action", () => {
  assert(C.emptyStateAction("Aucune activité ajoutée aujourd'hui.") === "Ajouter une activité");
});

test("empty food action", () => {
  assert(C.emptyStateAction("Aucun aliment trouvé.") === "Ajouter un aliment");
});

test("universal exact score", () => {
  assert(C.universalMatchScore("Apple Santé", "Apple Santé") === 1000);
});

test("universal partial score", () => {
  assert(C.universalMatchScore("Sauvegarde et restauration", "sauvegarde") > 0);
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
console.log(`\n${passed} / ${tests.length} tests Polish V5.1 réussis`);
if (passed !== tests.length) process.exit(1);
