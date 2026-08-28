# Wellness 5.5.0

Application de suivi personnel dédiée à la nutrition, l’hydratation, l’activité, le sommeil, le poids et l’organisation des repas.

## Fonctionnalités principales

- suivi quotidien de l’alimentation, de l’eau et de l’activité ;
- objectifs nutritionnels et suivi des macronutriments ;
- recettes et suggestions adaptées aux préférences alimentaires ;
- prise en compte des régimes, allergies et aliments non souhaités ;
- recherche d’aliments avec base Ciqual chargée à la demande ;
- recherche de produits via Open Food Facts ;
- scanner de codes-barres ;
- suivi du poids et des progrès ;
- planification des repas ;
- sauvegarde et restauration ;
- synchronisation cloud Supabase optionnelle ;
- analyse photo par endpoint IA optionnel ;
- prise en charge Web et Capacitor.

## Confidentialité et données

Wellness fonctionne localement par défaut.

La synchronisation cloud est facultative. Si elle est activée, les données de l’application peuvent être envoyées vers le projet Supabase configuré par l’utilisateur.

L’application demande uniquement une clé Supabase `anon`. Une clé `service-role` ne doit jamais être utilisée dans l’application cliente.

Les sessions d’authentification et les tokens sensibles ne sont pas inclus dans les sauvegardes ni dans les données synchronisées.

Sur une application native compatible, les secrets pris en charge sont placés dans le stockage sécurisé du système. Dans le navigateur, la session cloud utilise un stockage temporaire de session et reste accessible au code exécuté dans la page ; une protection contre les failles XSS reste donc indispensable.

L’utilisateur peut supprimer les données synchronisées dans le cloud depuis les réglages. Cette opération conserve les données locales présentes sur l’appareil.

## Services externes

### Open Food Facts

Le scanner et certaines recherches de produits peuvent interroger Open Food Facts lorsqu’une connexion Internet est disponible.

Les informations nutritionnelles provenant de bases externes sont indicatives et peuvent être incomplètes ou incorrectes.

### Supabase

Supabase est utilisé uniquement lorsque l’utilisateur configure volontairement la synchronisation cloud.

La table `wellness_sync` doit utiliser Row Level Security (RLS). Les politiques fournies dans `SUPABASE_SETUP.sql` limitent les opérations aux données appartenant à l’utilisateur authentifié.

### Analyse IA

L’analyse automatique d’une photo de repas est facultative.

Wellness autorise uniquement un endpoint compatible avec sa politique de sécurité : même origine que l’application ou domaine Supabase HTTPS autorisé.

Un token facultatif peut être envoyé à cet endpoint sous forme de Bearer token. Ce token n’est pas conservé dans les données ordinaires de l’application ni dans les sauvegardes.

## Santé

Wellness est un outil de suivi et d’information générale.

Les calories, macronutriments, objectifs, tendances, scores et recommandations sont des estimations indicatives. Ils ne constituent ni un diagnostic médical, ni une prescription, ni un traitement, ni un avis médical personnalisé.

Les calculs nutritionnels ne remplacent pas l’avis d’un médecin, d’un diététicien ou d’un autre professionnel de santé qualifié.

En cas de problème de santé ou de besoin nutritionnel spécifique, les objectifs doivent être discutés avec un professionnel de santé.

## Sécurité — V5.5.0

La version 5.5.0 renforce notamment :

- la protection des sessions et secrets ;
- l’assainissement des sauvegardes et synchronisations ;
- les limites de taille et profondeur des données restaurées ;
- la protection contre certaines structures malveillantes ;
- la révocation des sessions Supabase ;
- la suppression des données cloud ;
- la Content Security Policy ;
- la restriction des endpoints IA ;
- la vérification SHA-256 des bundles OTA ;
- le contrôle de version et de schéma OTA ;
- l’accessibilité clavier et des modales ;
- les cibles tactiles de 44 px ;
- le chargement à la demande de la base Ciqual ;
- la cohérence des suggestions alimentaires.

## Installation

Prérequis : Node.js 22 ou supérieur et npm.

```bash
npm install
```

## Vérifications

```bash
npm test
npm run check:syntax
npm audit
npm run build:web
npm run cap:doctor
```

## Build Web

Le dossier `www/` est généré automatiquement à partir des sources :

```bash
npm run build:web
```

## Mises à jour OTA

Les mises à jour OTA utilisent une version d’application, une version de schéma, une origine explicitement autorisée et une empreinte SHA-256 du bundle.

Le SHA-256 permet de détecter un bundle différent de celui déclaré dans le manifeste. Il ne constitue pas à lui seul une signature cryptographique du manifeste.

## Version

**Wellness 5.5.0**
