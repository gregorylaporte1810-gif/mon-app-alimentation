# Wellness 5.3.4 — fermeture de la fenêtre Code-barres

Ce correctif vise exactement l'écran où le produit est déjà trouvé et où le bouton **Choisir la quantité** est encore affiché.

Nouveau comportement :

1. toucher `Choisir la quantité` ;
2. la fenêtre **Quantité + Repas** s'ouvre ;
3. la fenêtre **Code-barres se ferme immédiatement** ;
4. il ne reste donc plus deux fenêtres superposées ;
5. après `Ajouter au journal`, retour à Nutrition.

## Installation

```powershell
node .\apply-v534-barcode-button-close.mjs
npm install
npm run verify

git add -A
git commit -m "fix: close barcode modal when choosing quantity"
git push
```

OTA uniquement.
