# Installation V4.1 — étape 1

Cette étape livre le hardening et publie **une dernière OTA sur `main`** afin que les anciennes installations apprennent ensuite à lire le canal OTA dédié.

Depuis PowerShell, à la racine du dépôt :

```powershell
git pull --rebase origin main
```

Décompresse ensuite le ZIP **dans la racine du dépôt** avec remplacement des fichiers.

Puis :

```powershell
npm install
npm run harden:source
npm run verify
powershell -ExecutionPolicy Bypass -File .\scripts\cleanup-tracked-node-modules.ps1
git add .
git commit -m "chore: harden Wellness 4.1"
git push
```

`npm install` est volontaire **une seule fois** ici : il met `package-lock.json` en cohérence avec la version `4.1.0`. À partir de ce commit, la CI utilise `npm ci`.

Sur GitHub, attends que **Publish Wellness OTA** soit vert. Le bot créera encore une dernière fois un commit `bootstrap OTA` sur `main`. C'est normal et nécessaire pour les anciennes installations.

Ensuite ouvre l'application iPhone, attends le téléchargement OTA et ferme/réouvre l'application afin d'activer la V4.1. Après cela tu peux appliquer l'étape 2.
