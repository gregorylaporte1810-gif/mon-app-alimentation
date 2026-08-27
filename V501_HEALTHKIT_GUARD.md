# Wellness 5.0.1 — HealthKit signing guard

Les captures V5.0 ont révélé deux choses :

1. `Missing com.apple.developer.healthkit entitlement.`
2. Après cela, V5.0 pouvait tout de même afficher une fausse `Dernière synchro` avec toutes les mesures vides.

V5.0.1 corrige ce faux positif.

## Ce que fait le correctif

- vérifie HealthKit avant les actions ;
- reconnaît explicitement l'erreur d'entitlement ;
- désactive `Autoriser`, `Synchroniser`, `Envoyer mon poids` et la synchro automatique si l'entitlement manque ;
- retire le faux timestamp de synchronisation quand aucune donnée n'a réellement été importée ;
- affiche une explication claire ;
- ne touche à aucune autre fonction Wellness.

## Installation

```powershell
node .\apply-v501-healthkit-guard.mjs
npm install
npm run verify

git add -A
git commit -m "fix: detect missing HealthKit entitlement"
git push
```

OTA uniquement.

## Cause

Le problème n'est pas la présence du plugin HealthKit dans l'IPA. L'application installée doit conserver `com.apple.developer.healthkit` après sa signature finale.

Au 27 août 2026, AltStore a une PR en draft intitulée `Preserve HealthKit capability when re-signing apps` (#1762) qui décrit exactement le problème : AltStore/AltServer perdent actuellement HealthKit lors de la re-signature parce qu'AltSign ne mappe pas encore cette capability.

La fonctionnalité Apple Santé reste donc prête dans Wellness mais ne doit pas prétendre fonctionner tant que la signature installée ne contient pas l'entitlement.
