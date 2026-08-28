# Politique de confidentialité — Wellness 5.6.0

Dernière mise à jour : 28 août 2026.

## Principe

Wellness est conçu pour fonctionner localement par défaut. Il n’intègre ni publicité, ni profilage publicitaire, ni SDK de télémétrie marketing.

## Données traitées

Selon les fonctions utilisées, Wellness peut traiter : profil (prénom facultatif, âge, taille, poids et objectifs), journal alimentaire, hydratation, activité, sommeil, humeur/énergie, historique de poids et mensurations, préférences alimentaires, recettes, planning, photos de progression et réglages.

Ces informations peuvent être sensibles. Elles sont destinées au suivi personnel et ne constituent pas un dossier médical.

## Stockage local

Les données applicatives ordinaires sont conservées dans l’espace de stockage de l’application ou du navigateur sur l’appareil. Les photos de progression sont déplacées vers IndexedDB lorsque cette fonction est disponible. Sur iOS natif, les sessions Supabase et tokens pris en charge sont placés dans le stockage sécurisé du système et ne sont pas inclus dans les sauvegardes ordinaires.

Une personne ayant accès à un appareil déverrouillé peut potentiellement accéder aux données locales : utilise le verrouillage et les protections système de l’appareil.

## Synchronisation Supabase facultative

Le cloud n’est utilisé que si l’utilisateur le configure volontairement. Wellness envoie alors une copie assainie des données applicatives vers le projet Supabase choisi. Les access tokens, refresh tokens, mots de passe, tokens IA et clés secrètes ne sont pas inclus dans le payload synchronisé.

Les règles Row Level Security fournies limitent la ligne cloud à l’utilisateur authentifié. L’utilisateur peut supprimer ses données cloud depuis Wellness.

## Open Food Facts

Lors d’une recherche de code-barres, le code saisi ou scanné est envoyé à Open Food Facts pour récupérer les informations nutritionnelles disponibles. Comme pour toute requête Internet, le service distant reçoit les informations réseau nécessaires à la communication, par exemple l’adresse IP. Wellness n’envoie pas le profil Wellness à Open Food Facts.

## Ciqual / Anses

La base Ciqual utilisée par Wellness est intégrée localement et chargée à la demande. Une recherche dans cette base ne nécessite pas d’envoyer le profil de l’utilisateur à l’Anses.

## Analyse photo facultative

L’utilisateur peut configurer son propre endpoint d’analyse photo compatible. Dans ce cas, la photo et la description choisies peuvent être transmises à cet endpoint, avec un Bearer token facultatif. Wellness n’active pas cette transmission sans configuration et action de l’utilisateur.

## Apple Santé / HealthKit

Sur une installation iOS disposant des autorisations et d’une signature compatibles, Wellness peut demander l’accès aux catégories Apple Santé annoncées dans l’application. iOS contrôle les autorisations. Wellness continue à fonctionner si l’utilisateur refuse l’accès ou si HealthKit n’est pas disponible.

## Caméra et notifications

La caméra est demandée pour le scanner de codes-barres. Les notifications locales sont utilisées uniquement si l’utilisateur les autorise et active des rappels.

## Sauvegardes

Une sauvegarde exportée est un fichier JSON lisible contenant les données Wellness assainies. Conserve-le dans un emplacement auquel seules les personnes autorisées ont accès. Il n’est pas chiffré par mot de passe dans la version actuelle.

## Conservation et suppression

Les données locales restent présentes jusqu’à leur suppression dans l’application, l’effacement des données de l’application ou du navigateur, ou la désinstallation selon le comportement de la plateforme. Les données Supabase restent présentes jusqu’à leur suppression par l’utilisateur ou selon la politique du projet Supabase configuré.

## Services tiers et licences

Les sources et licences tierces sont détaillées dans `THIRD_PARTY_NOTICES.md`.

## Santé

Wellness est un outil d’information et de suivi général, pas un dispositif médical. Les estimations nutritionnelles, tendances et recommandations ne remplacent pas un professionnel de santé.
