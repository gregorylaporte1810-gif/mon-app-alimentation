import { readFileSync, writeFileSync } from "node:fs";

const path = "features.js";
let source = readFileSync(path, "utf8");

const marker = "WELLNESS V4.1.2 JOURNAL QUANTITY NAME FIX";

if (source.includes(marker)) {
  console.log("Le correctif V4.1.2 est deja present.");
  process.exit(0);
}

const pattern = /function megaJournalBaseName\(entry\) \{[\s\S]*?\n\}/;

if (!pattern.test(source)) {
  throw new Error("Fonction megaJournalBaseName introuvable dans features.js.");
}

const replacement = `// ${marker}
function megaJournalBaseName(entry) {
  if (entry?.source !== "aliment") {
    return String(entry?.nom || "Ajout manuel");
  }

  return String(entry.nom || "Aliment")
    .replace(/(?:\\s*\\([0-9]+(?:[.,][0-9]+)?\\s*g\\))+\\s*$/i, "")
    .trim();
}`;

source = source.replace(pattern, replacement);
writeFileSync(path, source, "utf8");

const sample = "Banane (100 g) (150 g)"
  .replace(/(?:\s*\([0-9]+(?:[.,][0-9]+)?\s*g\))+\s*$/i, "")
  .trim();

if (sample !== "Banane") {
  throw new Error(`Verification du correctif impossible: ${sample}`);
}

console.log("OK - le nom de base est maintenant nettoye avant changement de quantite.");
