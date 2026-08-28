# Wellness 5.4 — Maintenance & Consolidation

Corrections appliquées :
- protection anti-downgrade OTA ;
- contrôle du schemaVersion OTA ;
- fallback Service Worker limité aux navigations ;
- CSP web + referrer policy ;
- bootstrap thème externalisé ;
- manifest PWA remis à jour ;
- validation plus stricte des sauvegardes ;
- restauration native alignée sur le validateur principal ;
- tests de régression V5.4 ;
- README remis à niveau.

À ne pas mélanger dans cette release :
- refonte complète des modules historiques ;
- lazy-loading de Ciqual ;
- remplacement global de l'architecture par bundler moderne.

Ces refactorings sont utiles mais doivent être réalisés dans une branche dédiée avec tests E2E, pour éviter de casser l'application iPhone déjà stable.
