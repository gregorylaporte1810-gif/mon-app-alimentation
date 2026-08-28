# Fix V5.4.1 — validation backup

Le test `validate app bad journal` échouait car le validateur signalait correctement qu'un journal n'était pas un tableau, puis essayait quand même d'exécuter `.forEach()` dessus.

Le correctif :
- ne parcourt `journalCalories` que si c'est réellement un tableau ;
- ne parcourt `weightHistory` que si c'est réellement un tableau ;
- laisse `validateAppState()` renvoyer proprement une erreur au lieu de planter.

Installation :
```powershell
Expand-Archive .\wellness-v5.4.1-validation-fix.zip -DestinationPath . -Force
node .\apply-v541-validation-fix.mjs
npm run verify
```
