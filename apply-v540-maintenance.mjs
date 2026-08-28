import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const VERSION = "5.4.0";

function p(file) { return path.join(ROOT, file); }
function read(file) {
  if (!fs.existsSync(p(file))) throw new Error(`Fichier introuvable: ${file}`);
  return fs.readFileSync(p(file), "utf8");
}
function write(file, content) {
  fs.mkdirSync(path.dirname(p(file)), { recursive: true });
  fs.writeFileSync(p(file), content, "utf8");
  console.log(`✅ ${file}`);
}
function replaceOnce(text, from, to, label) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${label}: motif attendu 1 fois, trouvé ${count}`);
  return text.replace(from, to);
}
function replaceRegexOnce(text, rx, to, label) {
  const m = text.match(rx);
  if (!m) throw new Error(`${label}: motif introuvable`);
  const after = text.replace(rx, to);
  if (after === text) throw new Error(`${label}: remplacement non appliqué`);
  return after;
}

// ------------------------------------------------------
// 1) Externaliser le bootstrap thème + CSP
// ------------------------------------------------------
const themeBootstrap = `(() => {
  "use strict";
  const cleTheme = "wellnessTheme";
  const mode = localStorage.getItem(cleTheme) || "dark";
  const systemeSombre = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = mode === "system" ? (systemeSombre ? "dark" : "light") : mode;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.themeMode = mode;
})();\n`;
write("theme-bootstrap.js", themeBootstrap);

let index = read("index.html");

index = index.replace(
  /  <script>\s*\(function \(\) \{[\s\S]*?document\.documentElement\.dataset\.themeMode = mode;\s*\}\)\(\);\s*<\/script>\s*/m,
  `  <script src="theme-bootstrap.js"></script>\n`
);

if (!index.includes("Content-Security-Policy")) {
  index = index.replace(
    '<meta name="theme-color" content="#0b1220">',
    `<meta name="theme-color" content="#0b1220">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; media-src 'self' data: blob:; connect-src 'self' https://raw.githubusercontent.com https://world.openfoodfacts.org https://*.openfoodfacts.org https://*.supabase.co; worker-src 'self' blob:; manifest-src 'self';">
  <meta name="referrer" content="no-referrer">`
  );
}

index = index.replace(/Wellness 5\.3\.5/g, `Wellness ${VERSION}`);
write("index.html", index);

// ------------------------------------------------------
// 2) OTA : bloquer strictement les downgrades / schémas futurs
// ------------------------------------------------------
let ota = read("ota-updater.js");

if (!ota.includes('const BUNDLED_APP_VERSION = "5.4.0";')) {
  ota = ota.replace(
    '  const CHECK_INTERVAL_MS = 15 * 60 * 1000;',
    `  const CHECK_INTERVAL_MS = 15 * 60 * 1000;
  const BUNDLED_APP_VERSION = "${VERSION}";
  const SUPPORTED_SCHEMA_VERSION = 4;

  function semverCore(value) {
    const m = String(value || "").match(/(\\d+)\\.(\\d+)\\.(\\d+)/);
    return m ? m.slice(1).map(Number) : [0, 0, 0];
  }

  function compareSemver(a, b) {
    const left = semverCore(a);
    const right = semverCore(b);
    for (let i = 0; i < 3; i += 1) {
      if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
    }
    return 0;
  }

  function manifestSafeForInstall(manifest, currentVersion) {
    const schema = Number(manifest?.schemaVersion);
    if (Number.isFinite(schema) && schema > SUPPORTED_SCHEMA_VERSION) {
      return { ok: false, reason: \`schéma OTA trop récent (\${schema})\` };
    }

    const remoteApp = String(manifest?.appVersion || manifest?.version || "");
    const currentCore = currentVersion && currentVersion !== "builtin"
      ? currentVersion
      : BUNDLED_APP_VERSION;

    if (compareSemver(remoteApp, currentCore) < 0) {
      return { ok: false, reason: \`downgrade refusé (\${remoteApp} < \${currentCore})\` };
    }

    return { ok: true, reason: "" };
  }`
  );
}

ota = ota.replace(
  `      const manifest = await fetchManifest();
      const currentVersion = await getCurrentVersion();
      const pendingVersion = localStorage.getItem(PENDING_VERSION_KEY);`,
  `      const manifest = await fetchManifest();
      const currentVersion = await getCurrentVersion();
      const safety = manifestSafeForInstall(manifest, currentVersion);
      if (!safety.ok) {
        console.warn("[Wellness OTA] Mise à jour ignorée :", safety.reason);
        return;
      }
      const pendingVersion = localStorage.getItem(PENDING_VERSION_KEY);`
);
write("ota-updater.js", ota);

// ------------------------------------------------------
// 3) Service Worker : index.html seulement pour navigation
// ------------------------------------------------------
let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, `const CACHE = "wellness-${VERSION}";`);

