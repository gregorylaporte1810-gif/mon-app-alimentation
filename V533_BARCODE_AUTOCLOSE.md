# Wellness 5.3.3 — fermeture réelle du scanner

Le problème venait du **scanner natif ML Kit**.

Après avoir détecté un code, `native-bridge.js` rouvrait la fenêtre Code-barres juste avant d'appeler Open Food Facts. La V5.3.2 fermait ensuite cette fenêtre, mais sur iPhone les deux opérations pouvaient se chevaucher et la fenêtre restait visible.

## Nouveau flux

1. Scanner le code-barres.
2. Le code est détecté.
3. **La caméra et la fenêtre scanner restent fermées.**
4. Wellness interroge Open Food Facts en arrière-plan.
5. Produit trouvé → **Quantité + Repas s'ouvre directement.**
6. `Ajouter au journal` → retour à Nutrition.

La fenêtre Code-barres ne se rouvre désormais que si :
- le produit est introuvable ;
- ou la recherche en ligne échoue.

## Installation

```powershell
node .\apply-v533-barcode-autoclose.mjs
npm install
npm run verify

git add -A
git commit -m "fix: close native barcode scanner before product quantity"
git push
```

Aucun nouveau plugin natif : **OTA uniquement**.
