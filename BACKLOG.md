# Backlog AppMuscu

Une ligne par sujet. Ajoute en haut de la bonne section, avec la date si tu veux.
Quand c'est fait, déplace la ligne dans « Fait » avec la version.

## 🐞 Bugs
- [ ] (15/11) Données effacées après quelques jours, appli lancée depuis l'icône. Piste : icône ajoutée depuis la navigation privée. À vérifier : Réglages de l'appli > Sauvegarde > ligne « Stockage persistant ».
- [ ] (15/11) Chaque sauvegarde crée un nouveau fichier dans iCloud (nom daté), à supprimer à la main.

## ✨ Améliorations
- [ ] (15/11, validé) Synchro automatique vers un dépôt GitHub privé dédié : envoi en fin de séance, restauration au lancement si les données locales manquent. Jeton limité à ce dépôt, collé une fois dans Réglages. Export manuel gardé en secours.
- [ ] (15/11) Sauvegarde sans images intégrées : ne garder que l'adresse de l'image, pas l'image elle-même.
- [ ] (15/11) Photos de mes exercices (Johan prépare la liste et les photos dans `bank/exo/`), GIF plus tard.
- [ ] Bouton de suppression de séance trop petit : ajouter un grand bouton rouge « Supprimer la séance » en dessous.
- [ ] Message d'accueil : « Prêt pour ta prochaine séance ? » ou plusieurs phrases au choix.

## 🔧 Technique (relevé en revue, à traiter si gênant sur l'iPhone)
- [ ] (15/11, veille Claude) À la prochaine session AppMuscu : tester `GoogleChrome/modern-web-guidance` (skills des équipes Chrome/Firefox/MDN sur les API web modernes). D'abord revue du dépôt (`git clone --depth 1 https://github.com/GoogleChrome/modern-web-guidance "$TEMP/review-modern-web-guidance"`, Git Bash), puis scan sans installation : `npx modern-web-guidance@latest legacy-scan .` depuis ce dossier. Doc : https://developer.chrome.com/docs/modern-web-guidance
- [ ] Cibles tactiles de moins de 44 px sur certains boutons.
- [ ] Filtres animés coûteux (flash, flamme, drop-shadow, néons).
- [ ] Animation `neonflick` qui écrase `neonpulse` (décalage d'environ 2,5 s par cycle).
- [ ] Modale qui ne s'adapte pas au clavier (hauteur en `vh`).
- [ ] Recalcul complet des stats à chaque affichage (négligeable pour l'instant).

## ✅ Fait
- v2.1.1 : maintien de l'écran redemandé au toucher, état affiché dans Réglages. Confirmé sur l'iPhone (iOS 26.6.2) le 15/11.
- v2.1.0 : consigne compacte, suppression d'exercice et d'historique, carnet de bugs, mini-Johan Pull, « Cliquer pour modifier ».
