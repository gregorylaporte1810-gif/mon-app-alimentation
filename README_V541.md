# Wellness 5.4.1 — Responsive + réorganisation

Ce patch est prévu pour être appliqué **après Wellness 5.4.0**.

## Corrections

### iPhone de ta conjointe
L'ancien correctif V5.3 utilisait la propriété CSS `zoom` quand iOS détectait un viewport anormalement large. Cette méthode pouvait produire exactement les deux rendus vus sur les captures :
- application minuscule ;
- ou application agrandie/coupée avec une zone noire sur le côté.

V5.4.1 supprime ce mécanisme.

Le viewport utilise maintenant :

```html
width=device-width,
initial-scale=1,
minimum-scale=1,
viewport-fit=cover,
shrink-to-fit=no
```

et Nutrition ne peut plus agrandir la largeur globale de la page.

### Réorganisation
- **Aujourd'hui** reçoit le **Journal alimentaire**.
- **Nutrition** reçoit la **Validation des repas**.
- Les IDs existants ne changent pas, donc les calculs, boutons, synchronisations et sauvegardes restent les mêmes.

### Tests V5.4
Le crash :

```text
(account.journalCalories || []).forEach is not a function
```

est corrigé.

Les tests Maintenance ne sont plus figés sur `5.4.0` : ils vérifient désormais automatiquement la version présente dans `package.json`.

## Installation

```powershell
git pull --rebase origin main

$zip = Get-ChildItem "$HOME\Downloads" -Filter "wellness-v5.4.1-responsive-layout*.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

Expand-Archive -LiteralPath $zip.FullName -DestinationPath . -Force

node .\apply-v541-responsive-layout.mjs
npm install
npm run verify
```

Si tout est vert :

```powershell
git add -A
git commit -m "fix: improve iPhone layout and reorganize daily meal tracking"
git push
```

**OTA + PWA uniquement**, aucune nouvelle IPA.
