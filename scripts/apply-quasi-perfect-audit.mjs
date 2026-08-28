import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const VERSION = "5.6.0";

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), content.replace(/\r\n/g, "\n"));
}

function replaceRequired(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Motif introuvable pour ${label}`);
  }
  return content.replace(search, replacement);
}

// ---------------------------------------------------------------------------
// Version + package scripts
// ---------------------------------------------------------------------------
const pkg = JSON.parse(read("package.json"));
pkg.version = VERSION;
pkg.description = "Wellness 5.6.0 - production hardening, privacy, accessibility and release quality";
pkg.scripts["test:quality"] = "node scripts/test-quality-standards.mjs";
pkg.scripts["test:e2e"] = "playwright test";
if (!pkg.scripts.test.includes("npm run test:quality")) {
  pkg.scripts.test += " && npm run test:quality";
}
for (const file of ["legal.js", "scripts/test-quality-standards.mjs", "scripts/serve-web.mjs"]) {
  const check = `node --check ${file}`;
  if (!pkg.scripts["check:syntax"].includes(check)) pkg.scripts["check:syntax"] += ` && ${check}`;
}
write("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

const lock = JSON.parse(read("package-lock.json"));
lock.version = VERSION;
if (lock.packages?.[""]) lock.packages[""].version = VERSION;
write("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);

// ---------------------------------------------------------------------------
// HTML: valid structure, tighter CSP, local/system fonts, production metadata
// ---------------------------------------------------------------------------
let html = read("index.html");
html = html.replaceAll("Wellness 5.5.0", `Wellness ${VERSION}`);
html = html.replace(
  '<meta name="theme-color" content="#0b1220">',
  '<meta name="theme-color" content="#0b1220">\n  <meta name="color-scheme" content="dark light">\n  <meta name="format-detection" content="telephone=no">',
);
html = html.replace(
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:;",
  "style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:;",
);
html = html.replace(
  /\n\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter:[^\n]+\n/,
  "\n",
);
html = replaceRequired(
  html,
  '  <script src="layout-v541.js"></script>',
  '  <script src="layout-v541.js"></script>\n  <script src="legal.js"></script>',
  "chargement legal.js",
);
html = html.replace(/<\/body>\s*<\/body>\s*<\/html>\s*$/i, "</body>\n\n</html>\n");
write("index.html", html);

// ---------------------------------------------------------------------------
// CSS: system font + legal/accessibility finishing layer
// ---------------------------------------------------------------------------
let css = read("style.css");
css = css.replaceAll(
  'font-family: "Inter", "Segoe UI", Arial, sans-serif;',
  'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
);
css = css.replaceAll("Inter, system-ui, sans-serif", "system-ui, -apple-system, BlinkMacSystemFont, sans-serif");
if (!css.includes("WELLNESS 5.6 — LEGAL + ACCESSIBILITY FINISH")) {
  css += `\n\n/* ======================================================\n   WELLNESS 5.6 — LEGAL + ACCESSIBILITY FINISH\n====================================================== */\n.w56-legal-card { margin-top: 18px; }\n.w56-legal-card h2 { margin-bottom: 8px; }\n.w56-legal-card p { margin-bottom: 10px; }\n.w56-legal-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }\n.w56-legal-links a { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; color: var(--text-soft); text-decoration: none; background: rgba(255,255,255,.035); }\n.w56-legal-links a:hover { border-color: rgba(96,165,250,.35); color: var(--text); }\n.w56-allergy-note { margin: 9px 0 0; padding: 10px 12px; border: 1px solid rgba(250,204,21,.18); border-radius: 12px; color: #d7c78b; background: rgba(250,204,21,.055); font-size: .76rem; line-height: 1.5; }\nhtml[data-theme="light"] .w56-allergy-note { color: #725d00; background: rgba(250,204,21,.10); }\n.navigation-principale .nav-bouton[aria-current="page"] { position: relative; }\n@media (max-width: 700px) { .w56-legal-links { display: grid; grid-template-columns: 1fr; } .w56-legal-links a { width: 100%; } }\n`;
}
write("style.css", css);

// ---------------------------------------------------------------------------
// Version consistency
// ---------------------------------------------------------------------------
let hardeningCore = read("hardening-core.js");
hardeningCore = hardeningCore.replace('const APP_VERSION = "5.5.0";', `const APP_VERSION = "${VERSION}";`);
write("hardening-core.js", hardeningCore);

let otaUpdater = read("ota-updater.js");
otaUpdater = otaUpdater.replace('const BUNDLED_APP_VERSION = "5.5.0";', `const BUNDLED_APP_VERSION = "${VERSION}";`);
otaUpdater = otaUpdater.replaceAll("Inter, system-ui, sans-serif", "system-ui, -apple-system, BlinkMacSystemFont, sans-serif");
write("ota-updater.js", otaUpdater);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, `const CACHE = "wellness-${VERSION}";`);
if (!sw.includes('"./legal.js"')) {
  sw = sw.replace('  "./layout-v541.js",', '  "./layout-v541.js",\n  "./legal.js",');
}
write("sw.js", sw);

