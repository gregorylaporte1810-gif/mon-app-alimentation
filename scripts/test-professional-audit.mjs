import assert from "node:assert/strict";
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
