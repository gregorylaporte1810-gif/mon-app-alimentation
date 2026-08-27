# Wellness 4.1 — Hardening

Cette version consolide la V4 sans changer le design premium ni supprimer de fonctionnalité.

## Fiabilité

- validation des états et des sauvegardes avant écriture/restauration ;
- rollback automatique avant restauration JSON/cloud ;
- détection des conflits de synchronisation cloud avant écrasement ;
- cohérence entre poids cible et objectif principal ;
- libellé « Première mesure » pour le sommeil lorsqu'aucune période précédente n'existe ;
- arrêt défensif du scanner lorsque l'application passe en arrière-plan.

## Stockage

- migration progressive des photos de progression vers IndexedDB ;
- `localStorage` ne conserve plus les données image lourdes une fois la migration vérifiée ;
- nettoyage des anciens fichiers d'export temporaires natifs au démarrage.

## Qualité

- version applicative 4.1.0 ;
- version et OTA visibles dans l'écran Moi ;
- tests Node sans dépendance supplémentaire ;
- vérification syntaxique avant publication OTA et avant build Codemagic ;
- Xcode épinglé à 26.4 et installations CI avec `npm ci` après la phase bootstrap ;
- cache PWA versionné et liste de fichiers corrigée ;
- améliorations VoiceOver/ARIA sur humeur, énergie et fermeture des modales.

## OTA

Le premier déploiement 4.1 reste publié sur `main` pour permettre aux anciennes installations de recevoir le nouveau chargeur OTA. Ensuite, le canal OTA est déplacé sur une branche dédiée afin que les publications automatiques ne créent plus de commits sur `main`.

## Sécurité native séparée

Le runtime 4.1 sait également déplacer la session Supabase vers le Trousseau iOS lorsqu'il détecte `@aparajita/capacitor-secure-storage`. L'ajout du plugin est fourni dans l'étape native séparée car un plugin natif ne peut pas être installé par OTA et nécessite une nouvelle IPA.
