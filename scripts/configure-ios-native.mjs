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
