# Changelog

## 5.6.0 — 2026-08-28

- HTML validé et CSP resserrée ;
- suppression de Google Fonts au profit des polices système ;
- Open Food Facts migré vers API v3 avec timeout, gestion HTTP et identification client ;
- politique de confidentialité, sources/licences et architecture documentées ;
- avertissement allergènes et régions live d’accessibilité ;
- navigation active exposée via `aria-current` ;
- PWA et cache versionnés 5.6 ;
- GitHub Actions reproductibles sur Ubuntu 24.04 + Node 22.23.2 ;
- tests Playwright mobile/desktop et audit axe ajoutés ;
- garde-fous de taille pour limiter la dette des gros modules historiques.


Les changements détaillés restent disponibles dans l’historique Git. Ce fichier résume les étapes majeures encore utiles à la maintenance.

## 5.5.0 — audit professionnel final

- durcissement Supabase et validation des clés clientes ;
- politiques RLS réexécutables et droits limités aux utilisateurs authentifiés ;
- sessions et secrets mieux isolés ;
- sauvegardes et restaurations durcies ;
- OTA avec contrôle SHA-256, version, schéma et origine ;
- CI `Quality Gate`, audit npm et Capacitor Doctor ;
- Dependabot pour npm et GitHub Actions ;
- améliorations d’accessibilité, performance et cohérence des suggestions.

## 5.4.x — maintenance et mise en page

- corrections responsive ;
- sécurisation des données de journal et d’historique ;
- maintenance du service worker et du cache ;
- améliorations du flux de saisie des pas.

## 5.3.x — utilisabilité et scanner

- amélioration du scanner de codes-barres ;
- fermeture correcte de la caméra et des overlays ;
- amélioration du choix des quantités ;
- corrections de viewport et d’interactions tactiles.

## 5.2.x — audit UX final

- états vides et actions simplifiés ;
- améliorations de navigation et de lisibilité ;
- contrôles supplémentaires sur les cartes Santé.

## 5.1.x — finition

- polish visuel et comportemental ;
- amélioration des résumés et recherches ;
- réduction des duplications d’interface.

## 5.0.x — Apple Santé

- intégration HealthKit ;
- lecture des pas, sommeil, poids et activité selon autorisations ;
- écriture volontaire de certaines données ;
- entitlements et descriptions d’usage iOS.

## 4.x — données, OTA et expérience quotidienne

- base alimentaire Ciqual ;
- synchronisation des repas ;
- expérience quotidienne et recommandations ;
- OTA Web et durcissement progressif ;
- prise en charge Capacitor iOS.

## 3.x et antérieur

- premières fonctions premium ;
- premières intégrations natives ;
- scanner et fonctionnalités de suivi initiales.
