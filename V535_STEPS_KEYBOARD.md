# Wellness 5.3.5 — clavier des pas

Le problème visible sur iPhone venait de l'éditeur de pas qui faisait automatiquement :

```js
input.focus()
input.select()
```

iOS ouvrait donc immédiatement le pavé numérique, ce qui cachait la moitié de la fenêtre.

## Nouveau comportement

Quand tu touches la carte **Pas** :

1. `Corriger mes pas` s'ouvre ;
2. **le clavier reste fermé** ;
3. tu vois tout de suite le total, les raccourcis et le bouton d'enregistrement ;
4. tu peux utiliser `−1000`, `+500`, `+1000`, `+5000` sans clavier ;
5. si tu veux une valeur exacte, tu touches volontairement le champ et le clavier s'ouvre.

## Installation

```powershell
node .\apply-v535-steps-keyboard.mjs
npm install
npm run verify

git add -A
git commit -m "fix: prevent automatic keyboard in steps editor"
git push
```

Aucun nouveau plugin natif : OTA uniquement.
