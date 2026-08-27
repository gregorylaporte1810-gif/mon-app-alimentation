import { readFileSync, writeFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`${path} introuvable. Installe d'abord V4.4 et lance ce script depuis la racine.`);
  return readFileSync(path, "utf8");
}
function write(path, value) {
  writeFileSync(path, value, "utf8");
  console.log(`✅ ${path}`);
}
function replaceRequired(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`Point d'insertion introuvable : ${label}`);
  return source.replace(from, to);
}

console.log("Installation Wellness 5.0 - Apple Santé / HealthKit...\n");

const pkg = JSON.parse(read("package.json"));
pkg.version = "5.0.0";
pkg.description = "Wellness 5.0 - Apple HealthKit integration";
pkg.dependencies["@capgo/capacitor-health"] = "8.10.4";
pkg.scripts["check:syntax"] = pkg.scripts["check:syntax"].includes("node --check health-v5.js")
  ? pkg.scripts["check:syntax"]
  : `${pkg.scripts["check:syntax"]} && node --check health-v5.js`;
write("package.json", JSON.stringify(pkg, null, 2) + "\n");

let index = read("index.html");
index = index.replace(/Wellness 4\.4\.0/g, "Wellness 5.0.0");
index = replaceRequired(
  index,
  '  <script src="native-bridge.js"></script>',
  '  <script src="native-bridge.js"></script>\n  <script src="health-v5.js"></script>',
  "script HealthKit"
);
write("index.html", index);

let build = read("scripts/build-web.mjs");
build = replaceRequired(
  build,
  '  "native-bridge.js",',
  '  "native-bridge.js",\n  "health-v5.js",',
  "build HealthKit"
);
write("scripts/build-web.mjs", build);

let sw = read("sw.js");
sw = sw.replace(/const CACHE = "wellness-[^"]+";/, 'const CACHE = "wellness-5.0.0";');
sw = replaceRequired(
  sw,
  '  "./native-bridge.js",',
  '  "./native-bridge.js",\n  "./health-v5.js",',
  "cache HealthKit"
);
write("sw.js", sw);

let hardening = read("hardening-core.js");
hardening = hardening.replace(/const APP_VERSION = "[^"]+";/, 'const APP_VERSION = "5.0.0";');
write("hardening-core.js", hardening);

let w2 = read("wellness2.js");
w2 = w2.replace(/const W2_VERSION = "[^"]+";/, 'const W2_VERSION = "5.0.0";');
write("wellness2.js", w2);

let css = read("style.css");
if (!css.includes("WELLNESS V5 — APPLE HEALTH")) css += "\n\n" + read("v5-health-style.css");
write("style.css", css);

let configure = read("scripts/configure-ios-native.mjs");
if (!configure.includes("NSHealthShareUsageDescription")) {
  configure += `

const healthShareKey = "<key>NSHealthShareUsageDescription</key>";
const healthShareValue = "<string>Wellness lit les données Apple Santé que tu autorises pour synchroniser tes pas, ton sommeil, ton poids et ton activité.</string>";
const healthUpdateKey = "<key>NSHealthUpdateUsageDescription</key>";
const healthUpdateValue = "<string>Wellness écrit uniquement les données que tu choisis explicitement, comme ton poids.</string>";

let healthInfo = readFileSync(plist, "utf8");
for (const [key, value] of [[healthShareKey, healthShareValue], [healthUpdateKey, healthUpdateValue]]) {
  if (!healthInfo.includes(key)) {
    const close = healthInfo.lastIndexOf("</dict>");
    if (close === -1) throw new Error("Info.plist invalide.");
    healthInfo = healthInfo.slice(0, close) + \`  \${key}\\n  \${value}\\n\` + healthInfo.slice(close);
  }
}
writeFileSync(plist, healthInfo);

const entitlements = "ios/App/App/App.entitlements";
const entitlementXml = \`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.healthkit</key>
  <true/>
</dict>
</plist>
\`;
writeFileSync(entitlements, entitlementXml);

const project = "ios/App/App.xcodeproj/project.pbxproj";
if (existsSync(project)) {
  let pbx = readFileSync(project, "utf8");
  if (!pbx.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;")) {
    pbx = pbx.replace(/(PRODUCT_BUNDLE_IDENTIFIER = com\\.gregorylaporte1810\\.wellness;)/g, "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\\n\\t\\t\\t\\t$1");
    writeFileSync(project, pbx);
  }
}

console.log("✅ HealthKit : usage descriptions + entitlements injectés.");
`;
}
write("scripts/configure-ios-native.mjs", configure);

let codemagic = read("codemagic.yaml");
codemagic = codemagic.replaceAll(
  '/usr/libexec/PlistBuddy -c "Print :NSCameraUsageDescription" ios/App/App/Info.plist',
  '/usr/libexec/PlistBuddy -c "Print :NSCameraUsageDescription" ios/App/App/Info.plist\n          /usr/libexec/PlistBuddy -c "Print :NSHealthShareUsageDescription" ios/App/App/Info.plist\n          /usr/libexec/PlistBuddy -c "Print :NSHealthUpdateUsageDescription" ios/App/App/Info.plist'
);
codemagic = codemagic.replace(
  '          /usr/libexec/PlistBuddy -c "Print :NSCameraUsageDescription" "$APP_PATH/Info.plist"\n          rm -rf build/unsigned-ipa',
  '          /usr/libexec/PlistBuddy -c "Print :NSCameraUsageDescription" "$APP_PATH/Info.plist"\n          /usr/libexec/PlistBuddy -c "Print :NSHealthShareUsageDescription" "$APP_PATH/Info.plist"\n          /usr/bin/codesign --force --deep --sign - --entitlements ios/App/App/App.entitlements "$APP_PATH"\n          /usr/bin/codesign -d --entitlements :- "$APP_PATH" 2>&1 | grep -q "com.apple.developer.healthkit"\n          rm -rf build/unsigned-ipa'
);
write("codemagic.yaml", codemagic);

let ota = read(".github/workflows/ota-web-update.yml");
ota = ota.replace(/VERSION="4\.4\.0-\$\{GITHUB_SHA::12\}"/g, 'VERSION="5.0.0-${GITHUB_SHA::12}"');
ota = ota.replace(/"appVersion": "4\.4\.0"/g, '"appVersion": "5.0.0"');
ota = replaceRequired(
  ota,
  '      - "native-bridge.js"',
  '      - "native-bridge.js"\n      - "health-v5.js"',
  "OTA health JS"
);
write(".github/workflows/ota-web-update.yml", ota);

console.log("\n✅ Wellness 5.0 préparée.");
console.log("IMPORTANT : HealthKit est une modification native. Il faut générer et installer une nouvelle IPA.");
