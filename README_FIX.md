# Wellness V4.1.1 — correctif scroll journal iPhone

Corrige le formulaire **Modifier l'ajout** qui était coupé sur iPhone et ne pouvait pas défiler.

Le problème vient du style générique `.modal-simple` qui applique `overflow: hidden`, alors que l'éditeur du journal contient directement un formulaire plus haut que l'écran.

## Installation

Depuis la racine de `mon-app-alimentation` :

```powershell
powershell -ExecutionPolicy Bypass -File .\apply-journal-scroll-fix.ps1
```

Puis :

```powershell
git add style.css
git commit -m "fix: enable scrolling in food journal editor"
git push
```

Mise à jour web uniquement : aucune reconstruction IPA nécessaire.
