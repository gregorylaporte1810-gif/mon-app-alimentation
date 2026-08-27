import { readFileSync } from "node:fs";

const runtime = readFileSync("barcode-v532.js", "utf8");
const installer = readFileSync("apply-v532-barcode-flow.mjs", "utf8");

const checks = [
  ["barcode overlay closes before portion", runtime.includes("megaCloseOverlay(barcodeOverlay)") && runtime.includes("w2OpenPortion(food)")],
  ["camera stops", runtime.includes("w2StopBarcodeCamera")],
  ["installer patches automatic portion flow", installer.includes("WellnessBarcodeFlowV532.closeBarcodeThenOpenPortion(food)")],
  ["fallback opens portion automatically", installer.includes("setTimeout(() => w2OpenPortion(food), 40)")],
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
