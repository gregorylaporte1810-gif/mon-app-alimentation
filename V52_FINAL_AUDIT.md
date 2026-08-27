# Wellness 5.2 — Final Audit

Cette version regroupe les corrections relevées pendant l'audit réel écran par écran sur iPhone.

## Aujourd'hui
- FAB plus petit et moins gênant ;
- raccourcis Défis / Série / Roue plus compacts ;
- état initial du score moins massif et plus explicite.

## Nutrition
- repas vides compactés ;
- boutons indisponibles plus clairs ;
- suggestions longues limitées à deux lignes ;
- espace de bas de page conservé ;
- correctif V5.1 anti-remontée du scroll conservé.

## Progrès
- semaine en français : `24 → 30 août` ;
- navigation calendrier sur une ligne ;
- graphique de poids vide compact ;
- bouton `Ajouter mon poids` quand aucune pesée n'existe.

## Moi / Apple Santé
- `Disponible` n'est plus affiché sans preuve réelle ;
- états : `Intégration installée`, `Synchronisé`, `Signature HealthKit bloquée` ;
- carte compactée quand HealthKit n'apporte encore aucune donnée ;
- blocage persistant si une erreur d'entitlement est détectée ;
- switch OFF plus lisible.

## Recherche universelle
- filtre les faux résultats alimentaires pour les requêtes de réglages comme `sauvegarde` ;
- favorise les aliments simples pour les requêtes courtes comme `riz`.

## Hors ligne
- badge sous la Dynamic Island au lieu de la chevaucher ;
- retour réseau au même emplacement.

## Global
- FAB repositionné ;
- léger fondu supérieur pendant le scroll natif iOS ;
- différenciation visuelle Sauvegarde / Cloud ;
- davantage d'espace sûr sur les longs écrans.

## Installation

```powershell
node .\apply-v52-final.mjs
npm install
npm run verify
```

Puis :

```powershell
git add -A
git commit -m "fix: apply final audit polish across Wellness"
git push
```

**OTA uniquement.** Aucun plugin natif n'est ajouté.

La PWA reçoit les mêmes changements via `build:web` et `sw.js`.
