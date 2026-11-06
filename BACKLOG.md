# Backlog AppMuscu

Une ligne par sujet. Ajoute en haut de la bonne section, avec la date si tu veux.
Quand c'est fait, déplace la ligne dans « Fait » avec la version.

## 🐞 Bugs
- [ ] Écran qui se met en veille au bout de 30 s (iOS 26.6.2, lancé depuis l'icône). Correctif en test en v2.1.1 : vérifier Réglages > À propos > « Maintien de l'écran ».

## ✨ Améliorations
- [ ] Bouton de suppression de séance trop petit : ajouter un grand bouton rouge « Supprimer la séance » en dessous.

## 🔧 Technique (relevé en revue, à traiter si gênant sur l'iPhone)
- [ ] Cibles tactiles de moins de 44 px sur certains boutons.
- [ ] Filtres animés coûteux (flash, flamme, drop-shadow, néons).
- [ ] Animation `neonflick` qui écrase `neonpulse` (décalage d'environ 2,5 s par cycle).
- [ ] Modale qui ne s'adapte pas au clavier (hauteur en `vh`).
- [ ] Recalcul complet des stats à chaque affichage (négligeable pour l'instant).

## ✅ Fait
- v2.1.1 : maintien de l'écran redemandé au toucher, état affiché dans Réglages.
- v2.1.0 : consigne compacte, suppression d'exercice et d'historique, carnet de bugs, mini-Johan Pull, « Cliquer pour modifier ».
