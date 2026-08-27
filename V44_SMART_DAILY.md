# Wellness 4.4 — Smart Daily

Cette version ajoute toutes les améliorations web utiles demandées :

- historique alimentaire par calendrier ;
- bilan hebdomadaire avec comparaison semaine précédente ;
- créateur de repas/recettes calculé automatiquement depuis Ciqual ;
- saisie express en langage naturel (`250 g riz déjeuner`) ;
- recherche tolérante aux fautes avec priorité aux favoris/fréquents/récents ;
- priorités intelligentes sur Aujourd'hui ;
- détection des repas habituels ;
- objectifs personnalisés fibres / sommeil / activité / séances ;
- proposition d'ajustement calorique progressive basée sur la tendance de poids, **jamais appliquée sans confirmation**.

## Installer

```powershell
node .\apply-v44-smart.mjs
npm install
npm run verify
```

Puis :

```powershell
git add -A
git commit -m "feat: add smart daily insights and nutrition workflows"
git push
```

Aucun plugin natif : **OTA uniquement**.

## Note

Les bilans dépendent des journées réellement enregistrées. L'historique V4.3 conserve jusqu'à 90 jours et V4.4 l'exploite dans le calendrier et les comparaisons.
