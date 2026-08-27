# Wellness Premium V3.5 — Scanner iPhone sécurisé

Cette version corrige le seul problème restant observé sur l'iPhone : l'app se
fermait immédiatement au lancement du scanner natif.

## Changements

- abandon de l'interface native `BarcodeScanner.scan()` qui présentait un
  contrôleur plein écran et provoquait la fermeture sur l'app testée ;
- utilisation de `BarcodeScanner.startScan()` avec une interface Wellness
  transparente par-dessus la caméra ;
- écoute de l'événement `barcodesScanned`, arrêt propre après une détection ;
- bouton Annuler et retour vers la saisie manuelle ;
- vérification `isSupported()` avant d'ouvrir la caméra ;
- vérification / demande explicite de l'autorisation caméra ;
- `NSCameraUsageDescription` injecté APRÈS `cap sync`, puis vérifié ;
- la clé caméra est aussi injectée au build Xcode et contrôlée dans l'App.app ;
- version du plugin scanner épinglée à 8.1.0.

## Important

Cette correction touche le comportement du plugin natif et la configuration
iOS. Il faut donc reconstruire et réinstaller UNE nouvelle IPA.