// ---------------------------------------------------------------------------
// Open Food Facts API v3 + request hardening/identification
// ---------------------------------------------------------------------------
let wellness2 = read("wellness2.js");
wellness2 = wellness2.replace(/const W2_VERSION = "[^"]+";/, `const W2_VERSION = "${VERSION}";`);
const marker = "async function w2LookupBarcode(code) {";
if (!wellness2.includes("function w2OpenFoodFactsUrl(code)")) {
  wellness2 = replaceRequired(
    wellness2,
    marker,
    `const W2_OFF_API_BASE = "https://world.openfoodfacts.org/api/v3/product";\nconst W2_OFF_TIMEOUT_MS = 10000;\n\nfunction w2OpenFoodFactsUrl(code) {\n  const url = new URL(\`${'${W2_OFF_API_BASE}'}/${'${encodeURIComponent(code)}'}\`);\n  url.searchParams.set("fields", "product_name,nutriments,serving_size,brands");\n  url.searchParams.set("lc", "fr");\n  url.searchParams.set("cc", "fr");\n  // Browser/WKWebView fetch cannot reliably override the User-Agent header.\n  // These identification parameters keep the client attributable to Wellness.\n  url.searchParams.set("app_name", "Wellness");\n  url.searchParams.set("app_version", W2_VERSION);\n  url.searchParams.set(\n    "User-Agent",\n    \`Wellness/${'${W2_VERSION}'} (https://github.com/gregorylaporte1810-gif/mon-app-alimentation)\`,\n  );\n  return url.toString();\n}\n\nasync function w2FetchOpenFoodFacts(code) {\n  const controller = new AbortController();\n  const timeout = window.setTimeout(() => controller.abort(), W2_OFF_TIMEOUT_MS);\n\n  try {\n    const response = await fetch(w2OpenFoodFactsUrl(code), {\n      method: "GET",\n      headers: { Accept: "application/json" },\n      cache: "no-store",\n      credentials: "omit",\n      referrerPolicy: "no-referrer",\n      signal: controller.signal,\n    });\n\n    if (response.status === 404) return null;\n    if (response.status === 429) {\n      throw new Error("Open Food Facts limite temporairement les requêtes. Réessaie dans quelques instants.");\n    }\n    if (!response.ok) {\n      throw new Error(\`Open Food Facts indisponible (HTTP ${'${response.status}'})\`);\n    }\n\n    return response.json();\n  } catch (error) {\n    if (error?.name === "AbortError") {\n      throw new Error("Open Food Facts met trop de temps à répondre.");\n    }\n    throw error;\n  } finally {\n    window.clearTimeout(timeout);\n  }\n}\n\n${marker}`,
    "helper Open Food Facts v3",
  );
}
wellness2 = wellness2.replace(
  /    const response = await fetch\(\n      `https:\/\/world\.openfoodfacts\.org\/api\/v2\/product\/\$\{encodeURIComponent\(value\)\}\.json\?fields=product_name,nutriments,serving_size,brands`,\n    \);\n    const data = await response\.json\(\);/,
  "    const data = await w2FetchOpenFoodFacts(value);",
);
wellness2 = wellness2.replace(
  '  if (!value) {\n    result.innerHTML =\n      \'<p class="mega-inline-message">Saisis un code-barres.</p>\';\n    return false;\n  }',
  '  if (!value) {\n    result.innerHTML =\n      \'<p class="mega-inline-message">Saisis un code-barres.</p>\';\n    return false;\n  }\n  if (!/^\\d{4,24}$/.test(value)) {\n    result.innerHTML =\n      \'<p class="mega-inline-message">Code-barres invalide : utilise uniquement les chiffres imprimés sous le code.</p>\';\n    return false;\n  }',
);
write("wellness2.js", wellness2);

