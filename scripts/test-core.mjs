import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = process.cwd();
globalThis.window = globalThis;
vm.runInThisContext(fs.readFileSync(`${root}/core-utils.js`, "utf8"), {
  filename: "core-utils.js",
});
vm.runInThisContext(fs.readFileSync(`${root}/hardening-core.js`, "utf8"), {
  filename: "hardening-core.js",
});

const C = globalThis.WellnessCore;
const H = globalThis.WellnessHardeningCore;
let passed = 0;
const tests = [];
function test(name, fn) {
  tests.push([name, fn]);
}
function near(a, b, t = 0.2) {
  assert.ok(Math.abs(a - b) <= t, `${a} n'est pas proche de ${b}`);
}

// Nutrition / conversions
test("scaleFood 50 g calories", () =>
  assert.equal(C.scaleFood({ kcal: 200 }, 50).calories, 100));
test("scaleFood 150 g protein", () =>
  assert.equal(C.scaleFood({ protein: 10 }, 150).protein, 15));
test("scaleFood clamps negative grams", () =>
  assert.equal(C.scaleFood({ kcal: 100 }, -50).calories, 0));
test("kgToLb", () => near(C.kgToLb(10), 22, 0.2));
test("lbToKg", () => near(C.lbToKg(22), 10, 0.1));
test("round1", () => assert.equal(C.round1(1.26), 1.3));
test("clamp lower", () => assert.equal(C.clamp(-2, 0, 10), 0));
test("clamp upper", () => assert.equal(C.clamp(12, 0, 10), 10));

// Scores
test("calorieAdherence exact", () =>
  assert.equal(C.calorieAdherence(2000, 2000), 100));
test("calorieAdherence no target", () =>
  assert.equal(C.calorieAdherence(2000, 0), 0));
test("macroAdherence capped", () =>
  assert.equal(C.macroAdherence(200, 100), 100));
test("healthScore bounds", () => {
  const s = C.healthScore({
    waterPct: 100,
    stepsPct: 100,
    mealsPct: 100,
    calories: 2000,
    calorieTarget: 2000,
    protein: 120,
    proteinTarget: 120,
    sleepHours: 8,
    mood: 5,
  });
  assert.ok(s >= 95 && s <= 100);
});
test("healthScore empty", () => assert.equal(C.healthScore({}), 0));
test("percentDelta", () => assert.equal(C.percentDelta(120, 100), 20));
test("percentDelta previous zero", () =>
  assert.equal(C.percentDelta(10, 0), null));

// Regression / forecast
test("linearRegression slope", () =>
  near(
    C.linearRegression([
      { x: 0, y: 10 },
      { x: 1, y: 12 },
      { x: 2, y: 14 },
    ]).slope,
    2,
    0.001,
  ));
test("linearRegression insufficient", () =>
  assert.equal(C.linearRegression([{ x: 0, y: 10 }]), null));
test("weightForecast needs target", () =>
  assert.equal(C.weightForecast([], 70), null));
test("weightForecast same-day keeps latest", () => {
  const r = C.weightForecast(
    [
      { date: "2026-08-20", weight: 80, createdAt: "2026-08-20T08:00:00Z" },
      { date: "2026-08-20", weight: 79, createdAt: "2026-08-20T18:00:00Z" },
    ],
    75,
    "loss",
  );
  assert.equal(r.current, 79);
});

// Preferences
test("vegetarian blocks chicken", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Poulet", ingredients: [] },
      { diet: "vegetarian", allergies: [] },
    ),
    false,
  ));
test("vegan blocks dairy", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Skyr", ingredients: [] },
      { diet: "vegan", allergies: [] },
    ),
    false,
  ));
test("pescatarian allows salmon", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Saumon", ingredients: [] },
      { diet: "pescatarian", allergies: [] },
    ),
    true,
  ));
test("no pork blocks ham", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Jambon", ingredients: [] },
      { diet: "omnivore", noPork: true, allergies: [] },
    ),
    false,
  ));
