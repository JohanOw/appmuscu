# Rapport AppMuscu v2.3 (nuit du 15 au 16 novembre 2026)

**Rien n'est commité ni en ligne.** Tout est en local dans le dossier du projet, non commité. GitHub Pages reste en v2.2.0. La publication attend ton accord.

## 1. Ce qui a été fait

### Accueil
- Hero avec la séance du jour.
- Citation du jour : une par jour, elle tourne sur la liste.
- Objectif de la semaine : 7 points (lundi à dimanche). L'objectif se règle dans Réglages, de 1 à 7 séances (3 par défaut), stocké dans kv `goal`.
- Carte « Exercice phare » avec sparkline et progression en %.

### Ressenti
Feuille du bas ouverte par « Commencer », avec 5 humeurs. L'humeur est enregistrée sur la séance (`mood`) et ajuste la suggestion :
- « En forme » : +2,5 kg.
- Fatigué, peu dormi, douleur : charge de la dernière fois.

### Mode unilatéral
- Interrupteur « Unilatéral » sur la fiche exercice (`ex.uni`).
- En séance, grille Série / Gauche / Droite et ligne info dorée.
- Suggestion côté gauche seulement : le droit reste en charge libre, pour la rééducation.
- Bouton « Valider la série N ». Annulation possible, ajout et retrait de série.
- Carte Équilibre : 1RM estimé droite ÷ gauche, avec le prochain palier.
- Les séries portent `side: 'L'` ou `'R'`. Une paire compte pour une série, et le volume compte les deux côtés.
- Records par côté : un côté n'est comparé qu'à lui-même et à l'ancien bilatéral.

### Récap
- Titre « Bien joué. », date et ressenti.
- Tuiles Durée, Séries et Volume.
- Carte « Pour te donner une idée » : volume converti en animal.
- Records avec libellé détaillé, par exemple « Gauche · nouvelle charge max ».
- Carte « Succès débloqué » : seulement les paliers débloqués par cette séance.
- Détail avec préfixes G / D.
- Boutons :
  - « Sauvegarder et quitter » : partage ou téléchargement, puis retour à l'accueil. Avec la synchro GitHub, envoi puis retour.
  - « Voir mes succès ».
  - « Exporter aussi un fichier » : affiché seulement si la synchro est configurée.
  - « Supprimer cette séance ».

### Progrès
4 onglets :
- **Courbes** : l'écran existant.
- **Calendrier** : l'écran existant.
- **Muscles** :
  - carte face et dos dessinée sur un canvas à partir de `img/muscles/`, en 4 niveaux (0, 1 à 4, 5 à 9, 10 et +) ;
  - navigation par semaine ;
  - toucher un muscle ouvre la liste des exercices ;
  - liste des séries par muscle avec l'écart par rapport à la semaine précédente.
- **Succès** : cartes à paliers (Équilibre, Bras droit, Volume cumulé, Guerrier du week-end, Objectif tenu, Présent quand même, Fidèle par exercice).

### Mensurations
- Champs : poids, masse grasse, bras gauche, bras droit, poitrine, taille, cuisse.
- Historique, une courbe par mesure, suppression avec confirmation.
- Les anciennes mesures (poids et masse grasse seulement) restent lisibles. Les nouvelles gardent `w` et `bf`, à `null` s'ils sont vides.

### Version
- `APP_VERSION = '2.3.0'`.
- `sw.js` : `VERSION = 'appmuscu-v2.3.0'`, avec `js/v23.js` et les 5 images de `img/muscles/` dans la liste des fichiers en cache.

### Fichiers
- Modifiés : `js/app.js`, `js/stats.js`, `css/app.css`, `sw.js`, `STATE.md` (section V2.3).
- Nouveaux :
  - `js/v23.js` : calculs purs.
  - `tests/v23.test.mjs`.
  - `img/muscles/` (base.webp, l1/l2/l3.webp, zones.png).
  - `tools/muscle-map-prep.ps1` et `tools/muscle-map-layers.py` : préparation des images, à lancer une seule fois, hors appli.
  - `bank/captures-v2.3/` : captures, dans un dossier ignoré par git.
- `BACKLOG.md` et `save/` : pas touchés par cette session.

