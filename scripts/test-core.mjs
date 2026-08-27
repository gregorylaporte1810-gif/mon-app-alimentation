import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = process.cwd();
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(`${root}/core-utils.js`, "utf8"), { filename: "core-utils.js" });
vm.runInThisContext(fs.readFileSync(`${root}/hardening-core.js`, "utf8"), { filename: "hardening-core.js" });

const C = globalThis.WellnessCore;
const H = globalThis.WellnessHardeningCore;
let passed = 0;
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function near(a, b, t = 0.2) { assert.ok(Math.abs(a - b) <= t, `${a} n'est pas proche de ${b}`); }

// Nutrition / conversions
test("scaleFood 50 g calories", () => assert.equal(C.scaleFood({kcal:200},50).calories,100));
test("scaleFood 150 g protein", () => assert.equal(C.scaleFood({protein:10},150).protein,15));
test("scaleFood clamps negative grams", () => assert.equal(C.scaleFood({kcal:100},-50).calories,0));
test("kgToLb", () => near(C.kgToLb(10),22,0.2));
test("lbToKg", () => near(C.lbToKg(22),10,0.1));
test("round1", () => assert.equal(C.round1(1.26),1.3));
test("clamp lower", () => assert.equal(C.clamp(-2,0,10),0));
test("clamp upper", () => assert.equal(C.clamp(12,0,10),10));

// Scores
test("calorieAdherence exact", () => assert.equal(C.calorieAdherence(2000,2000),100));
test("calorieAdherence no target", () => assert.equal(C.calorieAdherence(2000,0),0));
test("macroAdherence capped", () => assert.equal(C.macroAdherence(200,100),100));
test("healthScore bounds", () => { const s=C.healthScore({waterPct:100,stepsPct:100,mealsPct:100,calories:2000,calorieTarget:2000,protein:120,proteinTarget:120,sleepHours:8,mood:5}); assert.ok(s>=95&&s<=100); });
test("healthScore empty", () => assert.equal(C.healthScore({}),0));
test("percentDelta", () => assert.equal(C.percentDelta(120,100),20));
test("percentDelta previous zero", () => assert.equal(C.percentDelta(10,0),null));

// Regression / forecast
test("linearRegression slope", () => near(C.linearRegression([{x:0,y:10},{x:1,y:12},{x:2,y:14}]).slope,2,0.001));
test("linearRegression insufficient", () => assert.equal(C.linearRegression([{x:0,y:10}]),null));
test("weightForecast needs target", () => assert.equal(C.weightForecast([],70),null));
test("weightForecast same-day keeps latest", () => { const r=C.weightForecast([{date:"2026-08-20",weight:80,createdAt:"2026-08-20T08:00:00Z"},{date:"2026-08-20",weight:79,createdAt:"2026-08-20T18:00:00Z"}],75,"loss"); assert.equal(r.current,79); });

// Preferences
test("vegetarian blocks chicken", () => assert.equal(C.recipeAllowed({nom:"Poulet",ingredients:[]},{diet:"vegetarian",allergies:[]}),false));
test("vegan blocks dairy", () => assert.equal(C.recipeAllowed({nom:"Skyr",ingredients:[]},{diet:"vegan",allergies:[]}),false));
test("pescatarian allows salmon", () => assert.equal(C.recipeAllowed({nom:"Saumon",ingredients:[]},{diet:"pescatarian",allergies:[]}),true));
test("no pork blocks ham", () => assert.equal(C.recipeAllowed({nom:"Jambon",ingredients:[]},{diet:"omnivore",noPork:true,allergies:[]}),false));
test("gluten allergy blocks bread", () => assert.equal(C.recipeAllowed({nom:"Pain complet",ingredients:[]},{diet:"omnivore",allergies:["gluten"]}),false));
test("disliked blocks ingredient", () => assert.equal(C.recipeAllowed({nom:"Salade",ingredients:["avocat"]},{diet:"omnivore",allergies:[],disliked:["avocat"]}),false));
test("recommendation score finite", () => assert.ok(Number.isFinite(C.recommendationScore({calories:500,proteines:30,temps:15},{remainingCalories:700,proteinRemaining:50,goalMode:"loss"}))));

// Hardening state / backup
const validApp = { compteActif:"a", comptes:{ a:{ journalCalories:[], progressPhotos:[], weightHistory:[], measurementHistory:[], repas:{} } } };
test("validate app ok", () => assert.equal(H.validateAppState(validApp).ok,true));
test("validate app missing active", () => assert.equal(H.validateAppState({compteActif:"x",comptes:{a:{}}}).ok,false));
test("validate app bad journal", () => assert.equal(H.validateAppState({compteActif:"a",comptes:{a:{journalCalories:{}}}}).ok,false));
test("backup schema", () => assert.equal(H.makeBackup(validApp).schemaVersion,4));
test("backup version", () => assert.equal(H.makeBackup(validApp).appVersion,"4.1.0"));
test("backup validation", () => assert.equal(H.validateBackup(H.makeBackup(validApp)).ok,true));
test("reject future backup", () => { const b=H.makeBackup(validApp); b.schemaVersion=99; assert.equal(H.validateBackup(b).ok,false); });

// Goal consistency
test("goal loss from weights", () => assert.equal(H.goalModeFromWeights(80,70),"loss"));
test("goal muscle from weights", () => assert.equal(H.goalModeFromWeights(70,80),"muscle"));
test("goal maintain from weights", () => assert.equal(H.goalModeFromWeights(70,70),"maintain"));
test("loss conflict equal weights", () => assert.equal(H.goalCompatible("loss",70,70),false));
test("maintain compatible equal", () => assert.equal(H.goalCompatible("maintain",70,70),true));
test("recomp independent of weight target", () => assert.equal(H.goalCompatible("recomp",70,80),true));

// Photo refs / timestamps / first measurement
test("photo ref roundtrip", () => { const ref=H.photoRef("compte a","photo/1"); assert.deepEqual(H.photoRefParts(ref),{accountId:"compte a",photoId:"photo/1"}); });
test("photo ref detection", () => assert.equal(H.isPhotoRef(H.photoRef("a","b")),true));
test("compareIso newer", () => assert.equal(H.compareIso("2026-08-27T10:00:00Z","2026-08-27T09:00:00Z"),1));
test("first measurement", () => assert.equal(H.firstMeasurementLabel(7.5,0,"h"),"Première mesure"));

// Static project checks
test("package version matches app", () => { const pkg=JSON.parse(fs.readFileSync(`${root}/package.json`,`utf8`)); assert.equal(pkg.version,H.APP_VERSION); });
test("build includes hardening", () => { const text=fs.readFileSync(`${root}/scripts/build-web.mjs`,`utf8`); assert.match(text,/hardening-core\.js/); assert.match(text,/hardening\.js/); });
test("service worker includes hardening", () => { const text=fs.readFileSync(`${root}/sw.js`,`utf8`); assert.match(text,/hardening-core\.js/); assert.match(text,/hardening\.js/); assert.match(text,/native-bridge\.js/); });
test("OTA updater knows dedicated branch", () => { const text=fs.readFileSync(`${root}/ota-updater.js`,`utf8`); assert.match(text,/\/ota\/latest\.json/); assert.match(text,/\/main\/ota\/latest\.json/); });

for (const [name, fn] of tests) {
  try { await fn(); passed += 1; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✕ ${name}\n  ${error.message}`); process.exitCode = 1; }
}
console.log(`\n${passed} / ${tests.length} tests réussis`);
if (passed !== tests.length) process.exitCode = 1;
