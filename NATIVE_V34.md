# Wellness Premium V3.4 — Native iPhone fixes

Cette version ajoute les plugins natifs nécessaires pour les fonctions qui ne
peuvent pas être fiabilisées uniquement par HTML/CSS/JavaScript dans WKWebView.

## Corrigé nativement

- Sauvegarde JSON : fichier natif + feuille de partage iOS.
- Export CSV : fichier natif + feuille de partage iOS.
- Export PDF : vrai fichier PDF + feuille de partage iOS.
- Restauration JSON : sélecteur Fichiers iOS natif.
- Rappels hydratation/pesée : notifications locales iOS.
- Scanner code-barres : scanner natif ML Kit (détection automatique).
- L'app native affiche `iPhone` au lieu de `Web app` et masque `Installer l'app`.

## Corrections web incluses

- Première mesure de sommeil : `Première mesure` au lieu de `↑ 450 min`.
- Préférences alimentaires appliquées à la liste générale des recettes.

## Important

Cette mise à jour nécessite UNE nouvelle compilation IPA car elle ajoute des
plugins natifs Capacitor. Après cette installation, les futures modifications
HTML/CSS/JS restent distribuables par OTA comme avant.

Codemagic utilise maintenant CocoaPods car le plugin ML Kit Barcode Scanning
pour Capacitor 8 en a besoin sur iOS, avec un deployment target iOS 15.5.