// ---------------------------------------------------------------------------
// Runtime legal/accessibility layer
// ---------------------------------------------------------------------------
write("legal.js", `(() => {\n  "use strict";\n\n  const VERSION = "${VERSION}";\n  const REPO = "https://github.com/gregorylaporte1810-gif/mon-app-alimentation";\n\n  function markLiveRegions() {\n    const selectors = [\n      '[id^="message-"]',\n      '[id$="-message"]',\n      '#w2-barcode-result',\n      '#w2-backup-message',\n      '#w2-cloud-message',\n      '#w2-photo-message',\n      '#mega-reminder-message',\n    ].join(',');\n    document.querySelectorAll(selectors).forEach((element) => {\n      if (!element.hasAttribute("role")) element.setAttribute("role", "status");\n      if (!element.hasAttribute("aria-live")) element.setAttribute("aria-live", "polite");\n      if (!element.hasAttribute("aria-atomic")) element.setAttribute("aria-atomic", "true");\n    });\n  }\n\n  function syncNavigationState() {\n    document.querySelectorAll(".navigation-principale .nav-bouton[data-page]").forEach((button) => {\n      const page = document.getElementById(\`page-\${button.dataset.page}\`);\n      const current = button.classList.contains("active") || page?.classList.contains("active");\n      if (current) button.setAttribute("aria-current", "page");\n      else button.removeAttribute("aria-current");\n    });\n  }\n\n  function installAllergyDisclaimer() {\n    const grid = document.getElementById("w2-allergy-grid");\n    if (!grid || document.getElementById("w56-allergy-note")) return;\n    const note = document.createElement("p");\n    note.id = "w56-allergy-note";\n    note.className = "w56-allergy-note";\n    note.textContent = "Allergies : les filtres Wellness sont indicatifs et basés sur les informations disponibles. En cas d’allergie, vérifie toujours l’étiquette et les traces éventuelles du produit.";\n    grid.insertAdjacentElement("afterend", note);\n  }\n\n  function installLegalCard() {\n    const page = document.getElementById("page-profil");\n    if (!page || document.getElementById("w56-legal-card")) return;\n    const card = document.createElement("section");\n    card.id = "w56-legal-card";\n    card.className = "carte w56-legal-card";\n    card.setAttribute("aria-labelledby", "w56-legal-title");\n    card.innerHTML = \`\n      <p class="sur-titre">Transparence</p>\n      <h2 id="w56-legal-title">Confidentialité & sources</h2>\n      <p>Wellness fonctionne localement par défaut. Le cloud Supabase, l’analyse photo et Apple Santé sont optionnels. Wellness ne contient ni publicité ni télémétrie publicitaire.</p>\n      <p><strong>Ciqual :</strong> Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.</p>\n      <p><strong>Open Food Facts :</strong> données communautaires réutilisées sous Open Database License (ODbL) ; leur exactitude n’est pas garantie.</p>\n      <div class="w56-legal-links">\n        <a href="\${REPO}/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>\n        <a href="\${REPO}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Sources & licences</a>\n        <a href="https://ciqual.anses.fr/" target="_blank" rel="noopener noreferrer">Anses Ciqual</a>\n        <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a>\n      </div>\n      <small>Wellness \${VERSION} · outil de suivi général, non dispositif médical.</small>\n    \`;\n    page.appendChild(card);\n  }\n\n  function install() {\n    markLiveRegions();\n    syncNavigationState();\n    installAllergyDisclaimer();\n    installLegalCard();\n\n    const observer = new MutationObserver((mutations) => {\n      if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "class")) {\n        syncNavigationState();\n      }\n      markLiveRegions();\n    });\n    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });\n  }\n\n  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });\n  else install();\n\n  window.WellnessLegal = { version: VERSION, syncNavigationState, markLiveRegions };\n})();\n`);

// ---------------------------------------------------------------------------
// Build + PWA
// ---------------------------------------------------------------------------
let buildWeb = read("scripts/build-web.mjs");
if (!buildWeb.includes('"legal.js"')) {
  buildWeb = buildWeb.replace('  "layout-v541.js",', '  "layout-v541.js",\n  "legal.js",');
}
write("scripts/build-web.mjs", buildWeb);

const manifest = JSON.parse(read("manifest.webmanifest"));
manifest.id = "./";
manifest.lang = "fr";
manifest.dir = "ltr";
manifest.display_override = ["standalone", "minimal-ui"];
manifest.prefer_related_applications = false;
manifest.name = "Wellness 5.6 - Nutrition, activité & bien-être";
write("manifest.webmanifest", `${JSON.stringify(manifest, null, 2)}\n`);

// ---------------------------------------------------------------------------
// Reproducible GitHub Actions + browser quality gate
// ---------------------------------------------------------------------------
const SETUP_NODE_SHA = "48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e"; // setup-node v6.4.0
let quality = read(".github/workflows/quality.yml");
quality = quality.replace("runs-on: ubuntu-latest", "runs-on: ubuntu-24.04");
quality = quality.replace(
  "      - name: Verify Node.js runtime\n        run: node --version && npm --version",
  `      - name: Set up Node.js\n        uses: actions/setup-node@${SETUP_NODE_SHA} # v6.4.0\n        with:\n          node-version: 22.11.0\n          package-manager-cache: false\n\n      - name: Verify Node.js runtime\n        run: node --version && npm --version`,
);
if (!quality.includes("Run browser and accessibility tests")) {
  quality = quality.replace(
    "      - name: Audit production and development dependencies\n        run: npm audit --audit-level=high",
    `      - name: Install Chromium for browser tests\n        run: npx playwright install --with-deps chromium\n\n      - name: Run browser and accessibility tests\n        run: npm run test:e2e\n\n      - name: Audit production and development dependencies\n        run: npm audit --audit-level=high`,
  );
}
write(".github/workflows/quality.yml", quality);

