# Wellness 5.1 — Premium Polish

V5.1 est une version de finition. Elle évite d'empiler des fonctionnalités inutiles et améliore surtout l'expérience quotidienne.

## Correction importante — Nutrition qui remonte toute seule

La cause se trouvait dans le shell Premium :

- `syncPremiumUI()` tournait périodiquement ;
- `renderPremiumJournal()` reconstruisait entièrement `#px-journal-list` avec `innerHTML`, même si le journal n'avait pas changé ;
- V4.3 ajoutait ensuite ses résumés et boutons au même DOM ;
- sur iPhone, ces reconstructions répétées pouvaient casser l'ancrage de scroll et faire remonter la page, masquant `Recettes` et `Favoris`.

V5.1 :
- calcule une signature du journal ;
- ne reconstruit le journal que si les données ont réellement changé ;
- préserve la position de scroll lors d'un vrai changement ;
- ralentit le polling Premium à 3 s et le suspend quand l'app est en arrière-plan ;
- ajoute de l'espace sous Recettes/Favoris pour la barre de navigation iPhone.

## Polish ajouté

- recherche universelle depuis tous les headers ;
- aliments, recettes, repas enregistrés et réglages dans la même recherche ;
- personnalisation légère de l'écran Aujourd'hui ;
- possibilité de masquer score, stats, priorités, coach, repas, raccourcis et bilan du soir ;
- bilan du jour automatique à partir de 18 h ;
- aperçu manuel du bilan depuis les réglages ;
- navigation contextuelle depuis les priorités ;
- mode hors ligne visible et discret ;
- états vides plus utiles avec action quand c'est possible ;
- labels de graphiques dupliqués nettoyés ;
- animations et micro-interactions premium ;
- retours haptiques cohérents quand disponibles ;
- focus clavier plus visible ;
- `prefers-reduced-motion` respecté ;
- amélioration des zones tactiles ;
- réduction des reconstructions DOM inutiles.

## Installation

```powershell
node .\apply-v51-polish.mjs
npm install
npm run verify
```

Puis :

```powershell
git add -A
git commit -m "feat: polish daily UX and stabilize nutrition scrolling"
git push
```

## Déploiement

**OTA uniquement.** Aucun plugin natif n'est ajouté, donc aucune nouvelle IPA n'est nécessaire.

Le même code est inclus dans la PWA via `build:web` et `sw.js`.
