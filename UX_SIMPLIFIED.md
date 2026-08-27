# Wellness — navigation simplifiée

Cette version conserve toutes les fonctionnalités existantes mais réduit la charge visuelle sur mobile.

## Navigation principale

- **Aujourd'hui** : résumé du jour, coach, actions rapides. Les détails (eau, pas, défis, série, roue) restent disponibles dans « Motivation & objectifs ».
- **Nutrition** : `Journal`, `Recettes`, `Favoris`.
- **Plan** : `Repas`, `Courses`.
- **Progrès** : `Aujourd'hui`, `Semaine`, `Corps`.
- **Moi** : réglages regroupés en accordéons thématiques.

Le bouton flottant **+** reste disponible pour ajouter rapidement eau, pas, aliment, poids, activité, sommeil, photo ou code-barres.

## Déploiement

Cette modification est uniquement HTML/CSS/JS. Si l'OTA Wellness est déjà installée dans l'app native, aucun nouveau build Codemagic n'est nécessaire.

```powershell
git add -A
git commit -m "refactor: simplify mobile app navigation"
git push
```

GitHub Actions publie ensuite le nouveau bundle OTA automatiquement.