let otaWorkflow = read(".github/workflows/ota-web-update.yml");
otaWorkflow = otaWorkflow.replace("runs-on: ubuntu-latest", "runs-on: ubuntu-24.04");
otaWorkflow = otaWorkflow.replace(
  "      - name: Verify Node.js runtime\n        run: node --version && npm --version",
  `      - name: Set up Node.js\n        uses: actions/setup-node@${SETUP_NODE_SHA} # v6.4.0\n        with:\n          node-version: 22.11.0\n          package-manager-cache: false\n\n      - name: Verify Node.js runtime\n        run: node --version && npm --version`,
);
if (!otaWorkflow.includes('      - "legal.js"')) {
  otaWorkflow = otaWorkflow.replace('      - "layout-v541.js"', '      - "layout-v541.js"\n      - "legal.js"');
}
write(".github/workflows/ota-web-update.yml", otaWorkflow);

// ---------------------------------------------------------------------------
// Browser test infrastructure
// ---------------------------------------------------------------------------
write("scripts/serve-web.mjs", `import http from "node:http";\nimport fs from "node:fs";\nimport path from "node:path";\nimport { fileURLToPath } from "node:url";\n\nconst root = path.resolve(process.cwd(), "www");\nconst port = Number(process.env.PORT || 4173);\nconst mime = new Map([[".html","text/html; charset=utf-8"],[".js","text/javascript; charset=utf-8"],[".css","text/css; charset=utf-8"],[".json","application/json; charset=utf-8"],[".webmanifest","application/manifest+json; charset=utf-8"],[".png","image/png"]]);\n\nconst server = http.createServer((request, response) => {\n  const requestUrl = new URL(request.url || "/", \`http://127.0.0.1:\${port}\`);\n  const pathname = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);\n  const target = path.resolve(root, `.${'${pathname}'}`);\n  if (!target.startsWith(root + path.sep)) { response.writeHead(403).end("Forbidden"); return; }\n  fs.stat(target, (statError, stat) => {\n    if (statError || !stat.isFile()) { response.writeHead(404).end("Not found"); return; }\n    const type = mime.get(path.extname(target)) || "application/octet-stream";\n    response.setHeader("Content-Type", type);\n    response.setHeader("X-Content-Type-Options", "nosniff");\n    response.setHeader("Referrer-Policy", "no-referrer");\n    fs.createReadStream(target).pipe(response);\n  });\n});\n\nserver.listen(port, "127.0.0.1", () => console.log(\`Wellness test server: http://127.0.0.1:\${port}\`));\n`);

write("playwright.config.mjs", `import { defineConfig, devices } from "@playwright/test";\n\nexport default defineConfig({\n  testDir: "./tests/e2e",\n  timeout: 30000,\n  retries: 1,\n  reporter: [["line"]],\n  use: {\n    baseURL: "http://127.0.0.1:4173",\n    trace: "retain-on-failure",\n    screenshot: "only-on-failure",\n    video: "retain-on-failure",\n  },\n  projects: [\n    { name: "mobile-chromium", use: { ...devices["iPhone 15"], browserName: "chromium" } },\n    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },\n  ],\n  webServer: {\n    command: "node scripts/serve-web.mjs",\n    url: "http://127.0.0.1:4173/index.html",\n    reuseExistingServer: true,\n    timeout: 15000,\n  },\n});\n`);

write("tests/e2e/app.spec.mjs", `import { test, expect } from "@playwright/test";\nimport AxeBuilder from "@axe-core/playwright";\n\ntest("Wellness loads with a single accessible primary navigation", async ({ page }) => {\n  await page.goto("/index.html");\n  await expect(page).toHaveTitle(/Wellness 5\\.6\\.0/);\n  await expect(page.locator("main.app")).toBeVisible();\n  await expect(page.locator(".navigation-principale .nav-bouton")).toHaveCount(5);\n  await expect(page.locator('.navigation-principale .nav-bouton[aria-current="page"]')).toHaveCount(1);\n  await expect(page.locator("#w56-legal-card")).toHaveCount(1);\n});\n\ntest("theme bootstrap supports light mode without external font dependency", async ({ page }) => {\n  await page.addInitScript(() => localStorage.setItem("wellnessTheme", "light"));\n  await page.goto("/index.html");\n  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");\n  const googleFonts = await page.locator('link[href*="fonts.googleapis.com"]').count();\n  expect(googleFonts).toBe(0);\n});\n\ntest("critical and serious automated accessibility findings are absent", async ({ page }) => {\n  await page.goto("/index.html");\n  const results = await new AxeBuilder({ page })\n    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])\n    .analyze();\n  const blocking = results.violations.filter((item) => ["critical", "serious"].includes(item.impact));\n  expect(blocking, blocking.map((item) => `${'${item.id}'}: ${'${item.help}'}`).join("\\n")).toEqual([]);\n});\n\ntest("profile exposes allergy safety information and privacy sources", async ({ page }) => {\n  await page.goto("/index.html");\n  const profileButton = page.locator('.navigation-principale .nav-bouton[data-page="profil"]');\n  await profileButton.click();\n  await expect(page.locator("#w56-legal-card")).toBeVisible();\n  await expect(page.locator("#w56-allergy-note")).toContainText("vérifie toujours l’étiquette");\n});\n`);

