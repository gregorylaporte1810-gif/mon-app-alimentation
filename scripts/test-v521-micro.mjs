import { readFileSync } from "node:fs";

const css = readFileSync("style.css", "utf8");

const checks = [
  ["marker V5.2.1", css.includes("WELLNESS V5.2.1 — MICRO POLISH")],
  ["empty journal CTA hidden", css.includes(".px-journal-empty") && css.includes("display: none !important")],
  ["empty journal actions hidden", css.includes(".v43-meal-actions")],
  ["FAB 50px desktop", css.includes("width: 50px !important")],
  ["FAB 48px small iPhone", css.includes("width: 48px !important")],
  ["extra bottom clearance", css.includes("padding-bottom: calc(172px + env(safe-area-inset-bottom))")],
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

console.log(`\n${passed} / ${checks.length} tests V5.2.1 réussis`);
if (passed !== checks.length) process.exit(1);
