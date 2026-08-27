import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync("smart-v44-core.js", "utf8");
const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);
const C = context.WellnessSmartCoreV44;

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const assert = (ok, msg = "assertion") => { if (!ok) throw new Error(msg); };
const eq = (a, b, tol = .001) => assert(Math.abs(Number(a) - Number(b)) <= tol, `attendu ${b}, reçu ${a}`);

test("startOfWeek lundi", () => assert(C.startOfWeek("2026-08-27") === "2026-08-24"));
test("weekKeys 7 jours", () => assert(C.weekKeys("2026-08-24").length === 7));
test("levenshtein poulé poulet", () => eq(C.levenshtein("poulé", "poulet"), 1));
test("fuzzy retrouve poulet avec faute", () => {
  const foods = [{ name: "Poulet rôti", kcal: 180 }, { name: "Riz", kcal: 130 }];
  assert(C.fuzzyFoodSearch(foods, "poulé")[0].name === "Poulet rôti");
});
test("fuzzy exact prioritaire", () => {
  const foods = [{ name: "Riz au lait" }, { name: "Riz" }];
  assert(C.fuzzyFoodSearch(foods, "riz")[0].name === "Riz");
});
test("parse 250 g riz déjeuner", () => {
  const p = C.parseQuickEntry("250 g riz déjeuner");
  eq(p.quantity, 250); assert(p.unit === "g"); assert(p.meal === "Déjeuner"); assert(p.query === "riz");
});
test("parse 1 banane collation", () => {
  const p = C.parseQuickEntry("1 banane collation");
  eq(p.quantity, 1); assert(p.unit === "unit"); assert(p.meal === "Collation"); assert(p.query === "banane");
});
test("parse 50 cl eau", () => {
  const p = C.parseQuickEntry("50 cl eau");
  eq(p.quantity, 50); assert(p.unit === "cl"); assert(p.query === "eau");
});
test("journal totals", () => {
  const t = C.journalTotals([{ calories: 100, proteines: 10, fibres: 4 }, { calories: 200, proteines: 20, fibres: 6 }]);
  eq(t.calories, 300); eq(t.protein, 30); eq(t.fiber, 10);
});
test("week summary moyenne jours suivis", () => {
  const daily = { "2026-08-24": [{ calories: 1000, proteines: 80 }], "2026-08-25": [{ calories: 2000, proteines: 120 }] };
  const s = C.weekSummary(daily, "2026-08-24");
  eq(s.avgCalories, 1500); eq(s.avgProtein, 100); eq(s.nutritionDays, 2);
});
test("week summary activité", () => {
  const s = C.weekSummary({}, "2026-08-24", { activities: [{ date: "2026-08-24", duration: 30 }, { date: "2026-08-25", duration: 20 }] });
  eq(s.activityMinutes, 50); eq(s.workouts, 2);
});
test("week insights fibres basses", () => {
  const list = C.weeklyInsights({ nutritionDays: 5, avgFiber: 10, avgProtein: 100, avgCalories: 2000, avgSleep: 8, activityMinutes: 200, workouts: 3 }, {}, { fiberDaily: 30, sleepAverage: 7.5, weeklyActivityMinutes: 150, weeklyWorkouts: 3 }, 2000, 100);
  assert(list.some((x) => x.includes("fibres")));
});
test("recipe totals", () => {
  const t = C.recipeTotals([{ nutrition: { calories: 200, protein: 20 } }, { nutrition: { calories: 300, protein: 10 } }]);
  eq(t.calories, 500); eq(t.protein, 30);
});
test("meal signature indépendante ordre", () => {
  const a = C.normalizeMealSignature([{ repasSlot: "Déjeuner", nom: "Riz (200 g)" }, { repasSlot: "Déjeuner", nom: "Poulet (150 g)" }], "Déjeuner");
  const b = C.normalizeMealSignature([{ repasSlot: "Déjeuner", nom: "Poulet (100 g)" }, { repasSlot: "Déjeuner", nom: "Riz (100 g)" }], "Déjeuner");
  assert(a === b);
});
test("habit détectée 3 fois", () => {
  const daily = {};
  ["2026-08-26","2026-08-25","2026-08-24"].forEach((d) => daily[d] = [{ repasSlot:"Petit-déjeuner", nom:"Banane (1 unité)" }]);
  assert(C.detectMealHabits(daily, { endKey:"2026-08-27", minOccurrences:3 })[0].count === 3);
});
test("adaptive needs 14 days", () => {
  assert(C.adaptiveCalorieSuggestion([{ date:"2026-08-20", weight:80 }, { date:"2026-08-27", weight:79.8 }], "loss", 2000) === null);
});
test("adaptive loss stable suggests -100", () => {
  const h = [
    { date:"2026-08-01", weight:80 }, { date:"2026-08-08", weight:80 },
    { date:"2026-08-15", weight:79.95 }, { date:"2026-08-22", weight:79.9 },
  ];
  const s = C.adaptiveCalorieSuggestion(h, "loss", 2000);
  assert(s && s.delta === -100);
});
test("priorities top 3", () => {
  const p = C.priorities({ account:{objectifEau:8,verresEau:0,objectifPas:10000,pasEffectues:0,macroTargets:{protein:150},objectifCalories:2000}, totals:{protein:0,fiber:0,calories:0}, goals:{fiberDaily:30} });
  assert(p.length === 3);
});
test("calendar feb leap", () => assert(C.calendarCells(2028,1).filter(Boolean).length === 29));

for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`✅ ${name}`); }
  catch (error) { console.error(`❌ ${name}: ${error.message}`); process.exitCode = 1; }
}
console.log(`\n${passed} / ${tests.length} tests Smart V4.4 réussis`);
if (passed !== tests.length) process.exit(1);