// ---------------------------------------------------------------------------
// Static quality standards
// ---------------------------------------------------------------------------
write("scripts/test-quality-standards.mjs", `import assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst VERSION = "${VERSION}";\nconst read = (file) => fs.readFileSync(file, "utf8");\nlet passed = 0;\nconst tests = [];\nconst test = (name, fn) => tests.push([name, fn]);\n\ntest("HTML has exactly one body/html closing tag", () => {\n  const html = read("index.html");\n  assert.equal((html.match(/<\\/body>/gi) || []).length, 1);\n  assert.equal((html.match(/<\\/html>/gi) || []).length, 1);\n});\n\ntest("CSP avoids arbitrary HTTPS images and remote Google fonts", () => {\n  const html = read("index.html");\n  assert.doesNotMatch(html, /fonts\\.googleapis\\.com|fonts\\.gstatic\\.com/);\n  assert.match(html, /img-src 'self' data: blob:;/);\n  assert.doesNotMatch(html, /img-src[^;]*\\shttps:/);\n  assert.match(html, /script-src 'self'/);\n});\n\ntest("runtime version identifiers are consistent", () => {\n  const pkg = JSON.parse(read("package.json"));\n  assert.equal(pkg.version, VERSION);\n  assert.match(read("hardening-core.js"), new RegExp(`APP_VERSION = ["']${'${VERSION.replaceAll(".", "\\\\.")}'}["']`));\n  assert.match(read("ota-updater.js"), new RegExp(`BUNDLED_APP_VERSION = ["']${'${VERSION.replaceAll(".", "\\\\.")}'}["']`));\n  assert.match(read("wellness2.js"), new RegExp(`W2_VERSION = ["']${'${VERSION.replaceAll(".", "\\\\.")}'}["']`));\n  assert.match(read("sw.js"), new RegExp(`wellness-${'${VERSION.replaceAll(".", "\\\\.")}'}`));\n  assert.match(read("index.html"), new RegExp(`Wellness ${'${VERSION.replaceAll(".", "\\\\.")}'}`));\n});\n\ntest("Open Food Facts uses v3, identifies Wellness and has network safeguards", () => {\n  const source = read("wellness2.js");\n  assert.match(source, /openfoodfacts\\.org\\/api\\/v3\\/product/);\n  assert.doesNotMatch(source, /openfoodfacts\\.org\\/api\\/v2\\/product/);\n  assert.match(source, /app_name/);\n  assert.match(source, /app_version/);\n  assert.match(source, /User-Agent/);\n  assert.match(source, /AbortController/);\n  assert.match(source, /response\\.status === 429/);\n  assert.match(source, /credentials: "omit"/);\n});\n\ntest("privacy, licensing and architecture documentation are present", () => {\n  for (const file of ["PRIVACY.md", "THIRD_PARTY_NOTICES.md", "LICENSE", "ARCHITECTURE.md", "CONTRIBUTING.md"]) {\n    assert.equal(fs.existsSync(file), true, `${'${file}'} absent`);\n  }\n  assert.match(read("THIRD_PARTY_NOTICES.md"), /Anses\\. 2025\\. Table de composition nutritionnelle des aliments Ciqual/);\n  assert.match(read("THIRD_PARTY_NOTICES.md"), /Open Database License|ODbL/);\n});\n\ntest("legal and accessibility runtime is included in production", () => {\n  const html = read("index.html");\n  const build = read("scripts/build-web.mjs");\n  const sw = read("sw.js");\n  const legal = read("legal.js");\n  assert.match(html, /src="legal\\.js"/);\n  assert.match(build, /"legal\\.js"/);\n  assert.match(sw, /"\\.\\/legal\\.js"/);\n  assert.match(legal, /aria-current/);\n  assert.match(legal, /aria-live/);\n  assert.match(legal, /w56-allergy-note/);\n});\n\ntest("PWA manifest has stable app identity and locale", () => {\n  const manifest = JSON.parse(read("manifest.webmanifest"));\n  assert.equal(manifest.id, "./");\n  assert.equal(manifest.lang, "fr");\n  assert.deepEqual(manifest.display_override, ["standalone", "minimal-ui"]);\n});\n\ntest("GitHub quality runner and Node version are reproducible", () => {\n  const workflow = read(".github/workflows/quality.yml");\n  assert.match(workflow, /runs-on: ubuntu-24\\.04/);\n  assert.match(workflow, /actions\\/setup-node@[0-9a-f]{40}/);\n  assert.match(workflow, /node-version: 22\\.11\\.0/);\n  assert.match(workflow, /npm run test:e2e/);\n});\n\ntest("production script references resolve to tracked source files", () => {\n  const html = read("index.html");\n  const refs = [...html.matchAll(/<script\\s+src="([^"]+)"/g)].map((match) => match[1]);\n  assert.ok(refs.length > 10);\n  for (const ref of refs) assert.equal(fs.existsSync(ref), true, `${'${ref}'} absent`);\n});\n\ntest("large legacy modules cannot grow silently", () => {\n  const limits = { "app.js": 140_000, "wellness2.js": 85_000, "style.css": 300_000 };\n  for (const [file, max] of Object.entries(limits)) {\n    assert.ok(fs.statSync(file).size <= max, `${'${file}'} dépasse ${'${max}'} octets : refactorisation requise`);\n  }\n});\n\nfor (const [name, fn] of tests) {\n  try { await fn(); passed += 1; console.log(`✓ ${'${name}'}`); }\n  catch (error) { console.error(`✕ ${'${name}'}\\n  ${'${error.message}'}`); process.exitCode = 1; }\n}\nconsole.log(`\\n${'${passed}'} / ${'${tests.length}'} contrôles qualité 5.6 réussis`);\nif (passed !== tests.length) process.exitCode = 1;\n`);