### Corrections faites pendant les tests
1. **Feuille Ressenti bloquante** : après le choix d'une humeur, le fond de la feuille restait dans la page, invisible et plein écran, et bloquait tous les clics. Corrigé en CSS avec `visibility: hidden` et `pointer-events: none` hors affichage.
2. **Bouton « Exporter aussi un fichier » visible sans synchro** : le style `.btn` écrasait l'attribut `hidden`. Corrigé avec une règle globale `[hidden] { display: none !important; }`. Les autres éléments `hidden` de l'appli (champs fichier cachés, messages) ont été vérifiés : la règle va dans leur sens.
3. **Confirmation de fin de séance** : elle comptait une paire gauche + droite comme 2 séries, alors que le récap en compte 1. Elle compte maintenant comme le récap.
4. Unité des courbes de mensurations : double espace retiré.

## 2. Vérifié (tests réellement exécutés)

### Tests automatiques
- `node --check` sur tous les fichiers `js/*.js` et `sw.js` : OK.
- `node --test tests/stats.test.mjs tests/sync.test.mjs tests/v23.test.mjs` : 35 tests, 35 OK, 0 échec.

### Navigateur intégré
Conditions :
- Viewport mobile 430 × 932.
- Serveur local sur le **port 8081**, car le 8080 était occupé. C'est une origine séparée, remplie avec des données de test injectées : 4 séances fictives et un historique unilatéral. Ce ne sont pas tes données.

Écrans testés :
- **Accueil** : hero, citation, objectif 0/3 puis 1/4 après réglage à 4, carte exercice phare (« +15 % » sur Développé incliné haltères).
- **Ressenti** : 5 humeurs affichées. « En forme » donne la suggestion 77,5 kg × 8 au développé couché (dernière fois 75 × 8).
- **Unilatéral** :
  - grille, « la dernière fois » G 30 × 10 / D 22 × 10, suggestion gauche 32,5 × 10 ;
  - « Appliquer » remplit les champs ;
  - « Valider la série 1 » lance le repos, marque le record gauche (🏆) et affiche l'Équilibre à 68 % (22 ÷ 32,5, calcul juste) avec le palier 75 %.
- **Fin de séance anticipée** :
  - confirmation, écran « Fin anticipée » ;
  - récap : 1 série, 545 kg (32,5 × 10 + 22 × 10, exact), 1 record « Gauche · nouvelle charge max », succès « Bras droit · palier 2 », détail « G 32,5×10 · D 22×10 ».
- **Export** :
  - le téléchargement a été intercepté dans la page, sans fichier écrit sur le disque ;
  - fichier `appmuscu-sauvegarde.json` produit, avec `mood` et les côtés `L` / `R` présents ;
  - le jeton de synchro est absent du fichier ;
  - le même fichier repasse `readBackup` / `validateBackup` ;
  - retour à l'accueil ensuite.
- **Progrès > Muscles** :
  - carte dessinée, pectoraux en cyan ;
  - toucher le pectoral ouvre « Pectoraux · 1 série » avec l'exercice ;
  - semaine précédente : 2 séances.
- **Progrès > Succès** : 10 / 54 paliers, cartes verrouillées et déverrouillées affichées.
- **Mensurations** : ajout de bras gauche 38,5, bras droit 37 et taille 82, enregistrés dans kv `body` avec `w` et `bf` à `null`. Les courbes apparaissent.
- **Fiche exercice** : l'interrupteur unilatéral s'enregistre dans la base dans les deux sens.
- **Console** : aucune erreur. Seuls des avertissements wake lock sont attendus dans ce navigateur.

Captures (dossier `bank/captures-v2.3/`) :
- 01-accueil
- 02-ressenti
- 03-unilateral
- 04-recap
- 05-muscles
- 06-muscle-detail
- 07-succes
- 08-mensurations

## 3. Non testé
- Rien sur iPhone : feuille de partage iOS, rendu Safari, zones sûres, clavier décimal dans la grille unilatérale.
- Synchro GitHub en v2.3 : envoi réel non testé, pour ne rien toucher sur GitHub. Seule la logique « pas de jeton » a été vue.
- Import d'une sauvegarde v2.2 réelle dans la v2.3 (validation testée sur un fichier v2.3 seulement), et import d'un fichier v2.3 dans une v2.2.
- Séance unilatérale terminée normalement (toutes séries faites) : seule la fin anticipée a été testée.
- Boutons d'annulation et +/− série de la grille unilatérale, onglets Courbes et Calendrier après la refonte, suppression d'une mesure.
- Hors ligne avec le nouveau service worker.

