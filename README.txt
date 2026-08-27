# Wellness V4.1.2 - correctif nom du journal

Le scroll de l'editeur V4.1.1 fonctionne, mais l'audit a revele un second bug :

`Banane (100 g)` modifiee a 150 g devenait `Banane (100 g) (150 g)`.

Ce correctif retire proprement les anciennes quantites avant d'ajouter la nouvelle.

## Installation

Depuis la racine de `mon-app-alimentation` :

```powershell
node .\apply-journal-name-fix.mjs
npm run verify
git add features.js
git commit -m "fix: prevent duplicate food quantity labels"
git push
```

Aucune nouvelle IPA n'est necessaire : modification web uniquement.
