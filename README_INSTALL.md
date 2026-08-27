# Installation V4.1 — étape 2 : canal OTA dédié

Ne fais cette étape qu'après le succès de l'étape 1 et de son OTA bootstrap.

Depuis PowerShell, commence par :

```powershell
git pull --rebase origin main
```

Décompresse ensuite le ZIP étape 2 dans la racine du dépôt, puis :

```powershell
git add .github/workflows/ota-web-update.yml
git commit -m "chore: move OTA publishing off main"
git push
```

Le workflow crée/utilise ensuite la branche `ota` et y publie `latest.json` + `wellness-web.zip`. Les publications OTA futures ne créent donc plus de commits automatiques sur `main`.
