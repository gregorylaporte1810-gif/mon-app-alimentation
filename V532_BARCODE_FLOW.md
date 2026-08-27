# Wellness 5.3.2 — Barcode flow

Après un scan reconnu, il n'y a plus besoin de toucher `Choisir la quantité`.

Nouveau flux :
1. le code-barres est détecté ;
2. Open Food Facts retrouve le produit ;
3. le scanner/caméra se ferme automatiquement ;
4. la fenêtre **Quantité + Repas** s'ouvre automatiquement ;
5. `Ajouter au journal` ;
6. retour direct à Nutrition.

Si le produit n'est pas trouvé, le scanner reste ouvert pour permettre une autre recherche.

## Installation

```powershell
node .\apply-v532-barcode-flow.mjs
npm install
npm run verify

git add -A
git commit -m "fix: streamline barcode scan to food quantity flow"
git push
```

OTA uniquement, aucune nouvelle IPA.