test("gluten allergy blocks bread", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Pain complet", ingredients: [] },
      { diet: "omnivore", allergies: ["gluten"] },
    ),
    false,
  ));
test("disliked blocks ingredient", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Salade", ingredients: ["avocat"] },
      { diet: "omnivore", allergies: [], disliked: ["avocat"] },
    ),
    false,
  ));

test("vegan allows lettuce without dairy false positive", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Salade de laitue", ingredients: ["laitue", "tomate"] },
      { diet: "vegan", allergies: [] },
    ),
    true,
  ));

test("lactose allergy allows lettuce", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Laitue", ingredients: [] },
      { diet: "omnivore", allergies: ["lactose"] },
    ),
    true,
  ));

test("no pork blocks bacon", () =>
  assert.equal(
    C.recipeAllowed(
      { nom: "Oeufs au bacon", ingredients: ["oeufs", "bacon"] },
      { diet: "omnivore", noPork: true, allergies: [] },
    ),
    false,
  ));
test("recommendation score finite", () =>
  assert.ok(
    Number.isFinite(
      C.recommendationScore(
        { calories: 500, proteines: 30, temps: 15 },
        { remainingCalories: 700, proteinRemaining: 50, goalMode: "loss" },
      ),
    ),
  ));

// Hardening state / backup
const validApp = {
  compteActif: "a",
  comptes: {
    a: {
      journalCalories: [],
      progressPhotos: [],
      weightHistory: [],
      measurementHistory: [],
      repas: {},
    },
  },
};
test("validate app ok", () =>
  assert.equal(H.validateAppState(validApp).ok, true));
test("validate app missing active", () =>
  assert.equal(
    H.validateAppState({ compteActif: "x", comptes: { a: {} } }).ok,
    false,
  ));
test("validate app bad journal", () =>
  assert.equal(
    H.validateAppState({
      compteActif: "a",
      comptes: { a: { journalCalories: {} } },
    }).ok,
    false,
  ));
test("backup schema", () =>
  assert.equal(H.makeBackup(validApp).schemaVersion, 4));
test("backup version", () =>
  assert.equal(H.makeBackup(validApp).appVersion, H.APP_VERSION));
test("backup validation", () =>
  assert.equal(H.validateBackup(H.makeBackup(validApp)).ok, true));
test("reject future backup", () => {
  const b = H.makeBackup(validApp);
  b.schemaVersion = 99;
  assert.equal(H.validateBackup(b).ok, false);
});

// V5.5 security sanitization
test("sanitize removes photo AI token", () => {
  const clean = H.sanitizeForTransfer({
    settings: {
      photoAiEndpoint: "https://example.test/analyse",
      photoAiToken: "secret-ai-token",
    },
  });

  assert.equal(clean.settings.photoAiEndpoint, "https://example.test/analyse");
  assert.equal("photoAiToken" in clean.settings, false);
});

test("sanitize removes Supabase tokens", () => {
  const clean = H.sanitizeForTransfer({
    session: {
      access_token: "access-secret",
      refresh_token: "refresh-secret",
      expires_at: 123,
    },
  });

  assert.equal("access_token" in clean.session, false);
  assert.equal("refresh_token" in clean.session, false);
  assert.equal(clean.session.expires_at, 123);
});

test("sanitize removes generic credentials", () => {
  const clean = H.sanitizeForTransfer({
    nested: {
      token: "secret",
      password: "secret-password",
      value: "safe",
    },
  });

  assert.equal("token" in clean.nested, false);
  assert.equal("password" in clean.nested, false);
  assert.equal(clean.nested.value, "safe");
});

test("sanitize blocks prototype pollution keys", () => {
  const malicious = JSON.parse(
    '{"safe":true,"__proto__":{"admin":true},"constructor":{"x":1},"prototype":{"y":1}}',
  );

  const clean = H.sanitizeForTransfer(malicious);

  assert.equal(clean.safe, true);
  assert.equal(Object.prototype.hasOwnProperty.call(clean, "__proto__"), false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(clean, "constructor"),
    false,
  );
  assert.equal(Object.prototype.hasOwnProperty.call(clean, "prototype"), false);
});

