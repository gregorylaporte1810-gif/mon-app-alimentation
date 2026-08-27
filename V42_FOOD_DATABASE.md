# Wellness 4.2 — Food Database & quantités intelligentes

Cette mise à jour ajoute :

- **Table Ciqual 2025 officielle ANSES** : environ **3 484 aliments** hors ligne.
- Recherche locale tolérante aux accents.
- Recherche complémentaire de produits **Open Food Facts** en ligne.
- Journal alimentaire avec quantités :
  - g
  - kg
  - ml
  - cl
  - L
  - unité
- Recalcul automatique calories / protéines / glucides / lipides.
- Conversion volume ↔ poids pour les aliments liquides avec densité indicative.
- Poids d'une unité personnalisable quand nécessaire.
- Les entrées existantes restent compatibles.
- Scanner code-barres conservé.
- Aucun nouveau plugin natif : **pas besoin de reconstruire l'IPA**.

## Source nutritionnelle

Les aliments génériques sont importés depuis :

**Anses. 2025. Table de composition nutritionnelle des aliments Ciqual**  
DOI : `10.57745/RDMHWY`  
Licence Ouverte Etalab 2.0.

La table 2025 contient 3 484 aliments et 74 constituants. Wellness importe les principaux champs utiles au journal : énergie, protéines, glucides, lipides, fibres, sucres, acides gras saturés et sel.

## Installation

Depuis la racine de `mon-app-alimentation` :

```powershell
node .\apply-v42-fooddb.mjs
npm install
npm run fooddb:ciqual
npm run verify
```

La commande `fooddb:ciqual` télécharge directement le fichier Excel officiel Ciqual depuis Recherche Data Gouv puis génère `data-foods-ciqual.js`.

Ensuite :

```powershell
git add -A
git commit -m "feat: expand food database and add smart quantity units"
git push
```

OTA web uniquement : aucune nouvelle IPA n'est requise.

## Tests iPhone

1. Nutrition → rechercher `poulet`, `riz`, `yaourt`, `eau`, etc.
2. Vérifier que le bandeau indique environ 3 484 aliments Ciqual.
3. Ajouter `Eau` ou une boisson avec `1 L`.
4. Ajouter un aliment avec `250 g`.
5. Ajouter un aliment avec `0,5 kg`.
6. Tester une quantité en `unité`.
7. Modifier l'entrée depuis le journal et changer quantité/unité.
8. Scanner un produit et ajouter sa portion.
