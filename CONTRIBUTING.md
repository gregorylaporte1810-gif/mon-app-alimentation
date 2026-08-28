# Contribuer à Wellness

## Workflow

- partir de `main` à jour ;
- créer une branche `fix/*`, `feat/*` ou `chore/*` ;
- utiliser des Conventional Commits en anglais ;
- exécuter `npm ci` puis `npm run verify:ci` ;
- pour une modification UI, installer Chromium avec `npx playwright install chromium`, puis exécuter `npm run test:e2e` ;
- ouvrir une pull request et attendre la Quality Gate verte avant fusion.

## Sécurité

Ne jamais committer de clé `service_role`, `sb_secret_*`, mot de passe, token, certificat Apple ou clé privée. Utiliser des données de test anonymisées.

## UI

Préserver les cibles tactiles de 44 px, les focus visibles, les safe areas iOS, `prefers-reduced-motion` et les deux thèmes. Les messages dynamiques importants doivent être annoncés via une région live.
