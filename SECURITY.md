# Security Policy

## Version prise en charge

La branche `main` et la dernière version 5.6.x publiée sont les versions maintenues.

Les anciennes branches, anciens installateurs et anciens bundles ne doivent pas être utilisés comme base de production.

## Signaler une vulnérabilité

Ne publie jamais dans une issue publique :

- une clé Supabase secrète ou `service-role` ;
- un access token ou refresh token ;
- un certificat ou profil Apple ;
- une clé privée de signature ;
- des données personnelles ou de santé réelles.

Pour un problème de sécurité, utilise de préférence le canal privé **Security / Report a vulnerability** du dépôt GitHub lorsqu’il est disponible.

Le signalement doit contenir uniquement les informations nécessaires pour reproduire le problème, avec des valeurs de test anonymisées.

## Règles de sécurité du projet

- les secrets serveur ne doivent jamais être intégrés au code client ;
- `www/` est un artefact généré et ne doit pas être versionné ;
- les builds de production doivent provenir du dernier commit attendu ;
- les dépendances sont installées avec `npm ci` dans les pipelines ;
- `npm run verify:ci` doit réussir avant une publication ;
- les modifications de sécurité passent par une pull request et une CI verte ;
- les règles RLS Supabase doivent être appliquées dans la base distante avant d’activer la synchronisation cloud.

## OTA

Le bundle OTA est contrôlé par origine, version, schéma et SHA-256. Le manifeste publie également le commit source et la taille du bundle.

Le SHA-256 n’est pas une signature cryptographique indépendante. Une compromission simultanée du canal de publication et du manifeste reste un risque résiduel ; une future signature asymétrique doit conserver sa clé privée hors du dépôt et hors de l’application cliente.


## Protection du dépôt

La configuration recommandée de `main` est : pull request obligatoire, Quality Gate requise, force-push et suppression interdits. Si ces règles ne sont pas disponibles via l’intégration utilisée, elles doivent être activées dans les paramètres GitHub du dépôt. La branche `ota` doit rester inscriptible uniquement par le workflow de publication prévu.

## Risques résiduels assumés

- les données applicatives ordinaires ne sont pas chiffrées de bout en bout par Wellness ; la protection de l’appareil reste importante ;
- les sauvegardes JSON exportées ne sont pas chiffrées par mot de passe ;
- le SHA-256 OTA protège l’intégrité déclarée, mais une signature asymétrique indépendante nécessite une clé privée gérée hors dépôt.