## 4. Hypothèses (réversibles)
- La citation du jour vient du tableau de la maquette, qui compte 37 lignes et non 36 comme indiqué. Les 37 sont gardées.
- Ressenti « Douleur » : la détection des records reste active. On peut la couper si tu préfères.
- Équilibre dans l'onglet Succès : meilleur ratio atteint sur l'historique (73 % ici, vérifié dans le code), pas celui de la dernière séance (68 % au récap).
- L'équivalent animal prend le plus gros animal sous le volume. 545 kg donne donc « un gorille », ce qui est vrai en ordre de grandeur mais imprécis. Le texte peut être ajusté.
- Les anciennes séances sans côté sont traitées comme bilatérales.

## 5. Problèmes ouverts
- Exercice unilatéral placé juste après un superset : enchaînement non géré finement.
- Fessiers : pas de zone sur la carte musculaire, car absents des images sources. Ils comptent dans la liste mais ne se colorent pas.
- Les lignes futures de la grille unilatérale (séries pas encore commencées) ne sont pas modifiables avant leur tour.
- `STATE.md` indique encore pour la v2.2.0 « pas encore en ligne », alors que la consigne dit que Pages est en v2.2.0. À vérifier de ton côté.

## 6. Tester en local

[PC] Git Bash ou PowerShell, dans le dossier du projet :

```bash
node tools/serve.mjs
```

Puis ouvrir http://localhost:8080 et passer le navigateur en mode mobile (F12, barre d'outils appareil).

Si l'ancienne version s'affiche, le service worker sert le cache. Dans les outils de développement, onglet Application : « Unregister » le service worker, « Clear storage », puis recharger.

Tests :

```bash
node --test tests/stats.test.mjs tests/sync.test.mjs tests/v23.test.mjs
```

## 7. Rappel
Rien n'est commité, rien n'est poussé, GitHub Pages est toujours en v2.2.0. Pour publier, il faudra ton accord explicite, puis un commit et un push.

## 8. Travaux complémentaires (16 novembre 2026)

Toujours en local : rien n'est commité, rien n'est poussé.

### Fusion Hip thrust
- Nouveau fichier `js/migrate.js`, fonction pure `planHipThrust`. L'exercice `Barbell_Hip_Thrust` est fusionné dans ton exercice perso « Hip thrust » (`custom_mw6hm706zjuhl`).
- Historique conservé : les séances passées et la séance en cours éventuelle pointent vers « Hip thrust ». Dans une séance type qui contenait déjà les deux, le doublon est retiré.
- Avant toute écriture, une copie des enregistrements concernés est stockée dans la base (clé `mig-hipthrust-backup`). Un drapeau (`mig-hipthrust`) empêche une seconde exécution. Si l'un des deux exercices manque, rien ne se passe.

### Animations par exercice
- 20 animations dans `img/mascotte/ex/`. Décor 1 (salle machines) pour les machines, décor 2 (poids libres) pour les haltères et barres.
- Correspondance par identifiant, puis repli sur le nom exact (sans accents ni casse) dans `js/exart.js`.
- Trois exercices perso réutilisent une animation existante (alias) : Hip thrust, une presse pectorale et un tirage vertical.
- Développé incliné haltères garde son animation actuelle, le .jfif n'est pas utilisé.
- Nouvel outil `tools/white-prep.py` pour les sources sur fond blanc (fond retiré seulement depuis les bords, les blancs du personnage sont gardés).

### Nouveaux exercices par défaut
- Belt squat et Crunch à la machine, décor 1. Ajoutés une seule fois (clé `defaults-v23`), et seulement si ni l'identifiant ni le nom n'existent déjà.

