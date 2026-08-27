import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync("ux-v53-core.js", "utf8");
const context = { console };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);

const C = context.WellnessUsabilityCoreV53;
const tests = [];
let passed = 0;

const test = (name, fn) => tests.push([name, fn]);
const assert = (ok, message = "assertion") => { if (!ok) throw new Error(message); };

test("normal iPhone viewport unchanged", () => {
  const r = C.viewportRepair({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)",
    screenWidth: 393, screenHeight: 852, innerWidth: 393, innerHeight: 852,
  });
  assert(r.active === false);
});

test("abnormally wide iPhone viewport repaired", () => {
  const r = C.viewportRepair({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X)",
    screenWidth: 393, screenHeight: 852, innerWidth: 786, innerHeight: 1704,
  });
  assert(r.active === true && r.ratio >= 1.9);
});

test("landscape does not trigger viewport repair", () => {
  const r = C.viewportRepair({
    userAgent: "Mozilla/5.0 (iPhone)",
    screenWidth: 393, screenHeight: 852, innerWidth: 852, innerHeight: 393,
  });
  assert(r.active === false);
});

test("water is liquid", () => assert(C.isLiquid({ name: "Eau minérale gazeuse" })));
test("coffee is liquid", () => assert(C.isLiquid({ name: "Café sans sucre" })));
test("vinegar is liquid", () => assert(C.isLiquid({ name: "Vinaigre balsamique" })));
test("drinkable yogurt is liquid", () => assert(C.isLiquid({ name: "Yaourt à boire fraise" })));
test("basis ml is always liquid", () => assert(C.isLiquid({ name: "Produit", basisUnit: "ml" })));
test("rice is not liquid", () => assert(!C.isLiquid({ name: "Riz basmati cuit" })));

test("liquid units start with ml cl L", () => {
  const units = C.allowedUnits({ name: "Jus d'orange" });
  assert(units[0] === "ml" && units[1] === "cl" && units[2] === "l");
});

test("solid units stay mass based", () => {
  const units = C.allowedUnits({ name: "Poulet rôti" });
  assert(units.join(",") === "g,kg,unit");
});

test("liquid defaults to 250 ml", () => {
  const d = C.defaultQuantity({ name: "Lait demi-écrémé" });
  assert(d.value === 250 && d.unit === "ml");
});

test("litre accepts decimal quantities", () => {
  const c = C.stepConstraints("l");
  assert(c.min === 0.01 && c.step === 0.01);
});

test("steps can be reduced to zero", () => assert(C.sanitizeSteps(-500) === 0));
test("steps are rounded", () => assert(C.sanitizeSteps(1234.7) === 1235));
test("invalid steps rejected", () => assert(C.sanitizeSteps("abc") === null));

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

console.log(`\n${passed} / ${tests.length} tests Wellness V5.3 réussis`);
if (passed !== tests.length) process.exit(1);
