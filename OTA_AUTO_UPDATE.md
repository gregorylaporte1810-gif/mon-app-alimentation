# Wellness — mises à jour web automatiques

Cette version ajoute `@capgo/capacitor-updater` en mode **self-hosted**.

## Ce qui change

Après UNE reconstruction native avec Codemagic + réinstallation via AltStore :

- les futures modifications HTML/CSS/JS sont publiées automatiquement en OTA ;
- GitHub Actions crée `ota/wellness-web.zip` et `ota/latest.json` à chaque push web sur `main` ;
- Wellness vérifie silencieusement les mises à jour au lancement, au retour au premier plan et toutes les 15 minutes ;
- la mise à jour téléchargée est activée au prochain passage en arrière-plan / redémarrage ;
- les données `localStorage` restent dans la même application.

## Première installation (une seule fois)

```powershell
npm install
npm run build:web
git add .
git commit -m "feat: add automatic web updates"
git push
```

Ensuite vérifie GitHub > Actions > `Publish Wellness OTA`.

Puis reconstruis une seule fois :

`Codemagic > Wellness - iPhone unsigned IPA`

et réinstalle l'IPA avec AltStore.

## Ensuite

Pour une correction HTML/CSS/JS classique :

```powershell
git add .
git commit -m "fix: ..."
git push
```

Pas besoin de refaire Codemagic.

## Quand faut-il encore refaire un IPA ?

Seulement pour une modification native :
- ajout/mise à jour d'un plugin Capacitor ;
- permissions iOS ;
- icône/splash natifs ;
- Bundle ID ;
- code Swift / configuration Xcode.

## Important

AltStore garde sa contrainte de signature gratuite de 7 jours.
L'OTA évite de reconstruire l'IPA à chaque changement web, mais ne supprime pas
le rafraîchissement périodique de la signature AltStore.