### Retrait des images free-exercise-db
- Les 24 fichiers `img/ex/*.jpg` sont supprimés et retirés de `sw.js`. Ils restent récupérables dans l'historique git.
- Plus aucun téléchargement depuis raw.githubusercontent. Ajouter depuis le catalogue crée l'exercice sans image.
- Un exercice sans animation ni image perso affiche un visuel neutre et la carte musculaire.
- Les images déjà stockées dans la base ne sont pas supprimées, elles ne sont plus affichées. Une image que tu as mise toi-même reste affichée (bouton « Retirer mon image »).
- `catalog.json` est gardé (noms et muscles). La fonction de sauvegarde `stripImages` est inchangée pour rester compatible avec une sauvegarde v2.2.
- Crédits mis à jour dans Réglages et sur la fiche exercice.
- Effet visible : des exercices comme Développé militaire perdent leur ancienne photo et affichent le visuel neutre.

### Icônes
- 180, 192 et 512 régénérées depuis `img/icons/icone yeahbuddy.jfif` avec `tools/icon-prep.py`. Le .jfif n'est pas dans la liste du service worker.
- Entrée « maskable » retirée du manifeste : l'haltère dépasse la zone sûre de 80 %, elle aurait été rognée.
- `index.html` pointe déjà vers `icon-180.png` pour l'écran d'accueil iPhone.

### Vérifié
- Tests : 39/39 (`node --test tests/stats.test.mjs tests/sync.test.mjs tests/v23.test.mjs`), dont 3 tests Hip thrust sur ta sauvegarde réelle (lecture seule) et 1 test des nouveaux exercices.
- Navigateur intégré, port 8080, sauvegarde importée dans le navigateur de test (pas ton téléphone) :
  - après rechargement : Barbell_Hip_Thrust supprimé, 2 séances Hip thrust conservées avec leurs séries, séance Legs mise à jour, copie de sauvegarde présente, 37 exercices, 3 séances intactes ;
  - les 51 fichiers du service worker répondent 200, aucun appel vers raw.githubusercontent ni `img/ex/`, aucune erreur console ;
  - les 23 entrées d'animation pointent vers un fichier existant et listé dans `sw.js`.
- Captures : `bank/captures-v2.3/09` à `13` (Legs, Côté gauche, Push, Belt squat, exercice sans image).

### Non testé
- Sur l'iPhone : installation de l'icône, migration sur les vraies données du téléphone.
- Ajout depuis le catalogue en conditions réelles (seul le code a été relu).
- Synchro GitHub après migration (non lancée volontairement).
- Rendu de chaque animation pendant une séance en cours (seules les vignettes et fiches ont été vues).

## 9. Retours de Johan du 16 novembre au soir

Tout reste en local : rien n'est commité ni poussé, GitHub Pages reste en v2.2.0.

