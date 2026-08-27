# Wellness 4.3 — Usage quotidien

V4.3 ne cherche pas à ajouter des gadgets. Elle réduit surtout le nombre de manipulations nécessaires chaque jour.

## Ajouts

### Nutrition plus rapide
- Aliments récents.
- Aliments fréquents.
- Favoris alimentaires avec étoile directement dans la recherche.
- Repas personnels enregistrés.
- Copier toute la journée d'hier.
- Reprendre uniquement le petit-déjeuner, déjeuner ou dîner d'hier.
- Portions personnelles : `Mon bol`, `Mon verre`, `Mon shaker`, etc.

### Journal
- Résumé calories/macros par repas.
- Modifier.
- Dupliquer.
- Déplacer vers un autre repas.
- Supprimer.
- Annuler une suppression pendant quelques secondes.

### Qualité nutritionnelle
Les données Ciqual/Open Food Facts déjà disponibles sont maintenant exploitées pour :
- fibres,
- sel,
- graisses saturées,
- sucres totaux.

Les repères affichés restent **indicatifs** et ne remplacent pas un avis médical.

### Suggestions utiles
Le bloc `Il te reste` utilise :
- calories restantes,
- protéines restantes,
- fibres restantes,
- préférences alimentaires,

pour proposer quelques aliments de la base déjà intégrée à Wellness. Il n'invente pas de données nutritionnelles.

### Hydratation
Option désactivée par défaut :
- si activée, une entrée `Eau`, `Eau minérale`, `Eau gazeuse` du journal compte automatiquement dans l'hydratation ;
- volume d'un verre configurable ;
- le système retire automatiquement sa contribution si l'entrée est supprimée.

### Historique
Le journal du jour est archivé avant le reset quotidien pour permettre `Copier hier` et `↻ Hier`.
Conservation : 90 jours.

## Installation

Depuis la racine de `mon-app-alimentation` :

```powershell
node .\apply-v43-daily-ux.mjs
npm install
npm run verify
```

Puis :

```powershell
git add -A
git commit -m "feat: streamline daily nutrition tracking"
git push
```

Aucun plugin natif n'est ajouté : **OTA uniquement, pas de nouvelle IPA**.