// ---------------------------------------------------------------------------
// Documentation + legal
// ---------------------------------------------------------------------------
write("PRIVACY.md", `# Politique de confidentialité — Wellness ${VERSION}\n\nDernière mise à jour : 28 août 2026.\n\n## Principe\n\nWellness est conçu pour fonctionner localement par défaut. Il n’intègre ni publicité, ni profilage publicitaire, ni SDK de télémétrie marketing.\n\n## Données traitées\n\nSelon les fonctions utilisées, Wellness peut traiter : profil (prénom facultatif, âge, taille, poids et objectifs), journal alimentaire, hydratation, activité, sommeil, humeur/énergie, historique de poids et mensurations, préférences alimentaires, recettes, planning, photos de progression et réglages.\n\nCes informations peuvent être sensibles. Elles sont destinées au suivi personnel et ne constituent pas un dossier médical.\n\n## Stockage local\n\nLes données applicatives ordinaires sont conservées dans l’espace de stockage de l’application/navigateur sur l’appareil. Les photos de progression sont déplacées vers IndexedDB lorsque cette fonction est disponible. Sur iOS natif, les sessions Supabase et tokens pris en charge sont placés dans le stockage sécurisé du système et ne sont pas inclus dans les sauvegardes ordinaires.\n\nUne personne ayant accès à un appareil déverrouillé peut potentiellement accéder aux données locales : utilise le verrouillage et les protections système de l’appareil.\n\n## Synchronisation Supabase facultative\n\nLe cloud n’est utilisé que si l’utilisateur le configure volontairement. Wellness envoie alors une copie assainie des données applicatives vers le projet Supabase choisi. Les access tokens, refresh tokens, mots de passe, tokens IA et clés secrètes ne sont pas inclus dans le payload synchronisé.\n\nLes règles Row Level Security fournies limitent la ligne cloud à l’utilisateur authentifié. L’utilisateur peut supprimer ses données cloud depuis Wellness.\n\n## Open Food Facts\n\nLors d’une recherche de code-barres, le code saisi/scanné est envoyé à Open Food Facts pour récupérer les informations nutritionnelles disponibles. Comme pour toute requête Internet, le service distant reçoit les informations réseau nécessaires à la communication (par exemple l’adresse IP). Wellness n’envoie pas le profil Wellness à Open Food Facts.\n\n## Ciqual / Anses\n\nLa base Ciqual utilisée par Wellness est intégrée localement et chargée à la demande. Une recherche dans cette base ne nécessite pas d’envoyer le profil de l’utilisateur à l’Anses.\n\n## Analyse photo facultative\n\nL’utilisateur peut configurer son propre endpoint d’analyse photo compatible. Dans ce cas, la photo et la description choisies peuvent être transmises à cet endpoint, avec un Bearer token facultatif. Wellness n’active pas cette transmission sans configuration et action de l’utilisateur.\n\n## Apple Santé / HealthKit\n\nSur une installation iOS disposant des autorisations et d’une signature compatibles, Wellness peut demander l’accès aux catégories Apple Santé annoncées dans l’application. iOS contrôle les autorisations. Wellness doit continuer à fonctionner si l’utilisateur refuse l’accès ou si HealthKit n’est pas disponible.\n\n## Caméra et notifications\n\nLa caméra est demandée pour le scanner de codes-barres. Les notifications locales sont utilisées uniquement si l’utilisateur les autorise et active des rappels.\n\n## Sauvegardes\n\nUne sauvegarde exportée est un fichier lisible contenant les données Wellness assainies. Conserve-le dans un emplacement auquel seules les personnes autorisées ont accès. Il n’est pas chiffré par mot de passe dans la version actuelle.\n\n## Conservation et suppression\n\nLes données locales restent présentes jusqu’à leur suppression dans l’application, l’effacement des données de l’application/navigateur ou la désinstallation selon le comportement de la plateforme. Les données Supabase restent présentes jusqu’à leur suppression par l’utilisateur ou selon la politique du projet Supabase configuré.\n\n## Services tiers et licences\n\nLes sources et licences tierces sont détaillées dans `THIRD_PARTY_NOTICES.md`.\n\n## Santé\n\nWellness est un outil d’information et de suivi général, pas un dispositif médical. Les estimations nutritionnelles, tendances et recommandations ne remplacent pas un professionnel de santé.\n`);

