# Backlog AppMuscu

Une ligne par sujet. Ajoute en haut de la bonne section, avec la date si tu veux.
Quand c'est fait, déplace la ligne dans « Fait » avec la version.

## 🐞 Bugs
- [ ] (15/11, en observation) Données effacées après quelques jours. Icône réinstallée depuis Safari normal le 15/11 et synchro GitHub active : vérifier dans quelques jours. Si ça recommence : « Restaurer depuis GitHub » et le signaler.

## ⚡ Rapides (prochaine version)
- [ ] Chrono de repos plus gros, et « Fin de séance » masqué pendant le chrono.
- [ ] Pendant le dernier repos d'un exercice : bouton pour passer directement à l'exercice suivant.
- [ ] Modifier la consigne d'un exercice pendant la séance.
- [ ] Grand bouton rouge « Supprimer la séance » (le bouton actuel est trop petit).
- [ ] Message d'accueil : « Prêt pour ta prochaine séance ? » ou plusieurs phrases tirées au hasard.
- [ ] Ajouter / retirer des exercices pendant la séance (vérifier ce qui existe déjà : « Remplacer », retrait au récap).
- [ ] Consignes encore en anglais « (EN, à reformuler) » : traduire en français (3 dans les données : Concentration Curls, Seated Leg Curl, Thigh Abductor ; le catalogue de 873 exercices est en anglais).

## 🎨 Design (proposer des pistes en maquette avant de coder)
- [ ] Boutons secondaires plus jolis : Retour, « Supprimer cet exercice », Progrès, « Supprimer l'historique de cet exercice », etc.
- [ ] Nouveaux styles de records et nouveaux KPI (au-delà de « kilos soulevés » et « record »).
- [ ] Remplacer « X semaines d'affilée » par quelque chose de plus motivant.

## 🧱 Plus lourds (à cadrer avec Johan avant de coder)
- [ ] Mode unilatéral : poids côté gauche / côté droit selon l'exercice.
- [ ] Mode ressenti de séance : fatigue, mauvaise nuit, etc.
- [ ] Mode vidéo : espace réservé pour le picture-in-picture, activable dans les Réglages.
- [ ] Renommer l'appli en YeahBuddy et refaire le logo / l'icône.
- [ ] Photos de mes exercices (Johan les prépare dans `bank/exo/`), GIF plus tard.

## 🔧 Technique (relevé en revue, à traiter si gênant sur l'iPhone)
- [ ] (15/11, veille Claude) À la prochaine session AppMuscu : tester `GoogleChrome/modern-web-guidance` (skills des équipes Chrome/Firefox/MDN sur les API web modernes). D'abord revue du dépôt (`git clone --depth 1 https://github.com/GoogleChrome/modern-web-guidance "$TEMP/review-modern-web-guidance"`, Git Bash), puis scan sans installation : `npx modern-web-guidance@latest legacy-scan .` depuis ce dossier. Doc : https://developer.chrome.com/docs/modern-web-guidance
- [ ] Cibles tactiles de moins de 44 px sur certains boutons.
- [ ] Filtres animés coûteux (flash, flamme, drop-shadow, néons).
- [ ] Animation `neonflick` qui écrase `neonpulse` (décalage d'environ 2,5 s par cycle).
- [ ] Modale qui ne s'adapte pas au clavier (hauteur en `vh`).
- [ ] Recalcul complet des stats à chaque affichage (négligeable pour l'instant).

## ✅ Fait
- v2.2.0 (15/11) : synchro GitHub privée (connexion, envoi auto à la sortie de l'appli et en fin de séance, restauration), sauvegarde sans images (18 Ko au lieu de plusieurs Mo), nom de fichier fixe. Confirmé sur l'iPhone le 15/11.
- (15/11) « Undo typing » : réglage iOS « Secouer pour annuler », désactivé par Johan.
- v2.1.1 : maintien de l'écran redemandé au toucher, état affiché dans Réglages. Confirmé sur l'iPhone (iOS 26.6.2) le 15/11.
- v2.1.0 : consigne compacte, suppression d'exercice et d'historique, carnet de bugs, mini-Johan Pull, « Cliquer pour modifier ».
