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
  "style.css",
  "app.js",
  "features.js",
  "wellness2.js",
  "core-utils.js",
  "data-foods.js",
  "cloud.js",
  "ota-updater.js",
  "ux-shell.js",
  "native-bridge.js",
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
