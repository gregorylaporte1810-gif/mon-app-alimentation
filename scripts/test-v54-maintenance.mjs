import fs from "node:fs";

const read = (f) => fs.readFileSync(f, "utf8");
const checks = [];

const ota = read("ota-updater.js");
checks.push(["OTA blocks downgrade", ota.includes("downgrade refusé") && ota.includes("manifestSafeForInstall")]);
checks.push(["OTA checks schema", ota.includes("SUPPORTED_SCHEMA_VERSION")]);

const sw = read("sw.js");
checks.push(["SW navigation-only HTML fallback", sw.includes('event.request.mode === "navigate"')]);
checks.push(["SW cache version 5.4.0", sw.includes('wellness-5.4.0')]);

const index = read("index.html");
checks.push(["CSP present", index.includes("Content-Security-Policy")]);
checks.push(["No inline theme bootstrap", index.includes('src="theme-bootstrap.js"')]);

const manifest = JSON.parse(read("manifest.webmanifest"));
checks.push(["Manifest current", manifest.short_name === "Wellness" && /Wellness 5/.test(manifest.name)]);

const native = read("native-bridge.js");
checks.push(["Native backup deep validation", native.includes("WellnessHardeningCore?.validateBackup")]);

const hard = read("hardening-core.js");
checks.push(["Hardening version 5.4.0", hard.includes('const APP_VERSION = "5.4.0"')]);
checks.push(["Deep backup checks", hard.includes("validateAccountEntries")]);

const build = read("scripts/build-web.mjs");
checks.push(["Theme bootstrap in build", build.includes('"theme-bootstrap.js"')]);

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
console.log(`\n${passed} / ${checks.length} tests Maintenance V5.4 réussis`);
if (passed !== checks.length) process.exit(1);
