import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const webDir = join(root, "www");

if (existsSync(webDir)) {
  rmSync(webDir, { recursive: true, force: true });
}

mkdirSync(webDir, { recursive: true });

const files = [
  "index.html",
  "theme-bootstrap.js",
  "style.css",
  "app.js",
  "features.js",
  "wellness2.js",
  "core-utils.js",
  "hardening-core.js",
  "hardening.js",
  "data-foods.js",
  "data-foods-ciqual.js",
  "food-units-core.js",
  "food-v42.js",
  "daily-ux-core-v43.js",
  "daily-ux-v43.js",
  "smart-v44-core.js",
  "smart-v44.js",
  "cloud.js",
  "ota-updater.js",
  "ux-shell.js",
  "native-bridge.js",
  "health-v5.js",
  "health-v501-guard.js",
  "polish-v51-core.js",
  "polish-v51.js",
  "final-v52-core.js",
  "final-v52.js",
  "viewport-v53.js",
  "ux-v53-core.js",
  "ux-v53.js",
  "barcode-v532.js",
  "barcode-v534.js",
  "layout-v541.js",
  "manifest.webmanifest",
  "sw.js",
];

for (const file of files) {
  const source = join(root, file);

  if (!existsSync(source)) {
    throw new Error(`Fichier web introuvable : ${file}`);
  }

  cpSync(source, join(webDir, file));
}

const iconsSource = join(root, "icons");

if (existsSync(iconsSource)) {
  cpSync(iconsSource, join(webDir, "icons"), {
    recursive: true,
  });
}

console.log("✅ Bundle web copié dans www/");
console.log(
  readdirSync(webDir)
    .map((name) => `• ${name}`)
    .join("\n"),
);
