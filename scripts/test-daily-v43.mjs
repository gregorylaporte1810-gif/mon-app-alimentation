import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync("daily-ux-core-v43.js", "utf8");
const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);
const C = context.WellnessDailyCoreV43;

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const eq = (a, b, tolerance = 0.001) => {
  if (Math.abs(Number(a) - Number(b)) > tolerance) throw new Error(`attendu ${b}, reçu ${a}`);
};

test("previousDay traverse le mois", () => {
  if (C.previousDay("2026-09-01") !== "2026-08-31") throw new Error("date incorrecte");
});
test("foodKey utilise id", () => {
  if (C.foodKey({ id: "ciqual-1", name: "Pomme" }) !== "ciqual-1") throw new Error("clé incorrecte");
});
test("entryKey distingue les portions", () => {
  const a = C.entryKey({ foodId: "x", quantity: 100, unit: "g" });
  const b = C.entryKey({ foodId: "x", quantity: 200, unit: "g" });
  if (a === b) throw new Error("portions identiques");
});
test("cloneEntry retire id", () => {
  const c = C.cloneEntry({ id: "x", nom: "Banane", calories: 89 });
  if ("id" in c || c.nom !== "Banane") throw new Error("clone incorrect");
});
test("mealTotals calories", () => {
  const t = C.mealTotals([{ repasSlot: "Déjeuner", calories: 300 }, { repasSlot: "Déjeuner", calories: 200 }], "Déjeuner");
  eq(t.calories, 500);
});
test("mealTotals macros", () => {
  const t = C.mealTotals([{ proteines: 20, glucides: 30, lipides: 10, fibres: 4 }]);
  eq(t.protein, 20); eq(t.carbs, 30); eq(t.fat, 10); eq(t.fiber, 4);
});
test("mealTotals qualité", () => {
  const t = C.mealTotals([{ sucres: 12, grasSatures: 3, sel: 1.2 }]);
  eq(t.sugars, 12); eq(t.saturatedFat, 3); eq(t.salt, 1.2);
});
test("repère fibres 30 g", () => eq(C.qualityTargets(2000).fiber, 30));
test("repère sel 5 g", () => eq(C.qualityTargets(2000).salt, 5));
test("saturés dépendent des calories", () => eq(C.qualityTargets(1800).saturatedFat, 20));
test("rankUsage récent", () => {
  const r = C.rankUsage({ a: { entry: {}, lastUsedAt: "2026-01-01" }, b: { entry: {}, lastUsedAt: "2026-01-02" } }, "recent", 1);
  if (r[0].lastUsedAt !== "2026-01-02") throw new Error("tri incorrect");
});
test("rankUsage fréquent", () => {
  const r = C.rankUsage({ a: { entry: {}, count: 2 }, b: { entry: {}, count: 5 } }, "frequent", 1);
  if (r[0].count !== 5) throw new Error("tri incorrect");
});
test("reconnaît eau minérale", () => {
  if (!C.isPlainWaterName("Eau minérale naturelle")) throw new Error("eau non reconnue");
});
test("eau de coco non comptée", () => {
  if (C.isPlainWaterName("Eau de coco")) throw new Error("faux positif");
});
test("500 ml eau", () => eq(C.entryWaterMl({ nom: "Eau", quantity: 500, unit: "ml" }), 500));
test("50 cl eau", () => eq(C.entryWaterMl({ nom: "Eau gazeuse", quantity: 50, unit: "cl" }), 500));
test("1 L eau", () => eq(C.entryWaterMl({ nom: "Eau", quantity: 1, unit: "l" }), 1000));
test("jus non compté comme eau", () => eq(C.entryWaterMl({ nom: "Jus d'orange", quantity: 500, unit: "ml" }), 0));
test("500 ml = 2 verres de 250", () => eq(C.waterGlasses(500, 250), 2));
test("330 ml arrondi au quart de verre", () => eq(C.waterGlasses(330, 250), 1.25));
test("suggestion protéinée mieux notée si protéines manquent", () => {
  const high = C.suggestionScore({ kcal: 150, protein: 25, fiber: 1 }, { remainingCalories: 500, proteinRemaining: 40, fiberRemaining: 10 });
  const low = C.suggestionScore({ kcal: 150, protein: 2, fiber: 1 }, { remainingCalories: 500, proteinRemaining: 40, fiberRemaining: 10 });
  if (!(high > low)) throw new Error("score protéine incorrect");
});
test("diverseSuggestions limite le nombre", () => {
  const foods = Array.from({ length: 10 }, (_, i) => ({ name: `F${i}`, category: `C${i}`, kcal: 100 + i, protein: i }));
  if (C.diverseSuggestions(foods, { remainingCalories: 1000, proteinRemaining: 30 }, 5).length !== 5) throw new Error("limite incorrecte");
});
test("trimDailyJournals limite à 90", () => {
  const daily = {};
  for (let i = 0; i < 100; i++) daily[`2026-01-${String(i + 1).padStart(3, "0")}`] = [];
  if (Object.keys(C.trimDailyJournals(daily, 90)).length !== 90) throw new Error("rétention incorrecte");
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
console.log(`\n${passed} / ${tests.length} tests Daily UX réussis`);
if (passed !== tests.length) process.exit(1);