if (!sw.includes('event.request.mode === "navigate"')) {
  sw = sw.replace(
`      .catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html")))`,
`      .catch(async () => {
        const hit = await caches.match(event.request);
        if (hit) return hit;

        if (event.request.mode === "navigate") {
          return (await caches.match("./index.html")) ||
            new Response("Wellness hors ligne", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
        }

        return new Response("", { status: 504, statusText: "Offline resource unavailable" });
      })`
  );
}
if (!sw.includes('"./theme-bootstrap.js"')) {
  sw = sw.replace('  "./index.html",', '  "./index.html",\n  "./theme-bootstrap.js",');
}
write("sw.js", sw);

// ------------------------------------------------------
// 4) Manifest PWA actuel
// ------------------------------------------------------
const manifest = {
  name: "Wellness 5 - Nutrition, activité & bien-être",
  short_name: "Wellness",
  description: "Suivi nutrition, activité, sommeil, poids, hydratation, planning et progression.",
  start_url: "./index.html",
  scope: "./",
  display: "standalone",
  background_color: "#08111f",
  theme_color: "#08111f",
  orientation: "any",
  categories: ["health", "fitness", "lifestyle"],
  shortcuts: [
    { name: "Ouvrir Wellness", short_name: "Wellness", url: "./index.html" }
  ],
  icons: [
    { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
  ]
};
write("manifest.webmanifest", JSON.stringify(manifest, null, 2) + "\n");

// ------------------------------------------------------
// 5) Sauvegarde native : même validation stricte que le moteur
// ------------------------------------------------------
let native = read("native-bridge.js");
native = native.replace(
`    const data = JSON.parse(raw);
    if (data?.format !== "wellness-backup" || !data?.app?.comptes) {
      throw new Error("Format de sauvegarde Wellness non reconnu.");
    }

    return { data, name: file.name || "sauvegarde.json" };`,
`    const data = JSON.parse(raw);
    const validator = window.WellnessHardeningCore?.validateBackup;
    if (typeof validator === "function") {
      const validation = validator(data);
      if (!validation.ok) {
        throw new Error(validation.errors?.[0] || "Sauvegarde Wellness invalide.");
      }
    } else if (data?.format !== "wellness-backup" || !data?.app?.comptes) {
      throw new Error("Format de sauvegarde Wellness non reconnu.");
    }

    return { data, name: file.name || "sauvegarde.json" };`
);
write("native-bridge.js", native);

// ------------------------------------------------------
// 6) Validation profonde minimale des sauvegardes
// ------------------------------------------------------
let hard = read("hardening-core.js");
hard = hard.replace(/const APP_VERSION = "[^"]+";/, `const APP_VERSION = "${VERSION}";`);

if (!hard.includes("function validateAccountEntries(account, id, errors)")) {
  hard = hard.replace(
`  function validateAppState(app) {
    const errors = [];`,
`  function validateAccountEntries(account, id, errors) {
    const finiteNonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0;
    const validDate = (value) => !value || Number.isFinite(Date.parse(String(value)));

    (account.journalCalories || []).forEach((entry, index) => {
      if (!entry || typeof entry !== "object") {
        errors.push(\`Entrée journal #\${index + 1} invalide pour \${id}.\`);
        return;
      }
      for (const key of ["calories", "proteines", "glucides", "lipides", "fibres"]) {
        if (entry[key] != null && !finiteNonNegative(entry[key])) {
          errors.push(\`Valeur \${key} invalide dans le journal de \${id}.\`);
          break;
        }
      }
      if (entry.date && !validDate(entry.date)) {
        errors.push(\`Date invalide dans le journal de \${id}.\`);
      }
    });

    (account.weightHistory || []).forEach((entry, index) => {
      const weight = Number(entry?.weight);
      if (!Number.isFinite(weight) || weight <= 0 || weight > 500) {
        errors.push(\`Poids invalide #\${index + 1} pour \${id}.\`);
      }
      if (entry?.date && !validDate(entry.date)) {
        errors.push(\`Date de poids invalide pour \${id}.\`);
      }
    });

    if (account.pasEffectues != null && !finiteNonNegative(account.pasEffectues)) {
      errors.push(\`Nombre de pas invalide pour \${id}.\`);
    }
    if (account.verresEau != null && !finiteNonNegative(account.verresEau)) {
      errors.push(\`Hydratation invalide pour \${id}.\`);
    }
  }

  function validateAppState(app) {
    const errors = [];`
  );

  hard = hard.replace(
`      if (account.repas != null && !isObject(account.repas)) {
        errors.push(\`Repas invalides pour \${id}.\`);
      }
    });`,
`      if (account.repas != null && !isObject(account.repas)) {
        errors.push(\`Repas invalides pour \${id}.\`);
      }

      validateAccountEntries(account, id, errors);
    });`
  );
}
write("hardening-core.js", hard);

// ------------------------------------------------------
// 7) Build web : embarquer bootstrap thème
// ------------------------------------------------------
let build = read("scripts/build-web.mjs");
if (!build.includes('"theme-bootstrap.js"')) {
  build = build.replace('  "index.html",', '  "index.html",\n  "theme-bootstrap.js",');
}
write("scripts/build-web.mjs", build);

// ------------------------------------------------------
// 8) Package + tests de régression maintenance
// ------------------------------------------------------
let pkg = JSON.parse(read("package.json"));
pkg.version = VERSION;
pkg.description = "Wellness 5.4.0 - maintenance, sécurité OTA, PWA et sauvegardes";
pkg.scripts["test:maintenance"] = "node scripts/test-v54-maintenance.mjs";
if (!pkg.scripts.test.includes("npm run test:maintenance")) {
  pkg.scripts.test += " && npm run test:maintenance";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

const test = `import fs from "node:fs";

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
console.log(\`\\n\${passed} / \${checks.length} tests Maintenance V5.4 réussis\`);
if (passed !== checks.length) process.exit(1);
`;
write("scripts/test-v54-maintenance.mjs", test);

// ------------------------------------------------------
// 9) Workflow OTA : version + nouveaux fichiers/tests
// ------------------------------------------------------
let workflow = read(".github/workflows/ota-web-update.yml");
workflow = workflow.replace(/5\.3\.5/g, VERSION);
if (!workflow.includes('- "theme-bootstrap.js"')) {
  workflow = workflow.replace('      - "index.html"', '      - "index.html"\n      - "theme-bootstrap.js"');
}
if (!workflow.includes('- "scripts/test-v54-maintenance.mjs"')) {
  workflow = workflow.replace(
    '      - "scripts/test-v535-steps-keyboard.mjs"',
    '      - "scripts/test-v535-steps-keyboard.mjs"\n      - "scripts/test-v54-maintenance.mjs"'
  );
}
write(".github/workflows/ota-web-update.yml", workflow);

// ------------------------------------------------------
// 10) README actuel
// ------------------------------------------------------
const readme = `# Wellness 5.4

Application iPhone / PWA de suivi quotidien du bien-être.

## Fonctions principales

- Tableau Aujourd'hui : score, priorités, calories, protéines, hydratation, pas, repas et coach.
- Nutrition : base ANSES Ciqual, Open Food Facts, scanner code-barres, journal par repas, macros, fibres, sel, sucres et graisses saturées.
- Quantités : g, kg, ml, cl, L et portions personnalisées selon l'aliment.
- Ajout rapide : récents, fréquents, favoris, repas enregistrés, copier hier et recommandations.
- Plan : petit-déjeuner, déjeuner, dîner, collation, semaine et liste de courses.
- Progrès : poids, mensurations, photos, sommeil, humeur, activité, calendrier et comparaison hebdomadaire.
- Profils multiples avec données séparées.
- Rappels iOS locaux.
- Export / sauvegarde JSON, restauration validée et rollback.
- Synchronisation Supabase optionnelle avec RLS ; session native protégée par le Trousseau iOS.
- PWA hors ligne et mises à jour OTA de l'application native.
- Apple Santé intégré côté code ; l'accès peut rester indisponible selon la signature iOS utilisée.

## Développement

Node.js 22+.

\`\`\`bash
npm ci
npm run verify
\`\`\`

Le build web est généré dans \`www/\`.

## Mise à jour OTA

Les mises à jour web sont publiées sur la branche \`ota\` après validation complète par GitHub Actions.
Depuis la V5.4, l'updater refuse explicitement tout downgrade et tout schéma de données plus récent que celui pris en charge.

## Sécurité et données

- Ne jamais utiliser de clé Supabase \`service_role\` dans l'application.
- La clé \`anon\` est la seule clé publique attendue.
- Les règles RLS de \`SUPABASE_SETUP.sql\` isolent les données par utilisateur.
- Les sauvegardes sont validées avant restauration.
- Sur iPhone natif, la session cloud est stockée via Secure Storage / Trousseau iOS.

## Limites

Wellness est un outil de suivi bien-être. Les calories, macros, prévisions de poids et suggestions sont indicatives et ne remplacent pas un professionnel de santé.
Pour une allergie sévère, vérifier toujours l'étiquette et les ingrédients réels du produit.
`;
write("README.md", readme);

// ------------------------------------------------------
// 11) Documentation maintenance
// ------------------------------------------------------
write("V54_MAINTENANCE.md", `# Wellness 5.4 — Maintenance & Consolidation

Corrections appliquées :
- protection anti-downgrade OTA ;
- contrôle du schemaVersion OTA ;
- fallback Service Worker limité aux navigations ;
- CSP web + referrer policy ;
- bootstrap thème externalisé ;
- manifest PWA remis à jour ;
- validation plus stricte des sauvegardes ;
- restauration native alignée sur le validateur principal ;
- tests de régression V5.4 ;
- README remis à niveau.

À ne pas mélanger dans cette release :
- refonte complète des modules historiques ;
- lazy-loading de Ciqual ;
- remplacement global de l'architecture par bundler moderne.

Ces refactorings sont utiles mais doivent être réalisés dans une branche dédiée avec tests E2E, pour éviter de casser l'application iPhone déjà stable.
`);

console.log("\n🎉 Patch Wellness 5.4.0 appliqué.");
console.log("Ensuite : npm install && npm run verify");
console.log('Puis commit conseillé : git commit -m "chore: harden Wellness maintenance and OTA safety"');
