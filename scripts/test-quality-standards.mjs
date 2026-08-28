import assert from "node:assert/strict";
import fs from "node:fs";

const VERSION = "5.6.0";
const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("HTML has one body/html closing tag and unique static ids", () => {
  const html = read("index.html");
  assert.equal((html.match(/<\/body>/gi) || []).length, 1);
  assert.equal((html.match(/<\/html>/gi) || []).length, 1);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
});

test("CSP avoids arbitrary HTTPS images and remote Google fonts", () => {
  const html = read("index.html");
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
  assert.match(html, /img-src 'self' data: blob:;/);
  assert.doesNotMatch(html, /img-src[^;]*\shttps:/);
  assert.match(html, /script-src 'self'/);
});

test("runtime version identifiers are consistent", () => {
  const expected = VERSION.replaceAll(".", "\\.");
  assert.equal(JSON.parse(read("package.json")).version, VERSION);
  assert.match(read("hardening-core.js"), new RegExp(`APP_VERSION = ["']${expected}["']`));
  assert.match(read("ota-updater.js"), new RegExp(`BUNDLED_APP_VERSION = ["']${expected}["']`));
  assert.match(read("wellness2.js"), new RegExp(`W2_VERSION = ["']${expected}["']`));
  assert.match(read("sw.js"), new RegExp(`wellness-${expected}`));
  assert.match(read("index.html"), new RegExp(`Wellness ${expected}`));
});

test("Open Food Facts uses v3 with timeout and privacy safeguards", () => {
  const source = read("wellness2.js");
  assert.match(source, /openfoodfacts\.org\/api\/v3\/product/);
  assert.doesNotMatch(source, /openfoodfacts\.org\/api\/v2\/product/);
  assert.match(source, /app_name/);
  assert.match(source, /app_version/);
  assert.match(source, /User-Agent/);
  assert.match(source, /AbortController/);
  assert.match(source, /response\.status === 429/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /referrerPolicy: "no-referrer"/);
});

test("privacy, licensing and architecture documentation are present", () => {
  for (const file of ["PRIVACY.md", "THIRD_PARTY_NOTICES.md", "LICENSE", "ARCHITECTURE.md", "CONTRIBUTING.md"]) {
    assert.equal(fs.existsSync(file), true, `${file} absent`);
  }
  assert.match(read("THIRD_PARTY_NOTICES.md"), /Anses\. 2025\. Table de composition nutritionnelle des aliments Ciqual/);
  assert.match(read("THIRD_PARTY_NOTICES.md"), /Open Database License|ODbL/);
});

test("legal and accessibility runtime is included in production", () => {
  const html = read("index.html");
  const build = read("scripts/build-web.mjs");
  const sw = read("sw.js");
  const legal = read("legal.js");
  assert.match(html, /src="legal\.js"/);
  assert.match(build, /"legal\.js"/);
  assert.match(sw, /"\.\/legal\.js"/);
  assert.match(legal, /aria-current/);
  assert.match(legal, /aria-live/);
  assert.match(legal, /w56-allergy-note/);
});

test("PWA manifest has stable identity and French locale", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, "./");
  assert.equal(manifest.lang, "fr");
  assert.deepEqual(manifest.display_override, ["standalone", "minimal-ui"]);
});

test("CI and Codemagic use reproducible supported Node runtimes", () => {
  const workflow = read(".github/workflows/quality.yml");
  assert.match(workflow, /runs-on: ubuntu-24\.04/);
  assert.match(workflow, /actions\/setup-node@[0-9a-f]{40}/);
  assert.match(workflow, /node-version: 22\.23\.2/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(read("codemagic.yaml"), /node: v22\.23\.2/);
});

test("production script references resolve to tracked source files", () => {
  const html = read("index.html");
  const refs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(refs.length > 10);
  for (const ref of refs) assert.equal(fs.existsSync(ref), true, `${ref} absent`);
});

test("large legacy modules cannot grow silently", () => {
  const limits = { "app.js": 140000, "wellness2.js": 90000, "style.css": 300000 };
  for (const [file, max] of Object.entries(limits)) {
    assert.ok(
      fs.statSync(file).size <= max,
      `${file} dépasse ${max} octets : refactorisation requise`,
    );
  }
});

for (const [name, fn] of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✕ ${name}\n  ${error.message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${passed} / ${tests.length} contrôles qualité 5.6 réussis`);
if (passed !== tests.length) process.exitCode = 1;
