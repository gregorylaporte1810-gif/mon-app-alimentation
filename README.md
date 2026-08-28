# Wellness 5.4

Application iPhone / PWA de suivi quotidien du bien-être.

## Fonctions principales

- Tableau Aujourd'hui : score, priorités, calories, protéines, hydratation, pas, repas et coach.
- Nutrition : base ANSES Ciqual, Open Food Facts, scanner code-barres, journal par repas, macros, fibres, sel, sucres et graisses saturées.
- Quantités : g, kg, ml, cl, L et portions personnalisées selon l'aliment.
- Ajout rapide : récents, fréquents, favoris, repas enregistrés, copier hier et recommandations.
- Plan : petit-déjeuner, déjeuner, dîner, collation, semaine et liste de courses.
- Progrès : poids, mensurations, photos, sommeil, humeur, activité, calendrier et comparaison hebdomadaire.
- Profils multiples avec données séparées.
- Rappels iOS locaux.
- Export / sauvegarde JSON, restauration validée et rollback.
- Synchronisation Supabase optionnelle avec RLS ; session native protégée par le Trousseau iOS.
- PWA hors ligne et mises à jour OTA de l'application native.
- Apple Santé intégré côté code ; l'accès peut rester indisponible selon la signature iOS utilisée.

## Développement

Node.js 22+.

```bash
npm ci
npm run verify
```

Le build web est généré dans `www/`.

## Mise à jour OTA

Les mises à jour web sont publiées sur la branche `ota` après validation complète par GitHub Actions.
Depuis la V5.4, l'updater refuse explicitement tout downgrade et tout schéma de données plus récent que celui pris en charge.

## Sécurité et données

- Ne jamais utiliser de clé Supabase `service_role` dans l'application.
- La clé `anon` est la seule clé publique attendue.
- Les règles RLS de `SUPABASE_SETUP.sql` isolent les données par utilisateur.
- Les sauvegardes sont validées avant restauration.
- Sur iPhone natif, la session cloud est stockée via Secure Storage / Trousseau iOS.

## Limites

Wellness est un outil de suivi bien-être. Les calories, macros, prévisions de poids et suggestions sont indicatives et ne remplacent pas un professionnel de santé.
Pour une allergie sévère, vérifier toujours l'étiquette et les ingrédients réels du produit.
