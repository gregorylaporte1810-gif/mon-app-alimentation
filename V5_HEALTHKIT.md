# Wellness 5.0 — Apple Santé / HealthKit

Cette étape ajoute la grosse automatisation iPhone :

- pas Apple Santé → Wellness ;
- sommeil → Wellness ;
- poids → Wellness ;
- activités/workouts des 7 derniers jours ;
- calories actives ;
- distance ;
- fréquence cardiaque au repos ;
- HRV ;
- VO₂ max si disponible ;
- envoi volontaire du poids Wellness vers Apple Santé ;
- synchronisation automatique au démarrage optionnelle.

Le plugin utilisé est `@capgo/capacitor-health` **8.10.4**, compatible Capacitor 8.

## Ordre d'installation

Installe **V4.4 d'abord**, puis :

```powershell
node .\apply-v5-healthkit.mjs
npm install
npm run verify
```

Puis :

```powershell
git add -A
git commit -m "feat: integrate Apple HealthKit"
git push
```

### Nouvelle IPA obligatoire

HealthKit nécessite :
- le plugin natif ;
- l'entitlement HealthKit ;
- `NSHealthShareUsageDescription` ;
- `NSHealthUpdateUsageDescription`.

Lance donc dans Codemagic :

`Wellness - iPhone unsigned IPA`

Puis installe la nouvelle IPA avec AltStore.

## Important pour ton compte Apple gratuit

Apple exige que HealthKit soit présent dans le profil de signature. Le pack prépare correctement l'IPA et les entitlements, mais avec un **Personal Team / signature AltStore gratuite**, la disponibilité de HealthKit doit être validée sur ton iPhone au moment de la signature. Si Apple refuse l'entitlement avec ton profil gratuit, Wellness continuera à fonctionner normalement : seule la carte Apple Santé restera indisponible.

Aucune donnée Santé n'est lue sans autorisation iOS.
