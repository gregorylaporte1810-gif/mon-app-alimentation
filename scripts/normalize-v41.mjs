import fs from "node:fs";

function replaceInFile(path, transform) {
  if (!fs.existsSync(path)) return false;
  const before = fs.readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) return false;
  fs.writeFileSync(path, after);
  console.log(`✓ ${path}`);
  return true;
}

let changed = 0;
changed += replaceInFile("index.html", text => text
  .replaceAll("Wellness 2.0 Pro", "Wellness 4.1")
  .replaceAll("Wellness 2.0", "Wellness 4.1")
) ? 1 : 0;

changed += replaceInFile("wellness2.js", text => text
  .replace('const W2_VERSION = "2.0-pro";', 'const W2_VERSION = "4.1.0";')
) ? 1 : 0;

console.log(changed ? `✅ ${changed} fichier(s) normalisé(s) pour Wellness 4.1.` : "✅ Sources déjà normalisées.");
