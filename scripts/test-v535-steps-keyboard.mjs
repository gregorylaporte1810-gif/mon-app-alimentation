import { readFileSync } from "node:fs";

const ux = readFileSync("ux-v53.js", "utf8");

const checks = [
  ["no automatic input focus", !ux.includes("input?.focus();")],
  ["no automatic select", !ux.includes("input?.select?.();")],
  ["input is explicitly blurred", ux.includes("input?.blur?.();")],
  ["sheet resets to top", ux.includes('querySelector(".v53-steps-sheet")?.scrollTo?.')],
  ["new help text mentions shortcuts", ux.includes("Utilise les raccourcis")],
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

console.log(`\n${passed} / ${checks.length} tests Steps Keyboard V5.3.5 réussis`);
if (passed !== checks.length) process.exit(1);