write("THIRD_PARTY_NOTICES.md", `# Sources et licences tierces\n\n## Anses — Ciqual 2025\n\nWellness réutilise des données issues de la table Ciqual. Attribution : **Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.**\n\nSource officielle : https://ciqual.anses.fr/\n\nLes conditions de réutilisation de la source d’origine restent applicables. Wellness ne revendique aucun droit sur les données Ciqual.\n\n## Open Food Facts\n\nLes informations de produits récupérées par code-barres proviennent d’Open Food Facts. La base Open Food Facts est disponible sous **Open Database License (ODbL)** ; les contenus individuels relèvent de la Database Contents License et les images, lorsqu’elles sont utilisées, peuvent relever de licences distinctes précisées par Open Food Facts. Wellness ${VERSION} n’affiche actuellement pas d’images de produits Open Food Facts.\n\nDocumentation licences : https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/\n\nLes données communautaires peuvent être incomplètes ou erronées. Vérifie toujours l’étiquette du produit lorsque l’exactitude est importante, particulièrement en cas d’allergie.\n\n## Dépendances npm\n\nLes dépendances JavaScript conservent leurs propres licences. `package-lock.json` fixe les versions utilisées par les builds reproductibles.\n`);

write("LICENSE", `Copyright (c) 2026 Wellness repository owner\nAll rights reserved.\n\nNo permission is granted to copy, modify, redistribute, sublicense, sell, or use the Wellness source code outside the rights provided by applicable law, unless the repository owner grants permission separately in writing.\n\nThird-party data, libraries, trademarks, and other materials remain governed by their respective licenses and terms. See THIRD_PARTY_NOTICES.md.\n`);

write("ARCHITECTURE.md", `# Architecture Wellness ${VERSION}\n\n## Principes\n\nWellness est une application Web progressive empaquetée avec Capacitor. La source Web reste la référence et `www/` est toujours généré par `npm run build:web`.\n\n## Couches\n\n- **État historique** : `app.js`, avec les fonctions de base et la compatibilité des anciennes données.\n- **Fonctions produit** : `features.js`, `wellness2.js` et les modules fonctionnels spécialisés.\n- **Noyaux testables** : `core-utils.js`, `food-units-core.js`, `hardening-core.js` et autres fichiers `*-core.js`.\n- **Sécurité/persistance** : `hardening.js`, `cloud.js`.\n- **Présentation** : `ux-shell.js`, `style.css`, modules d’évolution UX, `legal.js`.\n- **Natif** : `native-bridge.js`, HealthKit et configuration Capacitor.\n- **Release** : `scripts/`, GitHub Actions et Codemagic.\n\n## Règles de maintenance\n\n1. Ne pas ajouter de nouvelle donnée sensible dans `localStorage` si elle peut aller dans le stockage sécurisé natif.\n2. Toute donnée externe injectée dans le DOM doit passer par `textContent` ou un échappement explicite.\n3. Éviter les nouveaux remplacements de fonctions globales ; préférer un module autonome ou un noyau pur testable.\n4. Les nouveaux modules de production doivent être ajoutés à `scripts/build-web.mjs`, au service worker si nécessaire, et aux tests qualité.\n5. Les fichiers `v42`, `v43`, `v44`, `v51`, `v52`, `v53`, `v541` sont des couches historiques maintenues pour compatibilité. Leur logique doit être progressivement déplacée vers des modules nommés par responsabilité lors de modifications futures, sans réécriture globale risquée.\n6. `app.js`, `wellness2.js` et `style.css` ont des seuils de taille contrôlés par la CI pour empêcher la dette de croître silencieusement.\n\n## Direction de refactorisation\n\nLa cible progressive est : `state/`, `storage/`, `nutrition/`, `cloud/`, `native/`, `ui/` et `security/`, avec APIs explicites et tests avant chaque extraction. Une réécriture massive n’est pas recommandée tant que l’application stable fonctionne sur appareil réel.\n`);

