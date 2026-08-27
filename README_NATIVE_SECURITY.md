# Wellness 4.1 — sécurité native iPhone

Cette étape est séparée car elle ajoute un plugin natif et impose une nouvelle IPA.

Elle ajoute `@aparajita/capacitor-secure-storage` 8.0.0. Le runtime V4.1 détecte automatiquement le plugin et migre la session Supabase vers le Trousseau iOS (`whenUnlockedThisDeviceOnly`). Les jetons ne restent alors plus dans `localStorage`.

Après avoir remplacé `package.json` :

```powershell
npm install
npm run verify
git add package.json package-lock.json
git commit -m "chore: secure cloud session in iOS keychain"
git push
```

Ensuite relance le workflow Codemagic **Wellness - iPhone unsigned IPA**, installe la nouvelle IPA avec AltStore, puis ouvre Wellness une fois. La migration de l'ancienne session cloud vers le Trousseau se fait automatiquement si une session existait.
