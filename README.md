# Wellness 2.0 Pro

Application Web/PWA locale de suivi nutrition, activité et habitudes.

## Nouveautés 2.0 Pro

- Coach quotidien et score bien-être explicable
- Base alimentaire locale avec portions et macros
- Scanner code-barres via `BarcodeDetector` quand disponible + recherche Open Food Facts
- Capture photo de repas avec recherche assistée et connecteur IA optionnel
- Objectifs avancés : perte, muscle, maintien, recomposition, mieux manger, activité
- Prévision de poids et comparaison semaine/semaine
- Sommeil, humeur, énergie et activités sportives
- Missions hebdomadaires + XP existant
- Préférences alimentaires, allergies/exclusions et recommandations « Pour toi »
- Bouton universel `+`, gestes tactiles, vibration mobile et safe-area iPhone
- Centre de notifications dans l'application
- Liste de courses avec fusion g/kg et ml/cl/l
- Sauvegarde/restauration JSON
- Synchronisation Supabase optionnelle
- Modules séparés : `core-utils.js`, `data-foods.js`, `cloud.js`, `wellness2.js`
- Tests purs dans `tests.html`

## Lancer

Utiliser Live Server, `python -m http.server` ou un autre serveur local. La PWA, la caméra et le service worker ne fonctionnent pas correctement avec `file://`.

## Synchronisation Supabase

1. Créer un projet Supabase.
2. Exécuter `SUPABASE_SETUP.sql` dans le SQL Editor.
3. Dans Profil > Compte cloud, renseigner **Project URL** et la **clé anon publique**.
4. Créer un compte email/mot de passe, puis utiliser Envoyer/Récupérer.

Ne jamais mettre une clé `service_role` dans l'application.

## Photo de repas

La capture photo fonctionne localement. La reconnaissance automatique réelle nécessite un backend IA que tu contrôles. L'endpoint configurable reçoit un POST JSON :

```json
{"image":"data:image/jpeg;base64,...","description":"poulet riz","locale":"fr-FR"}
```

Il doit répondre par exemple :

```json
{"foods":[{"name":"Poulet","kcal100":165,"protein100":31,"carbs100":0,"fat100":3.6}]}
```

Sans endpoint, l'app utilise la description pour rechercher dans la base alimentaire locale.

## Limites importantes

Les calories, macros, objectifs et prévisions sont des estimations de suivi, pas des prescriptions médicales. Les valeurs de la base locale sont des moyennes indicatives. Pour les allergies sévères, toujours vérifier les étiquettes et ingrédients réels.
