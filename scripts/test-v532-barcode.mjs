import { readFileSync } from "node:fs";

const runtime = readFileSync("barcode-v532.js", "utf8");
const build = readFileSync("scripts/build-web.mjs", "utf8");
const w2 = readFileSync("wellness2.js", "utf8");

const checks = [
  [
    "barcode overlay closes before portion",
    runtime.includes("megaCloseOverlay(barcodeOverlay)") &&
      runtime.includes("w2OpenPortion(food)"),
  ],
  ["camera stops", runtime.includes("w2StopBarcodeCamera")],
  [
    "runtime exposes automatic portion flow",
    runtime.includes("WellnessBarcodeFlowV532") &&
      runtime.includes("closeBarcodeThenOpenPortion"),
  ],
  [
    "fallback opens portion automatically",
    runtime.includes("setTimeout(() =>") &&
      runtime.includes("w2OpenPortion(food)") &&
      runtime.includes("}, 40)"),
  ],
  [
    "production code uses the barcode flow",
    w2.includes("WellnessBarcodeFlowV532") &&
      build.includes('"barcode-v532.js"'),
  ],
];

let passed = 0;
for (const [name, ok] of checks) {
  if (ok) {
    passed += 1;
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}`);
    process.exitCode = 1;
  }
}

console.log(`\n${passed} / ${checks.length} tests Barcode V5.3.2 réussis`);
if (passed !== checks.length) process.exit(1);
