# Wellness 4.3.1 — iPhone polish

Cette petite mise à jour corrige les deux défauts visibles sur les captures V4.3 :

1. Le titre `Nutrition` était trop haut et pouvait passer sous l'heure / Dynamic Island.
2. Les cartes du bloc `Il te reste` comprimaient les noms Ciqual longs dans une colonne étroite.

## Correction safe-area

La correction s'applique uniquement à l'application native iOS via une classe ajoutée par `native-bridge.js`.

## Suggestions

Les suggestions deviennent de vraies cartes horizontales :
- largeur confortable ;
- nom sur 2 lignes maximum ;
- calories et protéines lisibles dessous ;
- scroll horizontal plus propre.

## Installation

```powershell
node .\apply-v431-iphone-polish.mjs
npm install
npm run verify

git add -A
git commit -m "fix: polish iPhone safe area and food suggestions"
git push
```

**OTA uniquement** : aucune nouvelle IPA.