write("CONTRIBUTING.md", `# Contribuer à Wellness\n\n## Workflow\n\n- partir de `main` à jour ;\n- créer une branche `fix/*`, `feat/*` ou `chore/*` ;\n- utiliser des Conventional Commits en anglais ;\n- exécuter `npm ci` puis `npm run verify:ci` ;\n- pour une modification UI, exécuter aussi `npx playwright install chromium` puis `npm run test:e2e` ;\n- ouvrir une pull request et attendre la Quality Gate verte avant fusion.\n\n## Sécurité\n\nNe jamais committer de clé `service_role`, `sb_secret_*`, mot de passe, token, certificat Apple ou clé privée. Utiliser des données de test anonymisées.\n\n## UI\n\nPréserver les cibles tactiles de 44 px, les focus visibles, les safe areas iOS, `prefers-reduced-motion` et les deux thèmes. Les messages dynamiques importants doivent être annoncés via une région live.\n`);

write(".editorconfig", `root = true\n\n[*]\ncharset = utf-8\nend_of_line = lf\ninsert_final_newline = true\nindent_style = space\nindent_size = 2\ntrim_trailing_whitespace = true\n\n[*.md]\ntrim_trailing_whitespace = false\n`);
write(".gitattributes", `* text=auto eol=lf\n*.png binary\n*.zip binary\n*.ipa binary\n`);
write(".github/CODEOWNERS", `* @gregorylaporte1810-gif\n`);
write(".github/pull_request_template.md", `## Résumé\n\nDécris le changement et son impact utilisateur.\n\n## Vérifications\n\n- [ ] npm run verify:ci\n- [ ] npm run test:e2e (si UI/runtime)\n- [ ] Aucun secret ni donnée personnelle ajouté\n- [ ] Test iPhone si une fonction native est modifiée\n\n## Risques / rollback\n\nDécris les risques connus et comment revenir en arrière si nécessaire.\n`);

let readme = read("README.md");
readme = readme.replaceAll("Wellness 5.5.0", `Wellness ${VERSION}`);
readme = readme.replaceAll("version 5.5.0", `version ${VERSION}`);
readme = readme.replaceAll("**Wellness 5.5.0**", `**Wellness ${VERSION}**`);
if (!readme.includes("## Qualité navigateur et accessibilité")) {
  readme += `\n\n## Qualité navigateur et accessibilité\n\nLa Quality Gate exécute également des tests Playwright sur mobile et desktop Chromium, ainsi qu’un audit axe des violations d’accessibilité critiques/sérieuses.\n\n\`\`\`bash\nnpx playwright install chromium\nnpm run test:e2e\n\`\`\`\n\n## Confidentialité, sources et licence\n\n- \`PRIVACY.md\` décrit les données et services utilisés ;\n- \`THIRD_PARTY_NOTICES.md\` documente notamment Ciqual 2025 et Open Food Facts ;\n- \`LICENSE\` précise les droits sur le code Wellness ;\n- \`ARCHITECTURE.md\` fixe la trajectoire de refactorisation et les règles de maintenance.\n`;
}
write("README.md", readme);

let security = read("SECURITY.md");
security = security.replaceAll("5.5.x", "5.6.x");
if (!security.includes("## Protection du dépôt")) {
  security += `\n\n## Protection du dépôt\n\nLa configuration recommandée de \`main\` est : pull request obligatoire, Quality Gate requise, force-push et suppression interdits. Si ces règles ne sont pas disponibles via l’intégration utilisée, elles doivent être activées dans les paramètres GitHub du dépôt. La branche \`ota\` doit rester inscriptible uniquement par le workflow de publication prévu.\n\n## Risques résiduels assumés\n\n- les données applicatives ordinaires ne sont pas chiffrées de bout en bout par Wellness ; la protection de l’appareil reste importante ;\n- les sauvegardes JSON exportées ne sont pas chiffrées par mot de passe ;\n- le SHA-256 OTA protège l’intégrité déclarée, mais une signature asymétrique indépendante nécessite une clé privée gérée hors dépôt.\n`;
}
write("SECURITY.md", security);

let changelog = read("CHANGELOG.md");
if (!changelog.includes(`## ${VERSION}`)) {
  changelog = changelog.replace(/^#([^\n]*)\n/, (match) => `${match}\n## ${VERSION} — 2026-08-28\n\n- validation HTML et CSP resserrée ;\n- suppression de Google Fonts au profit des polices système ;\n- Open Food Facts migré vers API v3 avec timeout, gestion HTTP et identification client ;\n- politique de confidentialité, sources/licences et architecture documentées ;\n- avertissement allergènes et régions live d’accessibilité ;\n- navigation active exposée via aria-current ;\n- PWA et cache versionnés 5.6 ;\n- GitHub Actions reproductibles sur Ubuntu 24.04 + Node 22.11.0 ;\n- tests Playwright mobile/desktop et audit axe ajoutés ;\n- garde-fous de taille pour limiter la dette des gros modules historiques.\n\n`);
}
write("CHANGELOG.md", changelog);

console.log(`✅ Migration Wellness ${VERSION} préparée.`);
