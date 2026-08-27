import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync("food-units-core.js", "utf8");
const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);

const U = context.WellnessFoodUnits;
let ok = 0;
let total = 0;
function test(name, fn) {
  total += 1;
  try {
    fn();
    ok += 1;
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
function eq(actual, expected, tolerance = 0.01) {
  if (Math.abs(Number(actual) - Number(expected)) > tolerance) {
    throw new Error(`attendu ${expected}, reçu ${actual}`);
  }
}

test("normalise les accents", () => {
  if (U.normalizeText("Pâtes Complètes") !== "pates completes") throw new Error("normalisation incorrecte");
});
test("500 g = 500 g de référence", () => eq(U.toReferenceAmount(500, "g", {}), 500));
test("0,5 kg = 500 g", () => eq(U.toReferenceAmount(0.5, "kg", {}), 500));
test("1 L d'eau = 1000 g", () => eq(U.toReferenceAmount(1, "l", { liquid: true, density: 1 }), 1000));
test("25 cl de lait ≈ 257,5 g", () => eq(U.toReferenceAmount(25, "cl", { liquid: true, density: 1.03 }), 257.5));
test("2 oeufs de 60 g = 120 g", () => eq(U.toReferenceAmount(2, "unit", { pieceWeight: 60 }), 120));
test("mise à l'échelle 250 g", () => {
  const n = U.scaleFood({ kcal: 100, protein: 10, carbs: 20, fat: 5, basisQuantity: 100, basisUnit: "g" }, 250, "g");
  eq(n.calories, 250);
  eq(n.protein, 25);
  eq(n.carbs, 50);
  eq(n.fat, 12.5);
});
test("mise à l'échelle 1 L", () => {
  const n = U.scaleFood({ kcal: 46, protein: 3.2, carbs: 4.8, fat: 1.6, basisQuantity: 100, basisUnit: "g", density: 1.03, liquid: true }, 1, "l");
  eq(n.calories, 474, 1);
});
test("formate les litres", () => {
  if (U.formatQuantity(1, "l") !== "1 L") throw new Error(U.formatQuantity(1, "l"));
});
test("formate les unités", () => {
  if (U.formatQuantity(2, "unit") !== "2 unités") throw new Error(U.formatQuantity(2, "unit"));
});
test("retire une ancienne quantité en grammes", () => {
  if (U.stripQuantitySuffix("Banane (100 g)") !== "Banane") throw new Error("suffixe non retiré");
});
test("retire une ancienne quantité en litres", () => {
  if (U.stripQuantitySuffix("Eau (1 L)") !== "Eau") throw new Error("suffixe non retiré");
});

console.log(`\n${ok} / ${total} tests Food Database réussis`);
if (ok !== total) process.exit(1);
