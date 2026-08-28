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
- intégration Apple Santé / HealthKit sur iOS compatible ;
- prise en charge Web et Capacitor.

## Confidentialité et données

Wellness fonctionne localement par défaut.

La synchronisation cloud est facultative. Si elle est activée, les données de l’application peuvent être envoyées vers le projet Supabase configuré par l’utilisateur.

L’application accepte uniquement une URL de projet Supabase HTTPS et une clé cliente `anon` / publishable. Les clés `service-role`, `supabase_admin` et `sb_secret_*` sont refusées côté client.

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

Après une modification de `SUPABASE_SETUP.sql`, le script SQL doit être exécuté dans le projet Supabase concerné : modifier le fichier du dépôt ne modifie pas automatiquement la base distante.

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
- la cohérence des suggestions alimentaires ;
- la CI de qualité, l’audit npm et les contrôles Capacitor ;
- la traçabilité des IPA Codemagic par version et commit.

Consulte également `SECURITY.md` avant de signaler un problème de sécurité.

## Installation

Prérequis : Node.js 22 ou supérieur et npm.

Installation reproductible à partir du lockfile :

```bash
npm ci
```

Pour modifier volontairement les dépendances, utilise `npm install`, puis vérifie et versionne le nouveau `package-lock.json`.

## Vérifications

La vérification complète utilisée par la CI est :

```bash
npm run verify:ci
```

Elle couvre notamment la syntaxe, les tests, le build Web, `npm audit --audit-level=high` et Capacitor Doctor.

## Build Web

Le dossier `www/` est **généré** et ne doit jamais être versionné :

```bash
npm run build:web
```

Le script supprime puis reconstruit entièrement `www/` à partir des sources. Le dossier est ignoré par Git pour éviter de déployer un ancien bundle généré.

## Build iPhone avec Codemagic

Pour une IPA à installer sur iPhone, utilise le workflow :

```text
Wellness - iPhone unsigned IPA
```

Un build lancé sur `main` vérifie maintenant que le commit sélectionné correspond réellement au dernier commit distant de `main`. Un ancien commit de `main` est refusé afin d’éviter de télécharger une IPA obsolète.

Les artefacts sont nommés avec la version et le SHA court, par exemple :

```text
Wellness-5.5.0-68f0d2ccb8a3-unsigned.ipa
Wellness-5.5.0-68f0d2ccb8a3-build.txt
```

Avant installation, vérifie toujours que le SHA du nom de l’IPA correspond au commit attendu.

Le modèle `codemagic-testflight.template.yaml` applique également `npm ci`, les vérifications professionnelles et la configuration native iOS/HealthKit avant la signature.

## Mises à jour OTA

Les mises à jour OTA utilisent :

- une version d’application dérivée directement de `package.json` ;
- une version de schéma ;
- une origine explicitement autorisée ;
- une empreinte SHA-256 du bundle ;
- le SHA complet du commit source ;
- la taille du bundle publiée dans le manifeste.

Le SHA-256 permet de détecter un bundle différent de celui déclaré dans le manifeste. Il ne constitue pas à lui seul une signature cryptographique indépendante du manifeste. Une signature avec une clé privée hors dépôt reste un durcissement supplémentaire possible si une infrastructure de gestion de clé dédiée est mise en place.

## Dépendances

La CI bloque les vulnérabilités npm de niveau élevé ou critique. Certaines dépendances transitives d’outils de développement peuvent produire des avertissements de dépréciation sans vulnérabilité active ; elles sont surveillées via Dependabot et doivent être mises à jour via leur dépendance parente plutôt que forcées avec des overrides incompatibles.

## Structure du dépôt

Les sources de production restent à la racine et dans `scripts/`. Les anciens installateurs et patchs ponctuels ne sont plus conservés dans l’arborescence active : l’historique Git reste la source de référence pour ces étapes anciennes.

Les principales notes de version sont résumées dans `CHANGELOG.md`.

## Documentation opérationnelle

- `CAPACITOR_IOS.md` : génération et utilisation du projet iOS ;
- `OTA_AUTO_UPDATE.md` : fonctionnement des mises à jour Web OTA ;
- `V5_HEALTHKIT.md` : intégration Apple Santé / HealthKit ;
- `SUPABASE_SETUP.sql` : configuration RLS et droits Supabase ;
- `SECURITY.md` : politique de sécurité.

## Version

**Wellness 5.5.0**
