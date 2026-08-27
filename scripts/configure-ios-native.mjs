import { existsSync, readFileSync, writeFileSync } from "node:fs";

const podfile = "ios/App/Podfile";
const plist = "ios/App/App/Info.plist";

if (!existsSync(podfile)) {
  throw new Error(`Podfile introuvable : ${podfile}`);
}
if (!existsSync(plist)) {
  throw new Error(`Info.plist introuvable : ${plist}`);
}

let pod = readFileSync(podfile, "utf8");
pod = pod.replace(/platform :ios,\s*'[^']+'/g, "platform :ios, '15.5'");
writeFileSync(podfile, pod);

let info = readFileSync(plist, "utf8");

const cameraKey = "<key>NSCameraUsageDescription</key>";
const cameraValue =
  "<string>Wellness utilise la caméra pour scanner les codes-barres alimentaires.</string>";

if (!info.includes(cameraKey)) {
  const rootClose = info.lastIndexOf("</dict>");
  if (rootClose === -1) throw new Error("Info.plist invalide : </dict> introuvable.");
  info =
    info.slice(0, rootClose) +
    `  ${cameraKey}\n  ${cameraValue}\n` +
    info.slice(rootClose);
} else {
  info = info.replace(
    /<key>NSCameraUsageDescription<\/key>\s*<string>.*?<\/string>/s,
    `${cameraKey}\n  ${cameraValue}`
  );
}

writeFileSync(plist, info);

const verified = readFileSync(plist, "utf8");
if (!verified.includes(cameraKey) || !verified.includes("Wellness utilise la caméra")) {
  throw new Error("NSCameraUsageDescription n'a pas été injecté correctement.");
}

console.log("✅ iOS configuré : deployment target 15.5 + NSCameraUsageDescription vérifié.");


const healthShareKey = "<key>NSHealthShareUsageDescription</key>";
const healthShareValue = "<string>Wellness lit les données Apple Santé que tu autorises pour synchroniser tes pas, ton sommeil, ton poids et ton activité.</string>";
const healthUpdateKey = "<key>NSHealthUpdateUsageDescription</key>";
const healthUpdateValue = "<string>Wellness écrit uniquement les données que tu choisis explicitement, comme ton poids.</string>";

let healthInfo = readFileSync(plist, "utf8");
for (const [key, value] of [[healthShareKey, healthShareValue], [healthUpdateKey, healthUpdateValue]]) {
  if (!healthInfo.includes(key)) {
    const close = healthInfo.lastIndexOf("</dict>");
    if (close === -1) throw new Error("Info.plist invalide.");
    healthInfo = healthInfo.slice(0, close) + `  ${key}\n  ${value}\n` + healthInfo.slice(close);
  }
}
writeFileSync(plist, healthInfo);

const entitlements = "ios/App/App/App.entitlements";
const entitlementXml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.healthkit</key>
  <true/>
</dict>
</plist>
`;
writeFileSync(entitlements, entitlementXml);

const project = "ios/App/App.xcodeproj/project.pbxproj";
if (existsSync(project)) {
  let pbx = readFileSync(project, "utf8");
  if (!pbx.includes("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;")) {
    pbx = pbx.replace(/(PRODUCT_BUNDLE_IDENTIFIER = com\.gregorylaporte1810\.wellness;)/g, "CODE_SIGN_ENTITLEMENTS = App/App.entitlements;\n\t\t\t\t$1");
    writeFileSync(project, pbx);
  }
}

console.log("✅ HealthKit : usage descriptions + entitlements injectés.");