test("sanitize does not mutate source", () => {
  const source = {
    settings: {
      photoAiToken: "keep-in-local-source",
      language: "fr",
    },
  };
  test("sanitize rejects excessive nesting", () => {
    let value = { safe: true };

    for (let i = 0; i < 45; i += 1) {
      value = { nested: value };
    }

    assert.throws(
      () => H.sanitizeForTransfer(value),
      /profondément imbriquées/,
    );
  });

  test("sanitize rejects oversized strings", () => {
    const value = {
      data: "x".repeat(16 * 1024 * 1024 + 1),
    };

    assert.throws(
      () => H.sanitizeForTransfer(value),
      /Chaîne de données trop volumineuse/,
    );
  });

  const clean = H.sanitizeForTransfer(source);

  assert.equal(source.settings.photoAiToken, "keep-in-local-source");
  assert.equal("photoAiToken" in clean.settings, false);
  assert.equal(clean.settings.language, "fr");
});

test("backup excludes sensitive tokens", () => {
  const app = JSON.parse(JSON.stringify(validApp));

  app.comptes.a.w2 = {
    settings: {
      photoAiEndpoint: "https://example.test",
      photoAiToken: "must-not-export",
    },
  };

  const backup = H.makeBackup(app);

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      backup.app.comptes.a.w2.settings,
      "photoAiToken",
    ),
    false,
  );

  assert.equal(
    backup.app.comptes.a.w2.settings.photoAiEndpoint,
    "https://example.test",
  );
});

