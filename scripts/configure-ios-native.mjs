import { existsSync, readFileSync, writeFileSync } from "node:fs";

const podfile = "ios/App/Podfile";
const plist = "ios/App/App/Info.plist";

if (!existsSync(podfile)) {
  throw new Error(`Podfile introuvable : ${podfile}`);
}

let pod = readFileSync(podfile, "utf8");
pod = pod.replace(/platform :ios,\s*'[^']+'/g, "platform :ios, '15.5'");
writeFileSync(podfile, pod);

if (!existsSync(plist)) {
  throw new Error(`Info.plist introuvable : ${plist}`);
}

let info = readFileSync(plist, "utf8");

if (!info.includes("<key>NSCameraUsageDescription</key>")) {
  info = info.replace(
    "</dict>",
    "  <key>NSCameraUsageDescription</key>\n" +
    "  <string>Wellness utilise la caméra pour scanner les codes-barres alimentaires.</string>\n" +
    "</dict>"
  );
}

writeFileSync(plist, info);
console.log("✅ iOS configuré : deployment target 15.5 + autorisation caméra.");
