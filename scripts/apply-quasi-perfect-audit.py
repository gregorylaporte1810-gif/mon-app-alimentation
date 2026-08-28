from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path.cwd()
VERSION = "5.6.0"
NODE_VERSION = "22.23.2"
SETUP_NODE_SHA = "48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e"  # actions/setup-node v6.4.0


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content.replace("\r\n", "\n"), encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise RuntimeError(f"Motif introuvable pour {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Package metadata and quality scripts
# ---------------------------------------------------------------------------
pkg = json.loads(read("package.json"))
pkg["version"] = VERSION
pkg["description"] = (
    "Wellness 5.6.0 - production hardening, privacy, accessibility and release quality"
)
pkg["engines"] = {"node": ">=22.16.0"}
scripts = pkg.setdefault("scripts", {})
scripts["lint:html"] = "html-validate index.html"
scripts["test:quality"] = "node scripts/test-quality-standards.mjs"
scripts["test:e2e"] = "playwright test"
if "npm run test:quality" not in scripts["test"]:
    scripts["test"] += " && npm run test:quality"
scripts["verify"] = "npm run check:syntax && npm run lint:html && npm test && npm run build:web"
for file in ["legal.js", "scripts/test-quality-standards.mjs", "scripts/serve-web.mjs"]:
    check = f"node --check {file}"
    if check not in scripts["check:syntax"]:
        scripts["check:syntax"] += f" && {check}"
write("package.json", json.dumps(pkg, ensure_ascii=False, indent=2) + "\n")

write(
    ".htmlvalidate.json",
    json.dumps(
        {
            "$schema": "https://html-validate.org/schemas/config.json",
            "extends": ["html-validate:standard"],
        },
        indent=2,
    )
    + "\n",
)

# ---------------------------------------------------------------------------
# HTML: valid structure, tighter CSP and no remote font dependency
# ---------------------------------------------------------------------------
html = read("index.html")
html = html.replace("Wellness 5.5.0", f"Wellness {VERSION}")
html = replace_once(
    html,
    '<meta name="theme-color" content="#0b1220">',
    '<meta name="theme-color" content="#0b1220">\n'
    '  <meta name="color-scheme" content="dark light">\n'
    '  <meta name="format-detection" content="telephone=no">',
    "métadonnées document",
)
html = html.replace(
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com data:; "
    "img-src 'self' data: blob: https:;",
    "style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:;",
)
html = re.sub(
    r'\n\s*<link rel="preconnect" href="https://fonts\.googleapis\.com">\n'
    r'\s*<link rel="preconnect" href="https://fonts\.gstatic\.com" crossorigin>\n'
    r'\s*<link href="https://fonts\.googleapis\.com/css2\?family=Inter:[^\n]+\n',
    "\n",
    html,
    count=1,
)
html = replace_once(
    html,
    '  <script src="layout-v541.js"></script>',
    '  <script src="layout-v541.js"></script>\n  <script src="legal.js"></script>',
    "chargement legal.js",
)
html = re.sub(r"</body>\s*</body>\s*</html>\s*$", "</body>\n\n</html>\n", html, flags=re.I)
write("index.html", html)

# ---------------------------------------------------------------------------
# CSS: use platform fonts and add a small finishing layer
# ---------------------------------------------------------------------------
css = read("style.css")
css = css.replace(
    'font-family: "Inter", "Segoe UI", Arial, sans-serif;',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;',
)
css = css.replace(
    "Inter, system-ui, sans-serif",
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
)
if "WELLNESS 5.6 — LEGAL + ACCESSIBILITY FINISH" not in css:
    css += r'''

/* ======================================================
   WELLNESS 5.6 — LEGAL + ACCESSIBILITY FINISH
====================================================== */
.w56-legal-card { margin-top: 18px; }
.w56-legal-card h2 { margin-bottom: 8px; }
.w56-legal-card p { margin-bottom: 10px; }
.w56-legal-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.w56-legal-links a { display: inline-flex; align-items: center; min-height: 44px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; color: var(--text-soft); text-decoration: none; background: rgba(255,255,255,.035); }
.w56-legal-links a:hover { border-color: rgba(96,165,250,.35); color: var(--text); }
.w56-allergy-note { margin: 9px 0 0; padding: 10px 12px; border: 1px solid rgba(250,204,21,.18); border-radius: 12px; color: #d7c78b; background: rgba(250,204,21,.055); font-size: .76rem; line-height: 1.5; }
html[data-theme="light"] .w56-allergy-note { color: #725d00; background: rgba(250,204,21,.10); }
.navigation-principale .nav-bouton[aria-current="page"] { position: relative; }
@media (max-width: 700px) {
  .w56-legal-links { display: grid; grid-template-columns: 1fr; }
  .w56-legal-links a { width: 100%; }
}
'''
write("style.css", css)

# ---------------------------------------------------------------------------
# Version consistency
# ---------------------------------------------------------------------------
hardening_core = read("hardening-core.js").replace(
    'const APP_VERSION = "5.5.0";', f'const APP_VERSION = "{VERSION}";'
)
write("hardening-core.js", hardening_core)

ota = read("ota-updater.js").replace(
    'const BUNDLED_APP_VERSION = "5.5.0";',
    f'const BUNDLED_APP_VERSION = "{VERSION}";',
)
ota = ota.replace(
    "Inter, system-ui, sans-serif",
    "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
)
write("ota-updater.js", ota)

sw = re.sub(
    r'const CACHE = "wellness-[^"]+";',
    f'const CACHE = "wellness-{VERSION}";',
    read("sw.js"),
    count=1,
)
if '"./legal.js"' not in sw:
    sw = replace_once(sw, '  "./layout-v541.js",', '  "./layout-v541.js",\n  "./legal.js",', "service worker legal.js")
write("sw.js", sw)

# ---------------------------------------------------------------------------
# Open Food Facts: API v3, timeout, HTTP handling and client attribution
# ---------------------------------------------------------------------------
wellness2 = re.sub(
    r'const W2_VERSION = "[^"]+";',
    f'const W2_VERSION = "{VERSION}";',
    read("wellness2.js"),
    count=1,
)
marker = "async function w2LookupBarcode(code) {"
if "function w2OpenFoodFactsUrl(code)" not in wellness2:
    helper = r'''const W2_OFF_API_BASE = "https://world.openfoodfacts.org/api/v3/product";
const W2_OFF_TIMEOUT_MS = 10000;

function w2OpenFoodFactsUrl(code) {
  const url = new URL(`${W2_OFF_API_BASE}/${encodeURIComponent(code)}`);
  url.searchParams.set("fields", "product_name,nutriments,serving_size,brands");
  url.searchParams.set("lc", "fr");
  url.searchParams.set("cc", "fr");
  url.searchParams.set("app_name", "Wellness");
  url.searchParams.set("app_version", W2_VERSION);
  // WKWebView/browser fetch cannot reliably override the User-Agent header.
  // Open Food Facts accepts an identification parameter when the header cannot be set.
  url.searchParams.set(
    "User-Agent",
    `Wellness/${W2_VERSION} (https://github.com/gregorylaporte1810-gif/mon-app-alimentation)`,
  );
  return url.toString();
}

async function w2FetchOpenFoodFacts(code) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), W2_OFF_TIMEOUT_MS);

  try {
    const response = await fetch(w2OpenFoodFactsUrl(code), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });

    if (response.status === 404) return null;
    if (response.status === 429) {
      throw new Error("Open Food Facts limite temporairement les requêtes. Réessaie dans quelques instants.");
    }
    if (!response.ok) {
      throw new Error(`Open Food Facts indisponible (HTTP ${response.status})`);
    }
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Open Food Facts met trop de temps à répondre.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

'''
    wellness2 = replace_once(wellness2, marker, helper + marker, "helper Open Food Facts v3")

old_fetch = r'''    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(value)}.json?fields=product_name,nutriments,serving_size,brands`,
    );
    const data = await response.json();'''
wellness2 = replace_once(
    wellness2,
    old_fetch,
    "    const data = await w2FetchOpenFoodFacts(value);",
    "appel Open Food Facts v3",
)
old_empty = r'''  if (!value) {
    result.innerHTML =
      '<p class="mega-inline-message">Saisis un code-barres.</p>';
    return false;
  }'''
new_empty = old_empty + r'''
  if (!/^[A-Za-z0-9._-]{4,64}$/.test(value)) {
    result.innerHTML =
      '<p class="mega-inline-message">Code-barres invalide. Vérifie la valeur scannée ou saisie.</p>';
    return false;
  }'''
wellness2 = replace_once(wellness2, old_empty, new_empty, "validation code-barres")
write("wellness2.js", wellness2)

# ---------------------------------------------------------------------------
# Runtime accessibility + legal/source attribution
# ---------------------------------------------------------------------------
write(
    "legal.js",
    f'''(() => {{
  "use strict";

  const VERSION = "{VERSION}";
  const REPO = "https://github.com/gregorylaporte1810-gif/mon-app-alimentation";

  function markLiveRegions() {{
    const selectors = [
      '[id^="message-"]',
      '[id$="-message"]',
      '#w2-barcode-result',
      '#w2-backup-message',
      '#w2-cloud-message',
      '#w2-photo-message',
      '#mega-reminder-message',
    ].join(',');
    document.querySelectorAll(selectors).forEach((element) => {{
      if (!element.hasAttribute("role")) element.setAttribute("role", "status");
      if (!element.hasAttribute("aria-live")) element.setAttribute("aria-live", "polite");
      if (!element.hasAttribute("aria-atomic")) element.setAttribute("aria-atomic", "true");
    }});
  }}

  function syncNavigationState() {{
    document.querySelectorAll(".navigation-principale .nav-bouton[data-page]").forEach((button) => {{
      const page = document.getElementById(`page-${{button.dataset.page}}`);
      const current = button.classList.contains("active") || page?.classList.contains("active");
      if (current) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }});
  }}

  function installAllergyDisclaimer() {{
    const grid = document.getElementById("w2-allergy-grid");
    if (!grid || document.getElementById("w56-allergy-note")) return;
    const note = document.createElement("p");
    note.id = "w56-allergy-note";
    note.className = "w56-allergy-note";
    note.textContent = "Allergies : les filtres Wellness sont indicatifs et basés sur les informations disponibles. En cas d’allergie, vérifie toujours l’étiquette et les traces éventuelles du produit.";
    grid.insertAdjacentElement("afterend", note);
  }}

  function installLegalCard() {{
    const page = document.getElementById("page-profil");
    if (!page || document.getElementById("w56-legal-card")) return;
    const card = document.createElement("section");
    card.id = "w56-legal-card";
    card.className = "carte w56-legal-card";
    card.setAttribute("aria-labelledby", "w56-legal-title");
    card.innerHTML = `
      <p class="sur-titre">Transparence</p>
      <h2 id="w56-legal-title">Confidentialité & sources</h2>
      <p>Wellness fonctionne localement par défaut. Le cloud Supabase, l’analyse photo et Apple Santé sont optionnels. Wellness ne contient ni publicité ni télémétrie publicitaire.</p>
      <p><strong>Ciqual :</strong> Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.</p>
      <p><strong>Open Food Facts :</strong> données communautaires réutilisées sous Open Database License (ODbL) ; leur exactitude n’est pas garantie.</p>
      <div class="w56-legal-links">
        <a href="${{REPO}}/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">Politique de confidentialité</a>
        <a href="${{REPO}}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">Sources & licences</a>
        <a href="https://ciqual.anses.fr/" target="_blank" rel="noopener noreferrer">Anses Ciqual</a>
        <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a>
      </div>
      <small>Wellness ${{VERSION}} · outil de suivi général, non dispositif médical.</small>
    `;
    page.appendChild(card);
  }}

  function install() {{
    markLiveRegions();
    syncNavigationState();
    installAllergyDisclaimer();
    installLegalCard();

    const observer = new MutationObserver((mutations) => {{
      if (mutations.some((mutation) => mutation.type === "attributes" && mutation.attributeName === "class")) {{
        syncNavigationState();
      }}
      if (mutations.some((mutation) => mutation.type === "childList")) markLiveRegions();
    }});
    observer.observe(document.body, {{
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"],
    }});
  }}

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {{ once: true }});
  else install();

  window.WellnessLegal = {{ version: VERSION, syncNavigationState, markLiveRegions }};
}})();
''',
)

# ---------------------------------------------------------------------------
# Build, PWA and cache inclusion
# ---------------------------------------------------------------------------
build_web = read("scripts/build-web.mjs")
if '"legal.js"' not in build_web:
    build_web = replace_once(
        build_web,
        '  "layout-v541.js",',
        '  "layout-v541.js",\n  "legal.js",',
        "bundle legal.js",
    )
write("scripts/build-web.mjs", build_web)

manifest = json.loads(read("manifest.webmanifest"))
manifest.update(
    {
        "id": "./",
        "lang": "fr",
        "dir": "ltr",
        "name": "Wellness 5.6 - Nutrition, activité & bien-être",
        "display_override": ["standalone", "minimal-ui"],
        "prefer_related_applications": False,
    }
)
write("manifest.webmanifest", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

# ---------------------------------------------------------------------------
# Reproducible CI and Codemagic runtime
# ---------------------------------------------------------------------------
def add_setup_node(workflow: str) -> str:
    workflow = workflow.replace("runs-on: ubuntu-latest", "runs-on: ubuntu-24.04")
    old = "      - name: Verify Node.js runtime\n        run: node --version && npm --version"
    new = (
        "      - name: Set up Node.js\n"
        f"        uses: actions/setup-node@{SETUP_NODE_SHA} # v6.4.0\n"
        "        with:\n"
        f"          node-version: {NODE_VERSION}\n"
        "          package-manager-cache: false\n\n"
        "      - name: Verify Node.js runtime\n"
        "        run: node --version && npm --version"
    )
    if "actions/setup-node@" not in workflow:
        workflow = replace_once(workflow, old, new, "setup-node")
    else:
        workflow = re.sub(r"node-version:\s*[^\n]+", f"node-version: {NODE_VERSION}", workflow)
    return workflow

quality = add_setup_node(read(".github/workflows/quality.yml"))
if "Run browser and accessibility tests" not in quality:
    quality = replace_once(
        quality,
        "      - name: Audit production and development dependencies\n        run: npm audit --audit-level=high",
        "      - name: Install Chromium for browser tests\n"
        "        run: npx playwright install --with-deps chromium\n\n"
        "      - name: Run browser and accessibility tests\n"
        "        run: npm run test:e2e\n\n"
        "      - name: Audit production and development dependencies\n"
        "        run: npm audit --audit-level=high",
        "tests navigateur CI",
    )
write(".github/workflows/quality.yml", quality)

ota_workflow = add_setup_node(read(".github/workflows/ota-web-update.yml"))
if '      - "legal.js"' not in ota_workflow:
    ota_workflow = replace_once(
        ota_workflow,
        '      - "layout-v541.js"',
        '      - "layout-v541.js"\n      - "legal.js"',
        "trigger OTA legal.js",
    )
write(".github/workflows/ota-web-update.yml", ota_workflow)

for codemagic_file in ["codemagic.yaml", "codemagic-testflight.template.yaml"]:
    content = read(codemagic_file).replace("node: v22.11.0", f"node: v{NODE_VERSION}")
    write(codemagic_file, content)

# ---------------------------------------------------------------------------
# Browser test infrastructure
# ---------------------------------------------------------------------------
write(
    "scripts/serve-web.mjs",
    '''import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "www");
const port = Number(process.env.PORT || 4173);
const mime = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json; charset=utf-8"],
  [".png", "image/png"],
]);

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://127.0.0.1:" + port);
  const pathname = decodeURIComponent(
    requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname,
  );
  const target = path.resolve(root, "." + pathname);

  if (!target.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.stat(target, (statError, stat) => {
    if (statError || !stat.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }

    response.setHeader(
      "Content-Type",
      mime.get(path.extname(target)) || "application/octet-stream",
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "no-referrer");
    fs.createReadStream(target).pipe(response);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log("Wellness test server: http://127.0.0.1:" + port);
});
''',
)

write(
    "playwright.config.mjs",
    '''import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30000,
  retries: 1,
  reporter: [["line"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 15"], browserName: "chromium" },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node scripts/serve-web.mjs",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 15000,
  },
});
''',
)

write(
    "tests/e2e/app.spec.mjs",
    r'''import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Wellness loads with accessible primary navigation", async ({ page }) => {
  await page.goto("/index.html");
  await expect(page).toHaveTitle(/Wellness 5\.6\.0/);
  await expect(page.locator("main.app")).toBeVisible();
  await expect(page.locator(".navigation-principale .nav-bouton")).toHaveCount(5);
  await expect(
    page.locator('.navigation-principale .nav-bouton[aria-current="page"]'),
  ).toHaveCount(1);
  await expect(page.locator("#w56-legal-card")).toHaveCount(1);
});

test("light mode works without external Google Fonts", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("wellnessTheme", "light"));
  await page.goto("/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.locator('link[href*="fonts.googleapis.com"]').count()).toBe(0);
});

test("no critical or serious axe violations on the home screen", async ({ page }) => {
  await page.goto("/index.html");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const blocking = results.violations.filter((item) =>
    ["critical", "serious"].includes(item.impact),
  );
  expect(
    blocking,
    blocking.map((item) => `${item.id}: ${item.help}`).join("\n"),
  ).toEqual([]);
});

test("profile exposes privacy sources and allergy warning", async ({ page }) => {
  await page.goto("/index.html");
  await page.locator('.navigation-principale .nav-bouton[data-page="profil"]').click();
  await expect(page.locator("#w56-legal-card")).toBeVisible();
  await expect(page.locator("#w56-allergy-note")).toContainText(
    "vérifie toujours l’étiquette",
  );
});
''',
)

# ---------------------------------------------------------------------------
# Static regression tests for the new professional guarantees
# ---------------------------------------------------------------------------
write(
    "scripts/test-quality-standards.mjs",
    f'''import assert from "node:assert/strict";
import fs from "node:fs";

const VERSION = "{VERSION}";
const read = (file) => fs.readFileSync(file, "utf8");
let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("HTML has one body/html closing tag and unique static ids", () => {{
  const html = read("index.html");
  assert.equal((html.match(/<\\/body>/gi) || []).length, 1);
  assert.equal((html.match(/<\\/html>/gi) || []).length, 1);
  const ids = [...html.matchAll(/\\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepEqual(duplicates, []);
}});

test("CSP avoids arbitrary HTTPS images and remote Google fonts", () => {{
  const html = read("index.html");
  assert.doesNotMatch(html, /fonts\\.googleapis\\.com|fonts\\.gstatic\\.com/);
  assert.match(html, /img-src 'self' data: blob:;/);
  assert.doesNotMatch(html, /img-src[^;]*\\shttps:/);
  assert.match(html, /script-src 'self'/);
}});

test("runtime version identifiers are consistent", () => {{
  const expected = VERSION.replaceAll(".", "\\\\.");
  assert.equal(JSON.parse(read("package.json")).version, VERSION);
  assert.match(read("hardening-core.js"), new RegExp(`APP_VERSION = ["']${{expected}}["']`));
  assert.match(read("ota-updater.js"), new RegExp(`BUNDLED_APP_VERSION = ["']${{expected}}["']`));
  assert.match(read("wellness2.js"), new RegExp(`W2_VERSION = ["']${{expected}}["']`));
  assert.match(read("sw.js"), new RegExp(`wellness-${{expected}}`));
  assert.match(read("index.html"), new RegExp(`Wellness ${{expected}}`));
}});

test("Open Food Facts uses v3 with timeout and privacy safeguards", () => {{
  const source = read("wellness2.js");
  assert.match(source, /openfoodfacts\\.org\\/api\\/v3\\/product/);
  assert.doesNotMatch(source, /openfoodfacts\\.org\\/api\\/v2\\/product/);
  assert.match(source, /app_name/);
  assert.match(source, /app_version/);
  assert.match(source, /User-Agent/);
  assert.match(source, /AbortController/);
  assert.match(source, /response\\.status === 429/);
  assert.match(source, /credentials: "omit"/);
  assert.match(source, /referrerPolicy: "no-referrer"/);
}});

test("privacy, licensing and architecture documentation are present", () => {{
  for (const file of ["PRIVACY.md", "THIRD_PARTY_NOTICES.md", "LICENSE", "ARCHITECTURE.md", "CONTRIBUTING.md"]) {{
    assert.equal(fs.existsSync(file), true, `${{file}} absent`);
  }}
  assert.match(read("THIRD_PARTY_NOTICES.md"), /Anses\\. 2025\\. Table de composition nutritionnelle des aliments Ciqual/);
  assert.match(read("THIRD_PARTY_NOTICES.md"), /Open Database License|ODbL/);
}});

test("legal and accessibility runtime is included in production", () => {{
  const html = read("index.html");
  const build = read("scripts/build-web.mjs");
  const sw = read("sw.js");
  const legal = read("legal.js");
  assert.match(html, /src="legal\\.js"/);
  assert.match(build, /"legal\\.js"/);
  assert.match(sw, /"\\.\\/legal\\.js"/);
  assert.match(legal, /aria-current/);
  assert.match(legal, /aria-live/);
  assert.match(legal, /w56-allergy-note/);
}});

test("PWA manifest has stable identity and French locale", () => {{
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.id, "./");
  assert.equal(manifest.lang, "fr");
  assert.deepEqual(manifest.display_override, ["standalone", "minimal-ui"]);
}});

test("CI and Codemagic use reproducible supported Node runtimes", () => {{
  const workflow = read(".github/workflows/quality.yml");
  assert.match(workflow, /runs-on: ubuntu-24\\.04/);
  assert.match(workflow, /actions\\/setup-node@[0-9a-f]{{40}}/);
  assert.match(workflow, /node-version: {NODE_VERSION.replace('.', '\\.')}/);
  assert.match(workflow, /npm run test:e2e/);
  assert.match(read("codemagic.yaml"), /node: v{NODE_VERSION.replace('.', '\\.')}/);
}});

test("production script references resolve to tracked source files", () => {{
  const html = read("index.html");
  const refs = [...html.matchAll(/<script\\s+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(refs.length > 10);
  for (const ref of refs) assert.equal(fs.existsSync(ref), true, `${{ref}} absent`);
}});

test("large legacy modules cannot grow silently", () => {{
  const limits = {{ "app.js": 140000, "wellness2.js": 90000, "style.css": 300000 }};
  for (const [file, max] of Object.entries(limits)) {{
    assert.ok(
      fs.statSync(file).size <= max,
      `${{file}} dépasse ${{max}} octets : refactorisation requise`,
    );
  }}
}});

for (const [name, fn] of tests) {{
  try {{
    await fn();
    passed += 1;
    console.log(`✓ ${{name}}`);
  }} catch (error) {{
    console.error(`✕ ${{name}}\\n  ${{error.message}}`);
    process.exitCode = 1;
  }}
}}
console.log(`\\n${{passed}} / ${{tests.length}} contrôles qualité 5.6 réussis`);
if (passed !== tests.length) process.exitCode = 1;
''',
)

# ---------------------------------------------------------------------------
# Privacy, source/license and maintenance documentation
# ---------------------------------------------------------------------------
write(
    "PRIVACY.md",
    f'''# Politique de confidentialité — Wellness {VERSION}

Dernière mise à jour : 28 août 2026.

## Principe

Wellness est conçu pour fonctionner localement par défaut. Il n’intègre ni publicité, ni profilage publicitaire, ni SDK de télémétrie marketing.

## Données traitées

Selon les fonctions utilisées, Wellness peut traiter : profil (prénom facultatif, âge, taille, poids et objectifs), journal alimentaire, hydratation, activité, sommeil, humeur/énergie, historique de poids et mensurations, préférences alimentaires, recettes, planning, photos de progression et réglages.

Ces informations peuvent être sensibles. Elles sont destinées au suivi personnel et ne constituent pas un dossier médical.

## Stockage local

Les données applicatives ordinaires sont conservées dans l’espace de stockage de l’application ou du navigateur sur l’appareil. Les photos de progression sont déplacées vers IndexedDB lorsque cette fonction est disponible. Sur iOS natif, les sessions Supabase et tokens pris en charge sont placés dans le stockage sécurisé du système et ne sont pas inclus dans les sauvegardes ordinaires.

Une personne ayant accès à un appareil déverrouillé peut potentiellement accéder aux données locales : utilise le verrouillage et les protections système de l’appareil.

## Synchronisation Supabase facultative

Le cloud n’est utilisé que si l’utilisateur le configure volontairement. Wellness envoie alors une copie assainie des données applicatives vers le projet Supabase choisi. Les access tokens, refresh tokens, mots de passe, tokens IA et clés secrètes ne sont pas inclus dans le payload synchronisé.

Les règles Row Level Security fournies limitent la ligne cloud à l’utilisateur authentifié. L’utilisateur peut supprimer ses données cloud depuis Wellness.

## Open Food Facts

Lors d’une recherche de code-barres, le code saisi ou scanné est envoyé à Open Food Facts pour récupérer les informations nutritionnelles disponibles. Comme pour toute requête Internet, le service distant reçoit les informations réseau nécessaires à la communication, par exemple l’adresse IP. Wellness n’envoie pas le profil Wellness à Open Food Facts.

## Ciqual / Anses

La base Ciqual utilisée par Wellness est intégrée localement et chargée à la demande. Une recherche dans cette base ne nécessite pas d’envoyer le profil de l’utilisateur à l’Anses.

## Analyse photo facultative

L’utilisateur peut configurer son propre endpoint d’analyse photo compatible. Dans ce cas, la photo et la description choisies peuvent être transmises à cet endpoint, avec un Bearer token facultatif. Wellness n’active pas cette transmission sans configuration et action de l’utilisateur.

## Apple Santé / HealthKit

Sur une installation iOS disposant des autorisations et d’une signature compatibles, Wellness peut demander l’accès aux catégories Apple Santé annoncées dans l’application. iOS contrôle les autorisations. Wellness continue à fonctionner si l’utilisateur refuse l’accès ou si HealthKit n’est pas disponible.

## Caméra et notifications

La caméra est demandée pour le scanner de codes-barres. Les notifications locales sont utilisées uniquement si l’utilisateur les autorise et active des rappels.

## Sauvegardes

Une sauvegarde exportée est un fichier JSON lisible contenant les données Wellness assainies. Conserve-le dans un emplacement auquel seules les personnes autorisées ont accès. Il n’est pas chiffré par mot de passe dans la version actuelle.

## Conservation et suppression

Les données locales restent présentes jusqu’à leur suppression dans l’application, l’effacement des données de l’application ou du navigateur, ou la désinstallation selon le comportement de la plateforme. Les données Supabase restent présentes jusqu’à leur suppression par l’utilisateur ou selon la politique du projet Supabase configuré.

## Services tiers et licences

Les sources et licences tierces sont détaillées dans `THIRD_PARTY_NOTICES.md`.

## Santé

Wellness est un outil d’information et de suivi général, pas un dispositif médical. Les estimations nutritionnelles, tendances et recommandations ne remplacent pas un professionnel de santé.
''',
)

write(
    "THIRD_PARTY_NOTICES.md",
    f'''# Sources et licences tierces

## Anses — Ciqual 2025

Wellness réutilise des données issues de la table Ciqual. Attribution : **Anses. 2025. Table de composition nutritionnelle des aliments Ciqual.**

Source officielle : https://ciqual.anses.fr/

Les conditions de réutilisation de la source d’origine restent applicables. Wellness ne revendique aucun droit sur les données Ciqual.

## Open Food Facts

Les informations de produits récupérées par code-barres proviennent d’Open Food Facts. La base Open Food Facts est disponible sous **Open Database License (ODbL)** ; les contenus individuels relèvent de la Database Contents License et les images, lorsqu’elles sont utilisées, peuvent relever de licences distinctes précisées par Open Food Facts. Wellness {VERSION} n’affiche actuellement pas d’images de produits Open Food Facts.

Documentation licences : https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

Les données communautaires peuvent être incomplètes ou erronées. Vérifie toujours l’étiquette du produit lorsque l’exactitude est importante, particulièrement en cas d’allergie.

## Dépendances npm

Les dépendances JavaScript conservent leurs propres licences. `package-lock.json` fixe les versions utilisées par les builds reproductibles.
''',
)

write(
    "LICENSE",
    '''Copyright (c) 2026 Wellness repository owner
All rights reserved.

No permission is granted to copy, modify, redistribute, sublicense, sell, or use the Wellness source code outside the rights provided by applicable law, unless the repository owner grants permission separately in writing.

Third-party data, libraries, trademarks, and other materials remain governed by their respective licenses and terms. See THIRD_PARTY_NOTICES.md.
''',
)

write(
    "ARCHITECTURE.md",
    f'''# Architecture Wellness {VERSION}

## Principes

Wellness est une application Web progressive empaquetée avec Capacitor. La source Web reste la référence et `www/` est toujours généré par `npm run build:web`.

## Couches

- **État historique** : `app.js`, avec les fonctions de base et la compatibilité des anciennes données.
- **Fonctions produit** : `features.js`, `wellness2.js` et les modules fonctionnels spécialisés.
- **Noyaux testables** : `core-utils.js`, `food-units-core.js`, `hardening-core.js` et autres fichiers `*-core.js`.
- **Sécurité/persistance** : `hardening.js`, `cloud.js`.
- **Présentation** : `ux-shell.js`, `style.css`, modules d’évolution UX, `legal.js`.
- **Natif** : `native-bridge.js`, HealthKit et configuration Capacitor.
- **Release** : `scripts/`, GitHub Actions et Codemagic.

## Règles de maintenance

1. Ne pas ajouter de nouvelle donnée sensible dans `localStorage` si elle peut aller dans le stockage sécurisé natif.
2. Toute donnée externe injectée dans le DOM doit passer par `textContent` ou un échappement explicite.
3. Éviter les nouveaux remplacements de fonctions globales ; préférer un module autonome ou un noyau pur testable.
4. Les nouveaux modules de production doivent être ajoutés à `scripts/build-web.mjs`, au service worker si nécessaire, et aux tests qualité.
5. Les fichiers `v42`, `v43`, `v44`, `v51`, `v52`, `v53`, `v541` sont des couches historiques maintenues pour compatibilité. Leur logique doit être progressivement déplacée vers des modules nommés par responsabilité lors de modifications futures, sans réécriture globale risquée.
6. `app.js`, `wellness2.js` et `style.css` ont des seuils de taille contrôlés par la CI pour empêcher la dette de croître silencieusement.

## Direction de refactorisation

La cible progressive est : `state/`, `storage/`, `nutrition/`, `cloud/`, `native/`, `ui/` et `security/`, avec APIs explicites et tests avant chaque extraction. Une réécriture massive n’est pas recommandée tant que l’application stable fonctionne sur appareil réel.
''',
)

write(
    "CONTRIBUTING.md",
    '''# Contribuer à Wellness

## Workflow

- partir de `main` à jour ;
- créer une branche `fix/*`, `feat/*` ou `chore/*` ;
- utiliser des Conventional Commits en anglais ;
- exécuter `npm ci` puis `npm run verify:ci` ;
- pour une modification UI, installer Chromium avec `npx playwright install chromium`, puis exécuter `npm run test:e2e` ;
- ouvrir une pull request et attendre la Quality Gate verte avant fusion.

## Sécurité

Ne jamais committer de clé `service_role`, `sb_secret_*`, mot de passe, token, certificat Apple ou clé privée. Utiliser des données de test anonymisées.

## UI

Préserver les cibles tactiles de 44 px, les focus visibles, les safe areas iOS, `prefers-reduced-motion` et les deux thèmes. Les messages dynamiques importants doivent être annoncés via une région live.
''',
)

write(
    ".editorconfig",
    '''root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
''',
)
write(".gitattributes", "* text=auto eol=lf\n*.png binary\n*.zip binary\n*.ipa binary\n")
write(".github/CODEOWNERS", "* @gregorylaporte1810-gif\n")
write(
    ".github/pull_request_template.md",
    '''## Résumé

Décris le changement et son impact utilisateur.

## Vérifications

- [ ] `npm run verify:ci`
- [ ] `npm run test:e2e` si UI/runtime
- [ ] Aucun secret ni donnée personnelle ajouté
- [ ] Test iPhone si une fonction native est modifiée

## Risques / rollback

Décris les risques connus et comment revenir en arrière si nécessaire.
''',
)

readme = read("README.md").replace("Wellness 5.5.0", f"Wellness {VERSION}")
readme = readme.replace("version 5.5.0", f"version {VERSION}")
readme = readme.replace("**Wellness 5.5.0**", f"**Wellness {VERSION}**")
readme = readme.replace("Wellness-5.5.0-68f0d2ccb8a3", "Wellness-5.6.0-<sha>")
if "## Qualité navigateur et accessibilité" not in readme:
    readme += r'''

## Qualité navigateur et accessibilité

La Quality Gate exécute également des tests Playwright sur mobile et desktop Chromium, ainsi qu’un audit axe des violations d’accessibilité critiques ou sérieuses.

```bash
npx playwright install chromium
npm run test:e2e
```

## Confidentialité, sources et licence

- `PRIVACY.md` décrit les données et services utilisés ;
- `THIRD_PARTY_NOTICES.md` documente notamment Ciqual 2025 et Open Food Facts ;
- `LICENSE` précise les droits sur le code Wellness ;
- `ARCHITECTURE.md` fixe la trajectoire de refactorisation et les règles de maintenance.
'''
write("README.md", readme)

security = read("SECURITY.md").replace("5.5.x", "5.6.x")
if "## Protection du dépôt" not in security:
    security += r'''

## Protection du dépôt

La configuration recommandée de `main` est : pull request obligatoire, Quality Gate requise, force-push et suppression interdits. Si ces règles ne sont pas disponibles via l’intégration utilisée, elles doivent être activées dans les paramètres GitHub du dépôt. La branche `ota` doit rester inscriptible uniquement par le workflow de publication prévu.

## Risques résiduels assumés

- les données applicatives ordinaires ne sont pas chiffrées de bout en bout par Wellness ; la protection de l’appareil reste importante ;
- les sauvegardes JSON exportées ne sont pas chiffrées par mot de passe ;
- le SHA-256 OTA protège l’intégrité déclarée, mais une signature asymétrique indépendante nécessite une clé privée gérée hors dépôt.
'''
write("SECURITY.md", security)

changelog = read("CHANGELOG.md")
if f"## {VERSION}" not in changelog:
    heading_end = changelog.find("\n") + 1
    entry = f'''\n## {VERSION} — 2026-08-28

- HTML validé et CSP resserrée ;
- suppression de Google Fonts au profit des polices système ;
- Open Food Facts migré vers API v3 avec timeout, gestion HTTP et identification client ;
- politique de confidentialité, sources/licences et architecture documentées ;
- avertissement allergènes et régions live d’accessibilité ;
- navigation active exposée via `aria-current` ;
- PWA et cache versionnés 5.6 ;
- GitHub Actions reproductibles sur Ubuntu 24.04 + Node {NODE_VERSION} ;
- tests Playwright mobile/desktop et audit axe ajoutés ;
- garde-fous de taille pour limiter la dette des gros modules historiques.

'''
    changelog = changelog[:heading_end] + entry + changelog[heading_end:]
write("CHANGELOG.md", changelog)

print(f"✅ Migration Wellness {VERSION} préparée.")