### Ce qui a changé
- **Accueil** : le décor sunset avec le mini-Johan et le glow sur le nom de la séance du jour sont rétablis. Ils avaient disparu en suivant la maquette v2.3.
- **Boutons retour** : les liens bleus « ‹ Entraînement » et « ‹ Progrès » sont remplacés par un bouton rond avec une flèche (44 px, libellé lu par VoiceOver).
- **Boutons Supprimer** : « Supprimer cette séance », « Supprimer l'historique de cet exercice » et les autres suppressions sont des boutons pleine largeur, contour rouge, icône corbeille.
- **Calendrier** : les gros ronds roses sont remplacés par des carrés arrondis discrets, avec un petit point néon les jours d'entraînement. Le jour actuel a un contour cyan.
- **Succès** : chaque carte indique le prochain palier (« Prochain palier : 5 séances le week-end »). Un toucher ouvre une fiche : ce qui est compté, où tu en es, et la liste des paliers (✓ obtenu, ○ à venir). Le volume affiché est arrondi à la tonne inférieure, pour ne plus voir « 36 / 36 » avant le palier.
- **Séance en cours** : dans la liste des exercices, « + Ajouter un exercice » et une croix pour retirer un exercice (avec confirmation, et le nombre de séries validées s'il y en a). Ces changements valent pour la séance en cours uniquement : la séance type n'est pas modifiée.
- **Consignes** : Seated Leg Curl, Thigh Abductor et Concentration Curls passent en français au démarrage, seulement si la consigne commence encore par « (EN, à reformuler) ». Une consigne déjà réécrite n'est jamais touchée. Les textes d'origine sont gardés dans `cues-en-backup`.
- **Carnet de bugs** : les entrées corrigées sont listées dans le code (`FIXED_BUGS`, js/migrate.js). Elles disparaissent du carnet à l'ouverture de la nouvelle version, et une copie est gardée dans `bugs-fixed`. 7 entrées retirées : sauvegarde, « undo typing », ressenti, unilatéral, logo, traduction, ajouter / retirer un exercice.

### Bugs du carnet encore ouverts
- Chrono plus gros.
- Proposer de passer au suivant à la fin de l'exercice.
- Modifier la consigne pendant la séance.
- Mode vidéo.
- Renommer l'application en YeahBuddy (le manifeste et le titre disent encore « AppMuscu »).

### Message « Maintien de l'écran : inactif (NotAllowedError…) »
L'appli demande au navigateur de garder l'écran allumé (Screen Wake Lock). « NotAllowedError » veut dire que le navigateur a refusé la demande. Ce n'est pas un bug de la v2.3. Causes habituelles :
- la page n'était pas visible au moment de la demande (onglet en arrière-plan, écran verrouillé) ;
- un navigateur ou un mode qui ne l'autorise pas : navigateur de bureau, aperçu de test, Safari hors mode installé sur une ancienne version d'iOS, mode économie d'énergie.

L'appli redemande le maintien au toucher suivant et au retour au premier plan. Sur l'iPhone, en appli installée (iOS 18.4 ou plus), le message doit passer à « actif » après un toucher pendant la séance.

### Vérifications faites
- `node --check` sur tous les fichiers JS ; 42 tests node OK (dont `removeItemAt`, `translateCues`, `purgeFixedBugs`).
- Navigateur, port 8080, avec la sauvegarde importée : migration faite (3 consignes en français, 7 bugs retirés, 5 gardés, copies présentes), décor et glow de l'accueil présents, boutons flèche et Supprimer, calendrier, fiche d'un succès, ajout puis retrait d'un exercice dans une séance de test (abandonnée ensuite), aucune erreur console.

### Non vérifié
- Pas de captures pour ces points : le volet du navigateur était trop étroit. Les vérifications sont faites par le DOM.
- Pas testé sur iPhone, ni avec la synchro GitHub réelle.
- Le sélecteur d'ajout propose aussi les exercices déjà présents dans la séance (doublon possible, choix laissé à l'utilisateur).


## 10. Retours du 16/11 (suite) : repos, exercice phare, items rapides

