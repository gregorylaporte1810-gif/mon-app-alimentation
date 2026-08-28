import { readFileSync } from "node:fs";

const runtime = readFileSync("barcode-v534.js", "utf8");
const build = readFileSync("scripts/build-web.mjs", "utf8");

const checks = [
  ["listens to choose quantity button", runtime.includes('#w2-add-barcode-product')],
  ["closes barcode overlay", runtime.includes("megaCloseOverlay(barcode)")],
  ["keeps portion modal active", runtime.includes('portion?.classList.contains("ouverte")')],
  ["stops camera", runtime.includes("w2StopBarcodeCamera")],
  ["runs after original button listener", runtime.includes("setTimeout(() =>")],
  [
    "runtime is included in production build",
    runtime.includes("WellnessBarcodeButtonCloseV534") &&
      build.includes('"barcode-v534.js"'),
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
console.log(`\n${passed} / ${checks.length} tests Barcode V5.3.4 réussis`);
if (passed !== checks.length) process.exit(1);
