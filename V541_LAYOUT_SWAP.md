# Wellness 5.4.1 — Responsive + nouvelle organisation

Cette mise à jour répond à deux retours réels sur iPhone.

## 1. Nutrition trop grande / trop petite selon l'iPhone

L'ancien correctif V5.3 utilisait `CSS zoom` lorsqu'il détectait un viewport inhabituel.
Sur certains iPhone, cela pouvait provoquer un affichage géant, miniature ou partiellement décalé.

V5.4.1 :
- supprime ce hack ;
- repart sur le viewport iPhone standard ;
- verrouille la web-app à une échelle stable de 100 % ;
- renforce les largeurs `100 % / max-width: 100 % / min-width: 0` de Nutrition ;
- garde les carrousels internes scrollables horizontalement.

## 2. Journal / validation des repas inversés

### Aujourd'hui
Contient désormais le **Journal alimentaire** complet :
- Petit-déjeuner ;
- Déjeuner ;
- Dîner ;
- Collation ;
- ajout, modification, suppression et macros par repas.

### Nutrition
Contient désormais la **validation des repas du jour** :
- Petit-déjeuner ;
- Déjeuner ;
- Dîner ;
- compteur 0/3 à 3/3.

Les fonctions nutritionnelles restent dans Nutrition :
- recherche ;
- saisie express ;
- récents / fréquents / favoris / mes repas ;
- copier hier ;
- « Il te reste » ;
- repères fibres / sel / saturés / sucres ;
- recettes / favoris.

## Installation

```powershell
node .\apply-v541-layout-swap.mjs
npm install
npm run verify

git add -A
git commit -m "feat: reorganize journal and meals with stable iPhone layout"
git push
```

Aucun plugin natif : **OTA + PWA uniquement**.
