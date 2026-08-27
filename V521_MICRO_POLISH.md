# Wellness 5.2.1 — Micro Polish final

Cette version ne change aucune logique métier.

Elle corrige uniquement les deux derniers détails relevés après l'audit réel sur iPhone :

## Nutrition
Les repas entièrement vides deviennent réellement compacts.

Avant :
- titre ;
- `Aucun aliment` ;
- `Hier` ;
- `Enregistrer` ;
- `Ajouter un aliment`.

Après :
- icône ;
- nom du repas ;
- `Aucun aliment` ;
- bouton `+`.

Dès qu'un aliment est ajouté, la carte reprend automatiquement son affichage complet.

## FAB `+`
Le bouton flottant passe à environ 48–50 px sur iPhone et réserve davantage d'espace de scroll en bas des écrans.

Il reste facilement utilisable, mais masque beaucoup moins :
- Roue / récompense sur Aujourd'hui ;
- calendrier et contenu dans Progrès ;
- cartes des autres longs écrans.

## Installation

```powershell
node .\apply-v521-micro-polish.mjs
npm install
npm run verify
```

Puis :

```powershell
git add -A
git commit -m "fix: compact empty meals and refine floating action button"
git push
```

Aucune nouvelle IPA : **OTA uniquement**.

La **PWA reçoit exactement le même polish**.