### Fait
- **Écran de repos** : le bouton « Fin de séance » n'apparaît plus pendant le repos (il reste dans l'écran de séance). Chrono plus grand (jusqu'à 350 px, chiffres jusqu'à 112 px), bonhomme plus grand (jusqu'à 158 px). Un conseil court s'affiche sous le chrono (12 conseils, un par repos, il change au repos suivant).
- **Passer au suivant** : pendant le dernier repos d'un exercice (toutes ses séries validées, superset compris), un bouton « Passer à : <exercice suivant> → » arrête le chrono et ouvre directement l'exercice suivant.
- **Consigne en séance** : un bouton « ✎ Modifier la consigne » (ou « + Ajouter une consigne ») sous l'exercice, dans les 3 vues (simple, superset, unilatéral). La consigne est enregistrée sur l'exercice, donc aussi pour les séances suivantes.
- **Epley** : le mot n'apparaît plus dans l'appli (« 1RM estimé » seul ; l'explication de la page Progrès ne cite plus la formule).
- **Exercice phare** : comparaison avec le premier passage des 8 dernières semaines, sur la meilleure série de chaque séance : « +5 kg depuis le JJ/MM », « +2 reps », « Stable », ou « 1re séance, à suivre » s'il n'y a qu'une séance. La petite courbe n'est affichée qu'à partir de 2 séances.
- **Nom** : l'appli s'appelle YeahBuddy (titre, manifeste, nom sur l'écran d'accueil iPhone, Réglages, copie du carnet). Les identifiants internes ne changent pas (base de données, cache, format de sauvegarde `app: 'AppMuscu'`, dépôt), pour garder les données, l'import et la synchro compatibles. Sur l'iPhone, le nom sous l'icône ne change qu'après avoir supprimé puis réinstallé l'appli depuis Safari : faire une sauvegarde avant.
- **Carnet de bugs** : 4 entrées de plus dans `FIXED_BUGS` (chrono, passer au suivant, consigne en séance, renommage). Il ne reste que « mode vidéo ».

### Vérifications faites
- `node --check` sur tous les fichiers JS ; 44 tests node OK (ajout : `featured().since`, `restTip`).
- Navigateur, port 8080, format 430×932, par le DOM : titre « YeahBuddy », aucun « Epley » visible, carte phare « −1 rep depuis le 07/11 », pas de « Fin de séance » sur l'écran de repos, chrono 350 px, bonhomme 158 px, conseil affiché, bouton « Passer à » visible seulement après la dernière série et qui ouvre bien l'exercice suivant, modale de consigne ouverte puis annulée. Séance de test abandonnée ensuite. Aucune erreur console.

### Non vérifié
- Pas testé sur iPhone (taille réelle du chrono avec la barre Safari, nom sous l'icône après réinstallation).
- Pas de captures : vérification par le DOM.

## 11. Retours du 16/11 (fin de soirée) : comparatif, fin positive, haltères, côté vide

### Fait
- **Exercice phare** : sous « Meilleure série : W kg × R », la carte montre « Ancienne meilleure : W kg × R » (meilleure série des séances d'avant le record) puis « +X kg | +N reps depuis le JJ/MM ». Si le record date de la 1re séance : « Record posé le JJ/MM, à battre ». Une seule séance : « 1re séance, à suivre ». Remplace la comparaison au 1er passage de la section 10.
- **Fin de séance toujours positive** : plus d'écran « fin anticipée » ni de bonhomme qui tombe. Séance incomplète : « SÉANCE FAITE », « Tu es venu, tu l’as fait : c’est ça qui compte. », bonhomme qui saute. Aucune série validée : « Terminer la séance ? Rien ne sera enregistré. », puis bonhomme content « Tu es venu, c’est déjà ça ! ». Rien n'est enregistré dans ce cas (choix de Johan).
- **Bug « Voir mes succès »** : la séance était bien enregistrée dès la fin, mais le message de synchro disparaissait en changeant d'écran. Désormais un message s'affiche : « Séance enregistrée sur ce téléphone… » sans synchro, « Séance sauvegardée sur GitHub ✓ » ou « Envoi GitHub échoué : nouvel essai au prochain lancement. » avec synchro.
- **Citation** : déplacée dans la carte « Séance du jour », à droite du titre (en dessous sur écran de moins de 340 px). Masquée quand une séance est en cours ou proposée ailleurs, comme avant.
- **Haltères** : nouveau réglage par exercice « Aux haltères (poids d’un haltère) ». Le poids saisi est celui d'UN haltère, affiché « kg/haltère » dans les champs. Le volume compte 2 × poids × reps, partout (récap, courbes, bilan d'exercice, succès « Volume cumulé »). Exception : en mode unilatéral, chaque côté porte un seul haltère, donc facteur 1. Les records et « la dernière fois » restent au poids d'un haltère. Migration unique (kv `mig-pair`) : 6 exercices marqués (développés couché, incliné, épaules haltères, curl marteau, élévations latérales, concentration curls) et tout exercice dont le nom contient « haltère ». Un choix fait à la main n'est jamais modifié. Les poids déjà saisis ne changent pas (ils étaient déjà par haltère) ; le volume des anciennes séances de ces exercices double donc à l'affichage.
- **Unilatéral, côté vide** : un côté laissé à 0 × 0 (ou vide) est accepté. Il est marqué `skip`, affiché « non fait », et ne compte ni dans le volume, ni dans les records, ni dans l'équilibre. Il faut saisir au moins un côté. Annuler la série efface aussi ce marquage.

### Vérifications faites
- `node --check` sur tous les fichiers JS ; 47 tests node OK (ajouts : ancienne meilleure série et écart, côté vide exclu, volume haltères × 2 sauf unilatéral, migration haltères).
- Navigateur, port 8080, 430×932 : citation à droite du titre (capture) ; carrousel phare « Pendulum Squat, Ancienne meilleure : 50 kg × 8, +2,5 kg depuis le 07/11 » ; migration appliquée aux 6 exercices ; « kg/haltère » sur le développé incliné haltères ; fin sans série validée : bonhomme content, aucune séance ajoutée ; côté droit 0 × 0 validé, repos lancé, cellule « non fait » ; écran final incomplet « SÉANCE FAITE » (vérifié par le DOM). Séance de test abandonnée, toujours 4 séances. Aucune erreur console.
- Correction faite pendant le contrôle : la grille unilatérale affichait « 0 × 0 » pour un côté vide.

### Non vérifié
- Pas testé sur iPhone.
- Message après « Voir mes succès » : non déclenché dans le navigateur (il aurait fallu enregistrer une vraie séance).
- Carnet de bugs : aucune entrée ajoutée à `FIXED_BUGS` pour ces points (je n'ai pas d'horodatage d'entrée correspondante).

## 12. Retours du 16/11 (captures) : équilibre, côté sauté, carte musculaire, mise en page, bonhommes

### Fait
- **Équilibre droite / gauche** : si un côté est entièrement « non fait » dans la séance en cours, la carte affiche « – » et « Droite non faite aujourd'hui : pas de calcul d'équilibre. » (ou Gauche). Avant, le calcul retombait sur une ancienne séance où les deux côtés étaient faits, d'où 100 %.
- **Poids proposé côté sauté** : un côté sauté vide aussi la série suivante de ce côté (pas de charge proposée). À l'ouverture d'un exercice, un côté non fait à la dernière séance part vide au lieu de reprendre une séance plus ancienne. « La dernière fois » affiche « D non fait » dans ce cas. « + Série » ne recopie plus un côté sauté.
- **Carte musculaire de la semaine** : les 8 exercices perso avaient un champ « muscles » vide, donc rien ne se colorait. Migration unique (kv `mig-muscles`, `planMuscles` dans migrate.js) qui renseigne ce champ par nom (accents ignorés), seulement s'il est vide.
- **Citation** : largeur réservée de 40 % dans la carte Séance du jour, le titre prend le reste.
- **Titre long** (« Abdos machine allongé ») : le bouton « Remplacer » passe en dessous quand le titre ne tient pas, le titre reste sur une ligne.
- **Bonhommes** :
  - nouveau réglage `fit` par image dans `js/exart.js` (échelle, jamais d'agrandissement) pour que la tête du personnage ait à peu près la même taille partout. 12 images réduites (0,7 à 0,9) : plans serrés assis ou couchés (hip thrust, butterfly, curl concentré, leg extension, développés, abducteurs, rowing). Les personnages debout restent à 1 ;
  - écran unilatéral : la règle `.v-imgbtn img { height: auto }` écrasait le cadre, l'image prenait toute la largeur et touchait les bords. Cadre 4:3 ajouté (`.exv.art.uni-img`), règle limitée aux images directes ;
  - décalage -2 % à gauche (avec consigne) remplacé par +1 % : plus rien de coupé à gauche.
  - Planche avant/après : `sprites-avant-apres.png` dans le dossier de notes partagé de la session.

### Vérifications faites
- 48 tests node OK (ajout : `planMuscles`).
- Navigateur 375×812, port 8080, données réelles, séance test « Cote gauche » : côté droit vidé et validé, la série 2 droite part vide, carte « Droite non faite aujourd'hui » ; « La dernière fois : D non fait » ; cadre unilatéral 4:3 avec bonhomme à l'échelle ; titre abdos sur une ligne (hauteur = 1 ligne) ; migration appliquée aux 8 exercices ; la séance du 16/11 compte désormais pour 5 groupes (pectoraux 4, dorsaux 6, deltoïdes 4, biceps 6, triceps 11) ; citation 123 px sur 343. Séance test abandonnée, toujours 4 séances. Aucune erreur console.
- Piège rencontré : le service worker servait l'ancien code. Le désinscrire et vider le cache avant de tester.

### Non vérifié / à signaler
- Pas testé sur iPhone. Échelles `fit` réglées à l'œil sur la taille de tête : à valider par Johan sur la planche.
- `Side_Lateral_Raise.webp` n'est pas le bonhomme mascotte mais une animation anatomique grise : à remplacer (non traité).
