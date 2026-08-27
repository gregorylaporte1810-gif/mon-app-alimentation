import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const wwwDir = join(root, "www");
const otaDir = join(root, "ota");
const version =
  process.env.OTA_VERSION ||
  new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

if (!existsSync(wwwDir)) {
  throw new Error("www/ introuvable. Lance npm run build:web avant.");
}

mkdirSync(otaDir, { recursive: true });
const zipPath = join(otaDir, "wellness-web.zip");

if (existsSync(zipPath)) {
  rmSync(zipPath, { force: true });
}

execFileSync("zip", ["-qr", zipPath, "."], {
  cwd: wwwDir,
  stdio: "inherit",
});

const manifest = {
  version,
  url:
    "https://raw.githubusercontent.com/gregorylaporte1810-gif/mon-app-alimentation/main/ota/wellness-web.zip",
  message: "Mise à jour Wellness automatique",
  publishedAt: new Date().toISOString(),
};

writeFileSync(
  join(otaDir, "latest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8"
);

console.log(`✅ OTA ${version} créé dans ota/`);
