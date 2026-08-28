import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import vm from "node:vm";

const root = process.cwd();

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(String(key), String(value));
  }

  removeItem(key) {
    this.values.delete(String(key));
  }
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function jwtWithRole(role) {
  return `${base64Url({ alg: "HS256", typ: "JWT" })}.${base64Url({ role })}.signature`;
}

globalThis.window = globalThis;
globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  text: async () => "{}",
});

vm.runInThisContext(fs.readFileSync(`${root}/cloud.js`, "utf8"), {
  filename: "cloud.js",
});

const Cloud = globalThis.WellnessCloud;
let passed = 0;
const tests = [];

function test(name, fn) {
  tests.push([name, fn]);
}

test("Supabase config normalizes the official HTTPS origin", () => {
  const value = Cloud.setConfig({
    url: "https://demo-project.supabase.co/",
    anonKey: "sb_publishable_demo",
  });

  assert.deepEqual(value, {
    url: "https://demo-project.supabase.co",
    anonKey: "sb_publishable_demo",
  });
});

test("Supabase config rejects non-HTTPS URLs", () => {
  assert.throws(
    () =>
      Cloud.setConfig({
        url: "http://demo-project.supabase.co",
        anonKey: "sb_publishable_demo",
      }),
    /HTTPS/,
  );
});

test("Supabase config rejects non-Supabase origins", () => {
  assert.throws(
    () =>
      Cloud.setConfig({
        url: "https://example.com",
        anonKey: "sb_publishable_demo",
      }),
    /supabase\.co/,
  );
});

test("Supabase config rejects secret API keys", () => {
  assert.throws(
    () =>
      Cloud.setConfig({
        url: "https://demo-project.supabase.co",
        anonKey: "sb_secret_do-not-use-client-side",
      }),
    /service-role\/secret/,
  );
});

test("Supabase config rejects service-role JWTs", () => {
  assert.throws(
    () =>
      Cloud.setConfig({
        url: "https://demo-project.supabase.co",
        anonKey: jwtWithRole("service_role"),
      }),
    /service-role\/secret/,
  );
});

test("Cloud requests explicitly avoid credentials and cache", () => {
  const source = fs.readFileSync(`${root}/cloud.js`, "utf8");

  assert.match(source, /cache:\s*"no-store"/);
  assert.match(source, /credentials:\s*"omit"/);
  assert.match(source, /referrerPolicy:\s*"no-referrer"/);
});

test("Supabase SQL setup is safely re-runnable", () => {
  const sql = fs.readFileSync(`${root}/SUPABASE_SETUP.sql`, "utf8");

  assert.match(sql, /drop policy if exists "Users can read their wellness data"/);
  assert.match(sql, /drop policy if exists "Users can delete their wellness data"/);
});

test("Supabase policies are limited to authenticated users", () => {
  const sql = fs.readFileSync(`${root}/SUPABASE_SETUP.sql`, "utf8");

  assert.match(
    sql,
    /create policy "Users can read their wellness data"[\s\S]*?to authenticated[\s\S]*?auth\.uid\(\) = user_id/,
  );
  assert.match(sql, /revoke all on table public\.wellness_sync from anon;/);
  assert.match(sql, /revoke all on table public\.wellness_sync from public;/);
});

test("quality workflow runs the complete professional verification", () => {
  const workflow = fs.readFileSync(
    `${root}/.github/workflows/quality.yml`,
    "utf8",
  );

  assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run verify/);
  assert.match(workflow, /npm audit --audit-level=high/);
  assert.match(workflow, /npm run cap:doctor/);
});

test("generated www bundle is ignored and not tracked", () => {
  const gitignore = fs.readFileSync(`${root}/.gitignore`, "utf8");
  const tracked = execFileSync("git", ["ls-files", "www"], {
    cwd: root,
    encoding: "utf8",
  }).trim();

  assert.match(gitignore, /^www\/$/m);
  assert.equal(tracked, "");
});

test("Codemagic device build rejects stale main commits", () => {
  const config = fs.readFileSync(`${root}/codemagic.yaml`, "utf8");

  assert.match(config, /if \[ "\$\{CM_BRANCH:-\}" = "main" \]; then/);
  assert.match(config, /git fetch origin main --depth=1/);
  assert.match(config, /HEAD_SHA.*MAIN_SHA/s);
  assert.match(
    config,
    /IPA_NAME="Wellness-\$\{VERSION\}-\$\{SHORT_SHA\}-unsigned\.ipa"/,
  );
});

test("OTA workflow derives versions from package.json", () => {
  const workflow = fs.readFileSync(
    `${root}/.github/workflows/ota-web-update.yml`,
    "utf8",
  );

  assert.match(
    workflow,
    /APP_VERSION="\$\(node -p "require\('\.\/package\.json'\)\.version"\)"/,
  );
  assert.match(workflow, /VERSION="\$\{APP_VERSION\}-\$\{GITHUB_SHA::12\}"/);
  assert.match(workflow, /"appVersion": "\$\{APP_VERSION\}"/);
  assert.match(workflow, /"size": \$\{BUNDLE_SIZE\}/);
});

test("GitHub Actions checkout is pinned to an immutable commit", () => {
  const quality = fs.readFileSync(
    `${root}/.github/workflows/quality.yml`,
    "utf8",
  );
  const ota = fs.readFileSync(
    `${root}/.github/workflows/ota-web-update.yml`,
    "utf8",
  );
  const pinned = /uses:\s*actions\/checkout@[0-9a-f]{40}\b/;

  assert.match(quality, pinned);
  assert.match(ota, pinned);
});

test("TestFlight template uses reproducible install and native configuration", () => {
  const template = fs.readFileSync(
    `${root}/codemagic-testflight.template.yaml`,
    "utf8",
  );

  assert.match(template, /script:\s*npm ci/);
  assert.match(template, /npm run verify:ci/);
  assert.match(template, /node scripts\/configure-ios-native\.mjs/);
  assert.match(template, /com\.apple\.developer\.healthkit/);
});

test("obsolete one-off root patch scripts are removed", () => {
  const leftovers = fs
    .readdirSync(root)
    .filter((name) => /^(?:apply-|patch-)/.test(name));

  assert.deepEqual(leftovers, []);
  assert.equal(fs.existsSync(`${root}/download`), false);
});

test("professional repository policy files are present", () => {
  assert.equal(fs.existsSync(`${root}/SECURITY.md`), true);
  assert.equal(fs.existsSync(`${root}/CHANGELOG.md`), true);
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

console.log(`\n${passed} / ${tests.length} vérifications professionnelles réussies`);
if (passed !== tests.length) process.exitCode = 1;
