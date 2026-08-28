import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const layout = read("layout-v541.js");
const viewport = read("viewport-v53.js");
const style = read("style.css");
const index = read("index.html");
const hard = read("hardening-core.js");

const checks = [
  ["journal moved to Today logic", layout.includes("mealsMarker.replaceWith(journal)")],
  ["meal validation moved to Nutrition logic", layout.includes("journalMarker.replaceWith(meals)")],
  ["meal validation renamed", layout.includes("Validation des repas")],
  ["old CSS zoom repair removed from runtime", !viewport.includes("style.setProperty(\"--v53-mobile-scale\"")],
  ["viewport shrink-to-fit disabled", index.includes("shrink-to-fit=no")],
  ["responsive nutrition CSS installed", style.includes("WELLNESS V5.4.1 — RESPONSIVE IPHONE + CONTENT SWAP")],
  ["invalid journal cannot be iterated directly", !hard.includes("(account.journalCalories || []).forEach")],
  ["invalid weight history cannot be iterated directly", !hard.includes("(account.weightHistory || []).forEach")],
];

let passed = 0;
for (const [name, ok] of checks) {
  if (ok) {
    passed += 1;
    console.log("✅", name);
  } else {
    console.error("❌", name);
    process.exitCode = 1;
  }
}
console.log(`\n${passed} / ${checks.length} tests V5.4.1 réussis`);
if (passed !== checks.length) process.exit(1);
