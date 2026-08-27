# Wellness 5.3.1 — Usability

Cette version répond aux retours d'utilisation sur un deuxième iPhone.

## 1. Affichage iPhone trop petit

Sur certains réglages Safari/PWA, iOS peut exposer un viewport beaucoup plus large que la largeur réelle du téléphone, ce qui donne l'impression que Wellness est affichée en miniature.

V5.3 ajoute une garde automatique :
- uniquement sur iPhone/iPod en portrait ;
- uniquement quand le viewport détecté est anormalement large ;
- les iPhone qui affichent déjà Wellness normalement ne sont pas modifiés.

Le meta viewport reçoit également `viewport-fit=cover`.

> Si un iPhone force volontairement « Site pour ordinateur » ou un zoom Safari inhabituel, remettre le zoom de page à 100 % reste recommandé. La garde V5.3 évite toutefois que l'application devienne inutilisable.

## 2. Pas modifiables

Toucher la carte des pas (ou `+ > Pas`) ouvre maintenant un éditeur du **total de pas du jour**.

On peut :
- saisir directement le bon total ;
- diminuer la valeur en cas d'erreur ;
- utiliser `−1000`, `+500`, `+1000`, `+5000` ;
- enregistrer 0 si nécessaire.

## 3. Liquides : mL / cL / L

Les liquides sont détectés plus largement :
- eau ;
- lait ;
- café / thé / infusion ;
- jus / soda / boissons ;
- soupes / bouillons ;
- huiles / sirops / vinaigres / sauces ;
- kéfir / kombucha ;
- yaourts à boire ;
- etc.

Pour un liquide, Wellness propose maintenant en premier :
`mL → cL → L`

Les grammes restent disponibles comme alternative mais ne sont plus nécessaires pour saisir un volume.

Exemples :
- 250 mL de lait ;
- 33 cL de soda ;
- 0,5 L d'eau.

## 4. Fermeture automatique après validation

Après `Ajouter au journal`, Wellness ferme maintenant :
- la fenêtre de portion ;
- la fenêtre de recherche alimentaire restée derrière ;
- la fenêtre du scanner si l'ajout venait d'un code-barres.

On revient donc directement à Nutrition.

## Installation

```powershell
node .\apply-v531-usability.mjs
npm install
npm run verify

git add -A
git commit -m "feat: improve iPhone usability and liquid tracking"
git push
```

Aucun nouveau plugin natif : **OTA uniquement**.

La **PWA reçoit les mêmes changements**.


## 5. Plus de zoom au double-tap

Le double-tap accidentel ne zoome plus Wellness.

La correction utilise :
- `touch-action: manipulation` sur l'interface ;
- une garde iOS sur deux touchers successifs très rapprochés.

Le **pinch-to-zoom à deux doigts reste disponible**.
