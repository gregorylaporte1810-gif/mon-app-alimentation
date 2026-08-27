import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) {
    throw new Error(`${path} introuvable. Lance ce script depuis la racine de mon-app-alimentation.`);
  }
  return readFileSync(path, "utf8");
}

function write(path, value) {
  writeFileSync(path, value, "utf8");
  console.log(`✅ ${path}`);
}

function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) {
    throw new Error(`Point de correction introuvable : ${label}`);
  }
  return source.replace(from, to);
}

console.log("Installation Wellness 5.3.3 - fermeture réelle du scanner...\n");

// ==========================================================
// 1. w2LookupBarcode retourne maintenant true/false.
//    Cela permet au scanner natif de savoir s'il faut rouvrir
//    la fenêtre seulement lorsque le produit est introuvable.
// ==========================================================
let w2 = read("wellness2.js");

w2 = replaceRequired(
  w2,
  `  if(!value){result.innerHTML='<p class="mega-inline-message">Saisis un code-barres.</p>';return;}`,
  `  if(!value){result.innerHTML='<p class="mega-inline-message">Saisis un code-barres.</p>';return false;}`,
  "barcode sans valeur"
);

w2 = replaceRequired(
  w2,
  `    if(!data?.product){result.innerHTML='<p class="mega-inline-message">Produit non trouvé dans Open Food Facts.</p>';return;}`,
  `    if(!data?.product){result.innerHTML='<p class="mega-inline-message">Produit non trouvé dans Open Food Facts.</p>';return false;}`,
  "barcode produit absent"
);

w2 = replaceRequired(
  w2,
  `      setTimeout(() => w2OpenPortion(food), 40);
    }
  } catch(err) { result.innerHTML=\`<p class="mega-inline-message">Impossible d'interroger la base en ligne. Vérifie ta connexion. (\${w2Escape(err.message)})</p>\`; }
}`,
  `      setTimeout(() => w2OpenPortion(food), 40);
    }
    return true;
  } catch(err) {
    result.innerHTML=\`<p class="mega-inline-message">Impossible d'interroger la base en ligne. Vérifie ta connexion. (\${w2Escape(err.message)})</p>\`;
    return false;
  }
}`,
  "retour succès/erreur barcode"
);

w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.3.3";');
write("wellness2.js", w2);

// ==========================================================
// 2. Scanner natif ML Kit : NE ROUVRE PLUS la fenêtre web
//    après avoir détecté le code.
//    - produit trouvé -> quantité directement
//    - produit absent / erreur -> scanner web rouvert
// ==========================================================
let native = read("native-bridge.js");

const oldNativeFlow = `          const input = document.getElementById("w2-barcode-input");
          if (input) input.value = value;

          const webOverlay = document.getElementById("w2-barcode-overlay");
          if (webOverlay) {
            webOverlay.classList.add("ouverte");
            webOverlay.setAttribute("aria-hidden", "false");
            document.body.classList.add("modal-ouverte");
          }

          setMessage("w2-barcode-help", \`Code détecté : \${value}. Recherche du produit…\`);
          await w2LookupBarcode(value);`;

const newNativeFlow = `          const input = document.getElementById("w2-barcode-input");
          if (input) input.value = value;

          // V5.3.3 : on ne rouvre surtout pas la fenêtre code-barres ici.
          // La recherche se fait pendant qu'elle reste fermée.
          // Si le produit existe, w2LookupBarcode ouvre directement Quantité.
          setMessage("w2-barcode-help", \`Code détecté : \${value}. Recherche du produit…\`);
          const found = await w2LookupBarcode(value);

          // Seulement en cas de produit inconnu / erreur réseau,
          // on rouvre la fenêtre pour permettre une saisie manuelle.
          if (found !== true) {
            const webOverlay = document.getElementById("w2-barcode-overlay");
            if (webOverlay) {
              webOverlay.classList.add("ouverte");
              webOverlay.setAttribute("aria-hidden", "false");
              document.body.classList.add("modal-ouverte");
            }
          }`;

native = replaceRequired(
  native,
  oldNativeFlow,
  newNativeFlow,
  "flux ML Kit après détection"
);

write("native-bridge.js", native);

// ==========================================================
// 3. Version + tests
// ==========================================================
const pkg = JSON.parse(read("package.json"));
pkg.version = "5.3.3";
pkg.description = "Wellness 5.3.3 - native barcode scanner closes before quantity";
pkg.scripts["test:barcode-autoclose"] = "node scripts/test-v533-barcode.mjs";
if (!pkg.scripts.test.includes("test:barcode-autoclose")) {
  pkg.scripts.test += " && npm run test:barcode-autoclose";
}
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 5\.3\.2/g, "Wellness 5.3.3");
write("index.html", index);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.3.3";');
write("hardening-core.js", hardening);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.3.3";');
write("sw.js", sw);

// ==========================================================
// 4. OTA
// ==========================================================
let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="5\.3\.2-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.3.3-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "5\.3\.2"/g, '"appVersion": "5.3.3"');

ota = replaceRequired(
  ota,
  '      - "scripts/test-v532-barcode.mjs"',
  '      - "scripts/test-v532-barcode.mjs"\n      - "scripts/test-v533-barcode.mjs"',
  "test V5.3.3 dans OTA"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.3.3 installée.");
console.log("Flux attendu : scan → scanner fermé → recherche silencieuse → quantité directement.");
console.log("La fenêtre code-barres ne revient que si le produit est introuvable ou si la recherche échoue.");
console.log("Aucun plugin natif ajouté : OTA uniquement.");
