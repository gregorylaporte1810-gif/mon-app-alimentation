# Architecture Wellness 5.6.0

## Principes

Wellness est une application Web progressive empaquetée avec Capacitor. La source Web reste la référence et `www/` est toujours généré par `npm run build:web`.

## Couches

- **État historique** : `app.js`, avec les fonctions de base et la compatibilité des anciennes données.
- **Fonctions produit** : `features.js`, `wellness2.js` et les modules fonctionnels spécialisés.
- **Noyaux testables** : `core-utils.js`, `food-units-core.js`, `hardening-core.js` et autres fichiers `*-core.js`.
- **Sécurité/persistance** : `hardening.js`, `cloud.js`.
- **Présentation** : `ux-shell.js`, `style.css`, modules d’évolution UX, `legal.js`.
- **Natif** : `native-bridge.js`, HealthKit et configuration Capacitor.
- **Release** : `scripts/`, GitHub Actions et Codemagic.

## Règles de maintenance

1. Ne pas ajouter de nouvelle donnée sensible dans `localStorage` si elle peut aller dans le stockage sécurisé natif.
2. Toute donnée externe injectée dans le DOM doit passer par `textContent` ou un échappement explicite.
3. Éviter les nouveaux remplacements de fonctions globales ; préférer un module autonome ou un noyau pur testable.
4. Les nouveaux modules de production doivent être ajoutés à `scripts/build-web.mjs`, au service worker si nécessaire, et aux tests qualité.
5. Les fichiers `v42`, `v43`, `v44`, `v51`, `v52`, `v53`, `v541` sont des couches historiques maintenues pour compatibilité. Leur logique doit être progressivement déplacée vers des modules nommés par responsabilité lors de modifications futures, sans réécriture globale risquée.
6. `app.js`, `wellness2.js` et `style.css` ont des seuils de taille contrôlés par la CI pour empêcher la dette de croître silencieusement.

## Direction de refactorisation

La cible progressive est : `state/`, `storage/`, `nutrition/`, `cloud/`, `native/`, `ui/` et `security/`, avec APIs explicites et tests avant chaque extraction. Une réécriture massive n’est pas recommandée tant que l’application stable fonctionne sur appareil réel.
