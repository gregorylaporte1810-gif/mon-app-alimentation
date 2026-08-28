import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { createHash } from "node:crypto";

const root = process.cwd();
const wwwDir = join(root, "www");
const otaDir = join(root, "ota");
const appVersion = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
).version;

const schemaVersion = 4;
const version =
  process.env.OTA_VERSION ||
  `${appVersion}-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;

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

const sha256 = createHash("sha256").update(readFileSync(zipPath)).digest("hex");

const manifest = {
  version,
  appVersion,
  schemaVersion,
  url: "https://raw.githubusercontent.com/gregorylaporte1810-gif/mon-app-alimentation/main/ota/wellness-web.zip",
  message: "Mise à jour Wellness automatique",
  sha256,
  publishedAt: new Date().toISOString(),
};

writeFileSync(
  join(otaDir, "latest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`✅ OTA ${version} créé dans ota/`);
