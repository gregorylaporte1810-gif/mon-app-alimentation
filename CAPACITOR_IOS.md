# Wellness — Capacitor iOS + build cloud

## Configuration préparée

- App name: `Wellness`
- Bundle ID provisoire: `com.gregorylaporte1810.wellness`
- Capacitor: v8
- Web assets directory: `www`
- Cloud build: Codemagic
- `ios/` est généré dans le cloud pour le premier test.

## Sur Windows

Capacitor 8 demande Node.js 22 ou plus récent.

```powershell
node --version
npm install
npm run build:web
npx cap doctor
```

Le dossier `www/` est généré à partir des fichiers du projet.

Ne lance pas `npx cap add ios` sur Windows pour compiler l'app :
la création/build iOS sera effectuée sur le Mac cloud de Codemagic.

## Premier test Codemagic, sans signature Apple

Le fichier `codemagic.yaml` fourni crée une build iOS Simulator non signée.
Cette étape sert uniquement à confirmer que Capacitor + le projet iOS compilent.

1. Créer un compte Codemagic.
2. Connecter GitHub.
3. Ajouter le dépôt `mon-app-alimentation`.
4. Demander à Codemagic de relire `codemagic.yaml`.
5. Lancer `Wellness - iOS Simulator`.

Cette build n'est PAS installable sur un iPhone physique.

## Vraie installation via TestFlight

Pour obtenir une app iPhone signée et distribuable via TestFlight :
- adhésion Apple Developer Program requise ;
- app créée dans App Store Connect ;
- Bundle ID correspondant ;
- intégration App Store Connect configurée dans Codemagic.

Le fichier `codemagic-testflight.template.yaml` contient le workflow de départ.
Une fois les identifiants Apple configurés, il pourra remplacer le workflow
de test.

## Important

Avant de créer définitivement l'identifiant dans Apple Developer,
vérifier que tu veux garder :

`com.gregorylaporte1810.wellness`

Le Bundle ID devient une identité importante de l'application.
