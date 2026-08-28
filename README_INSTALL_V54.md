# Installation Wellness 5.4 Maintenance

Ce patch cible la branche actuelle Wellness 5.3.5.

Dans PowerShell, à la racine du projet :

```powershell
git pull --rebase origin main

$zip = Get-ChildItem "$HOME\Downloads" -Filter "wellness-v5.4-maintenance*.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

Expand-Archive -LiteralPath $zip.FullName -DestinationPath . -Force

node .\apply-v540-maintenance.mjs
npm install
npm run verify

git add -A
git commit -m "chore: harden Wellness maintenance and OTA safety"
git push
```

Après le push, attendre que **Publish Wellness OTA** soit vert.

Puis sur iPhone :
1. fermer complètement Wellness ;
2. rouvrir ;
3. attendre quelques secondes ;
4. fermer et rouvrir une seconde fois si une OTA vient d'être téléchargée.

## Corrections incluses

- blocage du downgrade OTA ;
- refus des schémas OTA incompatibles ;
- fallback hors-ligne du Service Worker corrigé ;
- CSP et politique de referrer ;
- manifest PWA actuel ;
- validation de sauvegarde renforcée ;
- restauration native plus sûre ;
- version 5.4.0 ;
- tests de régression dédiés ;
- README remis à jour.

Le patch ne touche pas aux données locales, profils, journaux, poids, photos ou réglages.
