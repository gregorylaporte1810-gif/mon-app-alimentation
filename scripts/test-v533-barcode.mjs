import { readFileSync } from "node:fs";

const w2 = readFileSync("wellness2.js", "utf8");
const native = readFileSync("native-bridge.js", "utf8");

const checks = [
  [
    "lookup retourne true si produit trouvé",
    w2.includes("return true;") &&
    w2.includes("WellnessBarcodeFlowV532")
  ],
  [
    "lookup retourne false si produit absent",
    w2.includes("Produit non trouvé dans Open Food Facts.</p>';return false;")
  ],
  [
    "scanner natif attend le résultat",
    native.includes("const found = await w2LookupBarcode(value);")
  ],
  [
    "scanner natif ne rouvre que si échec",
    native.includes("if (found !== true)")
  ],
  [
    "ancienne réouverture avant lookup supprimée",
    !native.includes(`document.body.classList.add("modal-ouverte");
          }

          setMessage("w2-barcode-help", \`Code détecté : \${value}. Recherche du produit…\`);
          await w2LookupBarcode(value);`)
  ],
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

console.log(`\n${passed} / ${checks.length} tests Barcode V5.3.3 réussis`);
if (passed !== checks.length) process.exit(1);