// Goal consistency
test("cloud never stores session in localStorage", () => {
  const text = fs.readFileSync(`${root}/cloud.js`, "utf8");

  assert.doesNotMatch(text, /localStorage\.setItem\(\s*SESSION_KEY/);
});

test("cloud supports memory-only session", () => {
  const text = fs.readFileSync(`${root}/cloud.js`, "utf8");

  assert.match(text, /function useMemorySession/);
  assert.match(text, /memoryOnlySession\s*=\s*true/);
  assert.match(text, /clearStoredSessions\(\)/);
});

test("native cloud session avoids localStorage rehydration", () => {
  const text = fs.readFileSync(`${root}/hardening.js`, "utf8");

  assert.doesNotMatch(text, /localStorage\.setItem\(\s*CLOUD_SESSION_KEY/);

  assert.match(text, /useMemorySession/);
  assert.match(text, /secureSessionWrite/);
});

test("goal loss from weights", () =>
  assert.equal(H.goalModeFromWeights(80, 70), "loss"));
test("goal muscle from weights", () =>
  assert.equal(H.goalModeFromWeights(70, 80), "muscle"));
test("goal maintain from weights", () =>
  assert.equal(H.goalModeFromWeights(70, 70), "maintain"));
test("loss conflict equal weights", () =>
  assert.equal(H.goalCompatible("loss", 70, 70), false));
test("maintain compatible equal", () =>
  assert.equal(H.goalCompatible("maintain", 70, 70), true));
test("recomp independent of weight target", () =>
  assert.equal(H.goalCompatible("recomp", 70, 80), true));

// Photo refs / timestamps / first measurement
test("photo ref roundtrip", () => {
  const ref = H.photoRef("compte a", "photo/1");
  assert.deepEqual(H.photoRefParts(ref), {
    accountId: "compte a",
    photoId: "photo/1",
  });
});
test("photo ref detection", () =>
  assert.equal(H.isPhotoRef(H.photoRef("a", "b")), true));
test("compareIso newer", () =>
  assert.equal(
    H.compareIso("2026-08-27T10:00:00Z", "2026-08-27T09:00:00Z"),
    1,
  ));
test("first measurement", () =>
  assert.equal(H.firstMeasurementLabel(7.5, 0, "h"), "Première mesure"));

// Static project checks
test("OTA updater enforces SHA-256 checksum", () => {
  const text = fs.readFileSync(`${root}/ota-updater.js`, "utf8");

  assert.match(text, /ALLOWED_BUNDLE_URLS/);
  assert.match(text, /manifest\.sha256/);
  assert.match(text, /checksum:\s*String\(manifest\.sha256\)/);
});

test("OTA workflow publishes SHA-256", () => {
  const text = fs.readFileSync(
    `${root}/.github/workflows/ota-web-update.yml`,
    "utf8",
  );

  assert.match(text, /sha256sum/);
  assert.match(text, /"sha256": "\$\{SHA256\}"/);
});

test("package version matches app", () => {
  const pkg = JSON.parse(fs.readFileSync(`${root}/package.json`, `utf8`));
  assert.equal(pkg.version, H.APP_VERSION);
});
test("build includes hardening", () => {
  const text = fs.readFileSync(`${root}/scripts/build-web.mjs`, `utf8`);
  assert.match(text, /hardening-core\.js/);
  assert.match(text, /hardening\.js/);
});
test("service worker includes hardening", () => {
  const text = fs.readFileSync(`${root}/sw.js`, `utf8`);
  assert.match(text, /hardening-core\.js/);
  assert.match(text, /hardening\.js/);
  assert.match(text, /native-bridge\.js/);
});
test("OTA updater knows dedicated branch", () => {
  const text = fs.readFileSync(`${root}/ota-updater.js`, `utf8`);
  assert.match(text, /\/ota\/latest\.json/);
  assert.match(text, /\/main\/ota\/latest\.json/);
});
test("Ciqual database is lazy-loaded", () => {
  const html = fs.readFileSync(`${root}/index.html`, "utf8");

  assert.match(html, /<script src="ciqual-loader\.js"><\/script>/);
  assert.doesNotMatch(html, /<script src="data-foods-ciqual\.js"><\/script>/);
});

test("service worker does not precache Ciqual database", () => {
  const text = fs.readFileSync(`${root}/sw.js`, "utf8");

  assert.match(text, /\.\/ciqual-loader\.js/);
  assert.doesNotMatch(text, /\.\/data-foods-ciqual\.js/);
});
test("photo AI token is not persisted in app settings", () => {
  const text = fs.readFileSync(`${root}/wellness2.js`, "utf8");

  assert.doesNotMatch(text, /photoAiToken\s*:\s*["']/);
  assert.doesNotMatch(text, /a\.w2\.settings\.photoAiToken\s*=/);
});

test("photo AI token uses isolated secure storage", () => {
  const hardening = fs.readFileSync(`${root}/hardening.js`, "utf8");
  const wellness = fs.readFileSync(`${root}/wellness2.js`, "utf8");

  assert.match(hardening, /SECURE_PHOTO_AI_NATIVE_KEY/);
  assert.match(hardening, /PHOTO_AI_TOKEN_SESSION_KEY/);
  assert.match(hardening, /internalSetItem/);
  assert.match(wellness, /WellnessV41\?\.photoAiToken\?\.get/);
  assert.match(wellness, /WellnessV41\.photoAiToken\.set/);
});

test("cloud logout revokes Supabase session", () => {
  const text = fs.readFileSync(`${root}/cloud.js`, "utf8");

  assert.match(text, /\/auth\/v1\/logout/);
  assert.match(text, /session\.access_token/);
  assert.match(text, /finally\s*{[\s\S]*setSession\(null\)/);
});

test("native logout clears secure session", () => {
  const text = fs.readFileSync(`${root}/hardening.js`, "utf8");

  assert.match(text, /WellnessCloud\.signOut\s*=\s*async/);
  assert.match(text, /await original\.signOut\(\)/);
  assert.match(text, /await secureSessionRemove\(plugin\)/);
});

test("cloud deletion is scoped to current user", () => {
  const text = fs.readFileSync(`${root}/cloud.js`, "utf8");

  assert.match(text, /method:\s*"DELETE"/);
  assert.match(
    text,
    /wellness_sync\?user_id=eq\.\$\{encodeURIComponent\(session\.user\.id\)\}/,
  );
  assert.match(text, /deleteRemoteData/);
});

test("cloud deletion requires confirmation", () => {
  const text = fs.readFileSync(`${root}/wellness2.js`, "utf8");

  assert.match(text, /w2-cloud-delete/);
  assert.match(text, /window\.confirm/);
  assert.match(text, /WellnessCloud\.deleteRemoteData\(\)/);
});

test("photo AI endpoint is restricted by CSP policy", () => {
  const text = fs.readFileSync(`${root}/wellness2.js`, "utf8");

  assert.match(text, /function w2IsAllowedPhotoAiEndpoint/);
  assert.match(text, /url\.origin === window\.location\.origin/);
  assert.match(text, /url\.hostname\.endsWith\("\.supabase\.co"\)/);
});

test("CSP does not allow arbitrary HTTPS connections", () => {
  const html = fs.readFileSync(`${root}/index.html`, "utf8");

  const match = html.match(/Content-Security-Policy"[\s\S]*?content="([^"]+)"/);

  assert.ok(match, "CSP absente");

  const csp = match[1];
  const connectSrc = csp.match(/connect-src\s+([^;]+)/)?.[1] || "";

  assert.doesNotMatch(connectSrc, /(?:^|\s)https:(?:\s|$)/);
  assert.match(connectSrc, /https:\/\/\*\.supabase\.co/);
});

test("modal accessibility supports Escape and focus trap", () => {
  const text = fs.readFileSync(`${root}/hardening.js`, "utf8");

  assert.match(text, /event\.key === "Escape"/);
  assert.match(text, /event\.key !== "Tab"/);
  assert.match(text, /modalFocusableElements/);
  assert.match(text, /focusWithoutScroll/);
});

test("modal accessibility restores previous focus", () => {
  const text = fs.readFileSync(`${root}/hardening.js`, "utf8");

  assert.match(text, /modalFocusReturn/);
  assert.match(text, /registerModalOpen/);
  assert.match(text, /registerModalClose/);
  assert.match(text, /installModalAccessibility\(\)/);
});

test("interactive touch targets are at least 44px", () => {
  const css = fs.readFileSync(`${root}/style.css`, "utf8");

  assert.match(
    css,
    /\.photo-item button,[\s\S]*?\.px-notification-trigger\s*{[\s\S]*?min-width:\s*44px\s*!important;[\s\S]*?min-height:\s*44px\s*!important;/,
  );

  assert.match(css, /\.v43-entry-menu\s*{[\s\S]*?flex:\s*0 0 44px;/);

  assert.match(
    css,
    /\.v44-builder-row\s*{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s+88px\s+78px\s+44px;/,
  );
});

test("local OTA manifest includes app and schema versions", () => {
  const text = fs.readFileSync(`${root}/scripts/build-ota.mjs`, "utf8");

  assert.match(
    text,
    /readFileSync\(join\(root,\s*"package\.json"\),\s*"utf8"\)/,
  );
  assert.match(text, /const schemaVersion = 4;/);
  assert.match(
    text,
    /const manifest = \{[\s\S]*?version,[\s\S]*?appVersion,[\s\S]*?schemaVersion,/,
  );
});

test("local OTA version is prefixed with app version", () => {
  const text = fs.readFileSync(`${root}/scripts/build-ota.mjs`, "utf8");

  assert.match(text, /`\$\{appVersion\}-\$\{new Date\(\)/);
});
test("Supabase RLS protects cloud deletion", () => {
  const sql = fs.readFileSync(`${root}/SUPABASE_SETUP.sql`, "utf8");

  assert.match(
    sql,
    /alter table public\.wellness_sync enable row level security;/,
  );

  assert.match(
    sql,
    /on public\.wellness_sync for delete[\s\S]*?using\s*\(\s*auth\.uid\(\)\s*=\s*user_id\s*\)/,
  );
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
console.log(`\n${passed} / ${tests.length} tests réussis`);
if (passed !== tests.length) process.exitCode = 1;
