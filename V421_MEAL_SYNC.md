# Wellness 4.2.1 — Journal ↔ Aujourd'hui

- Ajouter au Petit-déjeuner valide Petit-déjeuner dans Aujourd'hui.
- Ajouter au Déjeuner valide Déjeuner.
- Ajouter au Dîner valide Dîner.
- Collation ne compte pas dans les 3 repas.
- Supprimer le dernier aliment d'un repas retire sa validation automatique.
- Déplacer un aliment recalcule automatiquement les deux repas.
- Une validation faite manuellement sans aliment reste préservée.

Installation :

```powershell
node .\apply-v421-meal-sync.mjs
npm install
npm run verify
git add -A
git commit -m "feat: sync food journal with daily meals"
git push
```

Mise à jour web uniquement : aucune nouvelle IPA.
