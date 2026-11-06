# STATE : AppMuscu

## Objectif
Appli de musculation perso pour l'iPhone de Johan (usage privé, pas de vente), sous forme de web app progressive (PWA) installée sur l'écran d'accueil via Safari.

## Décisions validées
- PWA hébergée gratuitement sur GitHub Pages, budget 0 €.
- Données stockées localement sur le téléphone (IndexedDB). Pas de serveur, pas de compte.
- Pas de Mac : pas d'appli native. Une VM macOS est exclue (licence Apple).
- Apple Watch et Apple Santé : reportées (nécessiteraient du Swift natif).
- Prérequis : iOS 18.4 minimum (Screen Wake Lock en mode installé, bug WebKit 254545 corrigé).

## Périmètre V1 (rien de plus)
Accueil avec séance du jour (Push / Pull / Legs + séances perso), création et modification des séances, une image par exercice (remplaçable), saisie poids + reps par série, timer de repos (réglable, wake lock, son), « la dernière fois », détection de record, bouton « Fin de séance » permanent, récap, courbes de progression + 1RM estimé (Epley), export / import JSON, `navigator.storage.persist()`.

Hors V1 : suggestion de progression, volume par muscle, calculateur de disques, échauffement, supersets, notes, Apple Watch.

## Architecture
- HTML + CSS + JavaScript natif (modules ES), **aucune dépendance**, aucun build.
- `index.html` : coquille. `js/app.js` : routeur par hash (`#/home`, `#/session`...) et écrans.
- `js/db.js` : petit wrapper IndexedDB (stores `exercises`, `workouts`, `sessions`, `kv`).
- `js/stats.js` : fonctions pures (Epley, volume, records, dernière fois). Testées avec `node --test`.
- `js/timer.js` : timer de repos basé sur une heure de fin (résiste à la mise en arrière-plan), son Web Audio programmé à l'avance, Screen Wake Lock redemandé au retour au premier plan.
- `js/charts.js` : courbes en SVG faites main.
- `js/backup.js` : export JSON (Web Share API, repli téléchargement), import.
- `sw.js` : service worker, cache de l'app pour le hors ligne. **Incrémenter `VERSION` à chaque mise en ligne.**
- Images : 24 exercices par défaut embarqués dans `img/ex/`. Catalogue complet (`data/catalog.json`, 876 exercices, noms anglais) : image téléchargée depuis GitHub au moment de l'ajout et stockée dans IndexedDB.
- Source images : `yuhonas/free-exercise-db`, licence **Unlicense** (vérifiée le 2026-11-06 dans `LICENSE.md` du dépôt et via l'API GitHub).

## Formules
- 1RM estimé (Epley) : `poids × (1 + reps / 30)`, et `poids` si reps = 1.
- Record : nouvelle charge max ou nouveau 1RM estimé, comparé à tout l'historique (le tout premier passage d'un exercice ne compte pas comme record).

## État réel (2026-11-06)
V1 codée et testée en local (navigateur intégré, 375×812). Pas encore en ligne ni testée sur iPhone.

Fichiers : `index.html`, `manifest.webmanifest`, `sw.js`, `css/app.css`, `js/{app,db,defaults,stats,timer,backup,charts}.js`, `data/catalog.json` (873 exercices), `img/ex/` (24 images), `img/icons/`, `tools/{make-icons,serve}.mjs`, `tests/stats.test.mjs`, `.claude/launch.json`, `TUTO-INSTALLATION.md`.

Lancer en local : `node tools/serve.mjs` (port 8080). Tests : `node --test tests/stats.test.mjs` (passer le dossier `tests/` échoue sous Node 24).
Astuce test : le service worker sert le cache ; pour voir une modif, désinscrire le SW et vider les caches, ou incrémenter `VERSION`.

## Tests effectués (navigateur intégré, mode mobile)
- 9 tests unitaires `stats.js` : OK. `node --check` sur tous les JS : OK.
- Séance complète : démarrage, saisie 80 × 8 et 22,5 × 10 (virgule), série suivante préremplie, timer lancé à la validation, ±15 s, fin du repos (bips Web Audio programmés), Réduire / mini barre, rechargement en cours de séance (séance et timer restaurés).
- Fin de séance anticipée depuis l'en-tête et depuis le timer plein écran ; séries non faites écartées ; récap (durée, volume 2145 kg exact, séries, records).
- 2e séance : « La dernière fois : 80 kg × 8 », record 85 × 8 détecté et célébré, 1RM Epley 107,7 kg exact, record listé au récap.
- Abandon à 0 série : séance non enregistrée.
- Rotation de la séance du jour (Pull après Push).
- Courbes (charge max, 1RM, volume) et historique.
- Édition de séance : nombre de séries, réordonner, retirer, ajout depuis le catalogue (image téléchargée et stockée).
- Remplacement d'image (redimensionnée 640 × 480) puis retour à l'image d'origine.
- Export (fichier JSON construit ; Web Share absent du navigateur de test, repli téléchargement non déclenché réellement), import via Réglages avec confirmation, fichier invalide refusé.
- Hors ligne : serveur coupé, l'appli se charge depuis le cache (39 fichiers).

## Non testé (à faire sur l'iPhone)
Wake lock (refusé dans le navigateur de test), son réel, vibration, feuille de partage iOS, import depuis Fichiers, `persist()`, encoches / zones sûres, clavier décimal, timer après sortie de l'appli. Liste détaillée dans le compte rendu de session.

## Problèmes ouverts
- Session audio iOS (`navigator.audioSession.type = 'transient'`) : hypothèse à confirmer avec le mode silencieux et la musique.

## Journal
- 2026-11-06 : dossier vide, licence vérifiée, architecture fixée.
- 2026-11-06 : V1 codée, testée en local en mode mobile, tuto d'installation écrit.
- 2026-11-06 : backlog V1.1 validé, DA Sunset Drive choisie, V1.1 codée et testée en local.

## Backlog V1.1 (feu vert reçu le 2026-11-06, codé, voir « V1.1 livrée »)
Principe directeur : rester simple, pas de nouveaux menus.

### Interface
1. Direction artistique : ambiance Miami / néon rose et bleu, coucher de soleil, typo années 80. Recherche web de références, puis 2 ou 3 pistes en maquette avant de coder. Pas de reprise du logo, des visuels ni de la typo de GTA (propriété de Rockstar).
2. Motion design léger : transitions, validation de série, timer, record. Ne jamais ralentir la saisie, respecter `prefers-reduced-motion`.
3. Navigation : 2 onglets, « Entraînement » (séance du jour + gestion des séances) et « Progrès ». Réglages via une roue crantée en haut à droite de l'écran Entraînement uniquement.
4. iOS 26 : barre du bas transparente type « Liquid Glass » (imitation par flou, `backdrop-filter`), vérifier zones sûres et barre d'accueil.

### Séance
5. Temps de repos par exercice (ex. 3 min squat, 1 min élévations), le repos par défaut servant de valeur initiale.
6. Suggestion de progression : « Aujourd'hui : 82,5 kg × 8 » si toutes les séries de la dernière fois ont été réussies (hypothèse : retenu, non contredit par Johan).
7. Remplacer un exercice en pleine séance sans modifier la séance type (hypothèse : retenu, non contredit).
8. Note libre par exercice : champ vide pour un commentaire, affiché avec « La dernière fois ».
9. Image dès la création d'un exercice perso.

### Données et suivi
10. Sauvegarde en fin de séance : bouton « Sauvegarder » sur le récap, un appui ouvre la feuille de partage iOS. Une sauvegarde 100 % automatique dans Fichiers / iCloud est impossible pour une web app (iOS exige un geste et un choix de destination). Validé par Johan.
11. Calendrier des jours entraînés, dans l'onglet Progrès.
12. Hors ligne : déjà en place (testé serveur coupé). À confirmer sur l'iPhone en mode avion.

### Écarté ou en réserve
- Écarté : calculateur de disques.
- En réserve : séries d'échauffement, poids du corps, volume par muscle, supersets, Apple Watch / Santé.

Réponse déjà donnée : ouvrir `index.html` en double-clic (`file://`) ne marche pas, c'est normal. Passer par `node tools/serve.mjs` puis http://localhost:8080, ou par l'adresse GitHub Pages.

## V1.1 livrée (2026-11-06)
- DA « Sunset Drive » (piste A, validée par Johan) : fond bleu nuit #1b1f3a, dégradé coucher de soleil jaune / orange / rose, cyan #2de2e6, polices système. Canevas des 3 pistes (privé) : https://claude.ai/artifact/Td3Z2E8Y6MBjFkRQFGLofE
- 2 onglets (Entraînement, Progrès) en barre flottante floutée ; réglages par la roue crantée de l'écran Entraînement. La gestion des séances est sur l'écran Entraînement (liste « Mes séances », « + Nouvelle séance », « Changer l'ordre »).
- Séance : repos par exercice (réglable en séance ou dans la fiche exercice, mémorisé sur l'exercice), suggestion « Aujourd'hui : … » avec bouton Appliquer, note par exercice, « ⇄ Remplacer » pour la séance en cours uniquement.
- Timer plein écran en anneau, « Ensuite : exercice, série x / n », état du maintien de l'écran, mini barre en dehors de l'écran de séance. Wake lock actif toute la séance (inchangé).
- Récap : bouton « Sauvegarder » (fichier préparé à l'avance, partage lancé dans le clic).
- Progrès : calendrier mensuel (lundi en premier, jours entraînés en rose, aujourd'hui entouré, navigation mois).
- Exercice perso : nom + image dès la création.
- Animations légères (entrée d'écran, validation de série), coupées si `prefers-reduced-motion`.
- `sw.js` : VERSION `appmuscu-v1.1.0`. Icônes régénérées.

Règle de suggestion (hypothèse, non contredite) : si toutes les séries prévues ont été faites la dernière fois à la charge max, +2,5 kg et reps = minimum de la dernière fois ; sinon refaire la meilleure série ; poids du corps : +1 rep.

Tests V1.1 (navigateur intégré, 375 × 812 puis bureau) : 11 tests unitaires OK, `node --check` OK ; démarrage, validation, timer anneau (1:30 puis 3:00 après réglage du repos de l'exercice), « Ensuite » correct, Réduire / mini barre, note conservée d'une séance à l'autre, remplacement avec et sans confirmation (séance type intacte), fin de séance depuis le timer, récap (volume 1280 kg exact), Sauvegarder (repli téléchargement, Web Share absent du navigateur de test), calendrier (1er novembre 2026 = dimanche, navigation mois), suggestion « = 80 kg × 8 » appliquée, création d'un exercice perso avec image, liens retour, hors ligne : 39 fichiers en cache v1.1.0. Aucune erreur console.
Non testé : tout ce qui demande l'iPhone (feuille de partage, wake lock réel, flou de la barre sous iOS, zones sûres).

## Backlog V1.2 (demandé le 2026-11-06, NE PAS coder avant le feu vert de Johan)

Retour Johan du 2026-11-06 : OK points 1, 2, 3 (bouton « Exercice 2/6 ▾ »), 6, 8. Point 7 : il souhaite un GIF de Ronnie Coleman (« Yeah buddy »). Point 9 : idée gardée pour plus tard. Johan teste pour l'instant sur PC uniquement (MVP) ; proposer la mise sur iPhone et GitHub une fois le MVP fini. Il a demandé des recherches pour d'autres propositions avant de coder.

### Séance
1. Note par série (petit champ par ligne de série) à la place de la note par exercice.
2. « Consigne » par exercice à la place de la note : conseils d'exécution de référence (tempo, contraction, amplitude, erreurs à éviter). Référence citée par Johan : Essan NFC (coach bodybuilding, Instagram), plus des consignes simples type « coudes dans les poches » aux tractions. Instructions anglaises du catalogue à traduire en français, sources primaires citées, consigne modifiable.
3. Réglage du repos de l'exercice remonté en haut de la carte exercice.
4. Bug : liste des exercices en haut de séance impossible à faire défiler au-delà des 3-4 premiers. Cause probable : défilement horizontal sans barre visible, inutilisable à la souris (Johan teste sur PC : cause cohérente). Solution validée : bouton « Exercice 2/6 ▾ » ouvrant la liste.
5. Bug timer : après « Fin de séance » puis retour, affichage 0 puis 6 min en clignotant. Cause non identifiée, reproduction à faire.
6. Choix du repos à la seconde près (ex. 2:08, 1:15) avec roues minutes / secondes, partout où un repos se règle.
7. Fenêtre de motivation à « Exercice suivant » : biceps contracté animé, message d'encouragement varié, bilan de l'exercice terminé. Création originale (pas de mascotte d'une autre appli).

10. Série d'échauffement : une seule par exercice avec charge, libellée « Échauffement » en toutes lettres, hors records et hors volume, ajoutée automatiquement, supprimable. Peu de reps refusé par Johan (but : chauffer muscle et tendon). Proposition : 60 % × 12 par défaut (ex. 100 kg × 8 → 60 kg × 12), pourcentage et reps réglables dans les réglages. À confirmer.
11. Ressenti par série (RPE) noté sur 10, strictement optionnel (jamais bloquant).
12. Supersets : enchaîner 2 exercices (ou plus) sans repos, passage automatique à l'exercice suivant du superset. Les books NFC en utilisent (« suivi sans pause »).
13. (Proposé le 2026-11-06 : remplacé par la mascotte, bouton « Ajouter mes GIF » abandonné sauf avis contraire de Johan ; flammes conservées pour streak et records.) Motivation : Johan dépose ses GIF dans `bank/`. Comme `bank/` n'est pas publié, l'appli les charge via un bouton « Ajouter mes GIF » (sélection multiple), stockage IndexedDB. Animation de flammes originale (CSS/SVG) : série de semaines d'entraînement (streak) et records. GIF au choix de Johan. Le site GitHub Pages et son dépôt gratuits sont publics : aucun GIF de tiers dans le code. Proposition : import de ses GIF dans l'appli (stockés sur l'appareil, jamais publiés), repli biceps 💪 animé original.

14. Mascotte « mini-Johan » (validée le 2026-11-06) : pixel art 16 bits, ambiance Muscle Beach. Sprites générés par Johan (ChatGPT / Gemini) dans `bank/mascotte/`, détourés par `maquettes/sprites.py` (clé verte, recadrage, planches webp) ; décor, feux d'artifice et confettis en code. Sprites retenus publiés avec l'appli (`img/mascotte/`). Maquette fin de Push : `maquettes/mascotte-v2.html` (testée navigateur intégré). Prompts restants : `bank/mascotte/PROMPTS.md`.
   Sprites disponibles (2026-11-06) et usage proposé :
   - `01-double-biceps.png` (baskets) : pose finale de chaque séance.
   - `08-victoire.png` : popup record (en attendant `15-record.gif`). `09-pouce.png` : sauvegarde OK.
   - `Animation de développé couché…gif` : fin Push. `11-pull-traction.gif` : fin Pull. `12-legs-squat.gif` : fin Legs. `Animation … saut victorieux.gif` : transition vers la pose finale.
   - `14-repos.gif` : timer de repos. `Fin du repos.gif` : fin du repos (« C'est reparti »).
   - `Échauffement énergique.gif` : série d'échauffement.
   - `flex chest.gif` : attente du compagnon (idle).
   - `Retour après plusieurs jours sans séance.gif` (transat) : écran d'accueil.
   - `Chute progressive d'un athlète épuisé.gif` : séance abandonnée / fin anticipée (humour).
   - `Animation pixel-art d'un sportif épuisé.gif` (mains sur les genoux, souffle) : repos après une série notée 9 ou 10 en ressenti, ou dernière série d'un exercice ; variante d'attente du compagnon en fin de séance.
   - `neutre haussement d'épaules.gif` : écrans vides (aucune séance, aucun record, aucune donnée), annulation d'une action, réaction du compagnon à un appui (en alternance avec le pouce).
   - `20-decor-muscle-beach.png` : décor.
   Manquent (proposés) : marche de profil (compagnon), sortie du transat, record avec flammes, motivation, sieste, décor portrait plein écran.
   La maquette `mascotte-v2.html` (canvas 480 × 640) sera refaite au format 430 × 932 avant l'intégration.
15. Écran d'accueil (demandé le 2026-11-06) : à l'ouverture, décor Muscle Beach, mini-Johan sur son transat (GIF transat), bouton « Entrer » ; au clic, il se lève (GIF à générer) puis l'appli s'ouvre. Proposition : un appui n'importe où suffit ; si une séance est en cours, ouverture directe de la séance (pas d'écran d'accueil) ; animation coupée si `prefers-reduced-motion`.
16. Compagnon permanent (demandé le 2026-11-06) : mini-Johan visible pendant toute l'utilisation, animé, qui se déplace à gauche et à droite. Proposition : petit (environ 64 px de haut), posé juste au-dessus de la barre d'onglets, il marche, s'arrête, fait son idle (flex chest), repart dans l'autre sens ; il réagit au contexte (repos : gourde ; fin de repos : se relève ; record : victoire) ; un appui sur lui déclenche une réaction (pouce) ; jamais devant un champ de saisie ; pause quand l'appli est en arrière-plan ; réglage « Mascotte : animée / fixe / masquée ».

Écarté par Johan : vibration. Son de fin de repos : sans intérêt pour lui (laissé tel quel).

### Source « bank/ » (ajoutée par Johan le 2026-11-06)
- `bank/` contient 2 books PDF d'Essan NFC (« NFC PRO MASSE 2 », « NFC PRO IMMERSION ») : programmes (séances, séries × reps en pyramide 12-10-8-6, repos 1 min 30 à 2 min, supersets, techniques d'intensification), diètes, compléments. Peu de consignes techniques écrites : la technique est dans des vidéos liées.
- Mention « Tous droits réservés », livre destiné à un seul acheteur. Usage : référence privée uniquement, consignes rédigées avec mes mots, aucun texte recopié.
- **Ne jamais publier `bank/`** (à exclure du dépôt GitHub et du cache du service worker).

#### Cible écran : iPhone 14 Pro Max (fixée le 2026-11-06, pour tous les éléments)
Valeurs de référence Apple, à revérifier sur l'appareil.
- Zone CSS 430 × 932 points, densité 3 (1290 × 2796 pixels). Dynamic Island en haut : zones sûres via `env(safe-area-inset-*)`, environ 59 points en haut et 34 en bas en portrait.
- Tests navigateur désormais en 430 × 932 (et non plus 375 × 812).
- Netteté : une image doit faire au moins 3 fois sa taille affichée en points. Les sprites pixel art sont affichés en `image-rendering: pixelated` si agrandis.
- Tailles d'affichage proposées :
  - Écran d'accueil : décor plein écran (couvrant, centré) ; mini-Johan sur le transat environ 220 points de haut, centré dans le tiers bas, au-dessus de la zone sûre basse.
  - Compagnon : 64 points de haut, posé au-dessus de la barre d'onglets (barre environ 64 points + zone sûre 34).
  - Popups (record, fin de séance, motivation) : sprite 150 à 180 points de haut, carte large de 430 − 2 × 16 points de marge.
  - Pose finale `01` : jusqu'à 330 points de haut (source 1024 pixels, nette).
- Limites constatées : les GIF font environ 508 pixels, personnage d'environ 400 à 450 pixels de haut, donc net jusqu'à environ 150 points ; au-delà, léger agrandissement. Le décor (765 × 1024) est trop petit et trop large pour l'écran (ratio 0,75 contre 0,46) : en plein écran, environ 40 % de sa largeur est coupée et il est agrandi environ 2,7 fois. Nouveau décor portrait proposé dans `PROMPTS.md`.
- Tailles tactiles : boutons d'au moins 44 × 44 points.

## Écran
8. Écran jamais en veille tant que l'appli est ouverte (pas seulement en séance). Retirer le badge « Écran : veille possible » ; n'afficher qu'un avertissement en cas d'échec. Repli : réglage iPhone Verrouillage automatique > Jamais.

### Sauvegarde
9. Sauvegarde automatique sur GitHub : envoi du fichier JSON dans un dépôt privé via l'API GitHub, à chaque fin de séance si réseau, sinon au prochain lancement. Prérequis : compte GitHub et jeton d'accès limité créés par Johan lui-même. Reportée par Johan (après le MVP).

## V1.2 partie séance livrée (2026-11-06)
- Écran séance : bouton « Exercice i/n ▾ » (liste des exercices et séries faites) à la place des puces, flèches ‹ ›. Ordre de la carte : image, titre, Remplacer, repos (minutes + secondes), dernière fois, suggestion, record, consigne repliable, séries.
- Sous chaque série : note et ressenti (6 à 10 sur 10), modifiables après validation. Affichés au récap et dans l'historique Progrès (« 60×8 @8 », « S1 : … »).
- Échauffement : série « Éch. » ajoutée en tête si une charge est connue (60 % arrondi à 2,5 kg en dessous, 15 reps, réglable dans Réglages, clé `kv 'warm'`). Hors volume, records, dernière fois et courbes. Boutons Retirer / + Échauffement.
- Superset : bouton « Lier au suivant » dans l'édition de séance (`it.ss`). En séance : étiquettes A1/A2, pas de repos entre les membres, repos après le dernier puis retour au premier membre qui a encore des séries.
- Repos réglable à la seconde (séance, fiche exercice, réglage par défaut).
- Consigne par exercice : textes par défaut (`js/cues.js`, rédaction maison), modifiable, « Remettre la consigne d'origine ». L'ancienne note est migrée dans la consigne (« Ma note : … »). Exercice ajouté depuis le catalogue : instructions anglaises de free-exercise-db récupérées (« (EN, à reformuler) »), URL vérifiée (HTTP 200, CORS ouvert).
- Écran : maintien demandé dès le lancement et jamais relâché ; badge et texte du timer seulement en cas d'échec.
- Bug chrono « 0 puis 6 min » : `clearInterval(clock)` au début de `viewSession`.
- `sw.js` : VERSION `appmuscu-v1.2.1`, `js/cues.js` ajouté au cache.

Tests V1.2 (navigateur intégré, 430 × 932) : `node --check` OK sur tous les JS, 14 tests unitaires OK. Superset activé dans Push ; « + Échauffement » sans charge refusé avec message ; 60 kg → échauffement 35 × 12 ; repos 1:05 réglé puis timer à 1:05 ; validation de l'échauffement sans record ni préremplissage ; série 2 préremplie 60 × 8 ; note et ressenti enregistrés ; superset : passage automatique à l'exercice A2 sans timer, puis repos 1:30 et retour sur A1 ; récap : volume 850 kg (échauffement exclu, exact), 3 séries, « éch. 35×12 · 60×8 @8 », « S1 : Bonne barre » ; chrono stable (0:01 à 0:04) après 10 nouveaux affichages et une 2e séance ; 2e Push : échauffement auto 35 × 12, séries préremplies 60 × 8, « La dernière fois » sans l'échauffement ; consigne modifiée puis remise d'origine ; réglage d'échauffement enregistré. Aucune erreur console.
Non testé : ajout depuis le catalogue avec consigne dans l'appli (seule l'URL a été testée), migration d'une ancienne note, maintien d'écran réel, tout ce qui demande l'iPhone. Données de test laissées dans le navigateur de test (superset Push, une séance).
Questions ouvertes : abandon du bouton « Ajouter mes GIF » ; échauffement : 15 reps par défaut (validé par Johan, 12 à 15 conseillées), charge 60 % gardée par hypothèse.

## V1.3 mascotte livrée (2026-11-06)
- `js/mascot.js` (nouveau) : sprites (`sprite()`), flamme pixel SVG, popups mascotte, fenêtre de motivation, écran d'ouverture, animation de fin de séance (canvas feux d'artifice), compagnon.
- Écran d'ouverture : décor, mini-Johan sur le transat, bulle (« Prêt pour Pull ? », « N jours sans séance… »), bouton « Entrer » puis sortie du transat. Pas affiché si une séance est en cours. Réglage on/off (`kv 'splash'`).
- Compagnon (64 points) au-dessus des onglets : marche, flex à l'arrêt, transat après 90 s d'inactivité, réaction et bulle à l'appui, caché pendant la saisie, le timer plein écran et en arrière-plan. Réglage « Se balade / Immobile / Masqué » (`kv 'mascot'`). Immobile si « Réduire les animations ».
- Timer : sprite repos, échauffement après une série d'échauffement, épuisé si ressenti ≥ 9 ou dernière série, fin de repos.
- Motivation à « Exercice suivant → » (bilan : séries, volume, meilleure série, exercice suivant). Record : popup mascotte enflammée et confettis. Séance abandonnée : chute. Sauvegarde OK : pouce.
- Fin de séance : couché / traction / squat selon le nom (Push, Pull, Legs, sinon générique), saut, pose biceps, feux d'artifice ; fin anticipée : chute et « Je me relève ».
- Accueil : carte série de semaines avec flamme (`weekStreak` dans `stats.js`) ; états vides avec haussement d'épaules ; flammes sur les records du récap.
- `.gitignore` créé (`bank/`, `maquettes/`). `sw.js` : `appmuscu-v1.3.0`, mascot.js, sprites.js et 20 webp en cache. APP_VERSION 1.3.0.

Tests V1.3 (navigateur intégré, 430 × 932) : 15 tests unitaires OK ; écran d'ouverture et sortie ; série de semaines ; compagnon (marche, modes Immobile et Masqué, appui avec bulle, caché à la saisie) ; sprites du timer et fin de repos ; motivation fermée seule ; record ; fin complète Push (couché, « PUSH PLIÉ ! », biceps, canvas) ; fin anticipée (chute) ; écran Progrès ; aucune erreur console. Captures peu fiables (panneau masqué) : contrôle surtout par l'état du DOM.
Non testé : popup « Sauvegarde OK » (partage absent du navigateur de test), rendu visuel fin des popups, tout sur iPhone (fluidité, zones sûres). Données de test laissées dans le navigateur de test (Pull incomplet, Push à 200 kg).
Manques connus : sieste (transat utilisé), décor portrait (décor paysage recadré), animation propre aux séances perso.

## V1.4 retours Johan livrés (2026-11-06)
- Compagnon mini-Johan qui se balade : supprimé (jugé gadget). Réglage « Mascotte » réduit à « Écran d'ouverture ».
- Badge et texte « Écran : veille possible » : supprimés (en-tête de séance et timer).
- Écran d'ouverture à chaque lancement, y compris séance en cours (bulle « On reprend <séance> ? »).
- Fin de repos : écran plein « Repos terminé » + grand personnage + bouton « C'est parti ! », reste jusqu'à l'appui, sur tous les écrans. S'affiche aussi si le repos s'est terminé appli fermée (moins de 30 min).
- Ressenti : 4 boutons Facile / Correct / Dur / À bloc (champ `feel` 1-4), sous la série faite et dans le timer. Ancien `rpe` toujours lu dans l'historique.
- Fin anticipée : content (saut + pose) si les séries de travail des 2 premiers exercices sont toutes faites, sinon chute.
- Superset : vue côte à côte (images, puis une ligne par tour avec kg/reps de chaque exercice), un seul ✓ par tour, repos après le tour. Corrige le bug du timer lancé après le 1er exercice.
- Images d'exercices perso : liste et modèle de prompt dans `bank/mascotte/PROMPTS-EXERCICES.md` (privé). Mécanisme dans l'appli à coder quand les images existent.
- VERSION sw `appmuscu-v1.4.0`, APP_VERSION 1.4.0.
- Testé (navigateur intégré, 430×932) : node --check OK, 15 tests OK, écran d'ouverture en séance, ressenti série + timer, écran « C'est parti » après reprise, superset (saisie sans timer, validation du tour, repos unique, ressenti du tour), 3 variantes de fin de séance (appel direct), aucune erreur console.
- Non testé : calcul `core` de bout en bout via « Fin de séance », superset à 3 exercices, iPhone réel.
- Hypothèses : pas de suggestion de progression ni de ligne record dans la vue superset ; le tour d'échauffement valide les échauffements de tous les exercices puis lance le repos.

## V1.5 accueil plus vivant (2026-11-06)
- Écran d'ouverture : titre « YeahBuddy » (écran d'ouverture seulement, l'appli reste AppMuscu), phrase par défaut « Prêt pour une nouvelle séance ? » (aussi en séance en cours).
- Carte du jour : décor plage (`img/mascotte/decor.webp`, cadrage `center 71%`, 190 px) avec le sprite de la séance (couche / traction / squat / flex), couleur par type (`sessionKind` exporté de `mascot.js`).
- Bilan de la semaine dans la carte série : séances, kg soulevés, records (semaine en cours).
- Liste « Mes séances » : vignette animée colorée par type, nom en couleur.
- VERSION sw `appmuscu-v1.5.0`, APP_VERSION 1.5.0.
- Testé (navigateur intégré, 430×932) : node --check OK, 15 tests OK, rendu de l'accueil (soleil visible, perso sur le sable, bilan 4 séances / 40 850 kg / 3 records, vignettes Push / Pull / Legs).
- Non testé : variante « Séance en cours » de la carte, iPhone réel.

## V1.6 images d'exercices mini-Johan (2026-11-06)
- Pipeline : image générée par Johan (fond vert #00FF00) dans `bank/mascotte/`, détourée en WebP transparent 512 px dans `img/mascotte/ex/<id>.webp` (script Python PIL, seuil vert puis retrait du reflet vert sur les bords).
- `js/exart.js` : `EX_ART` (une ligne par image : zones de lueur [x %, y %, rayon %]), `glowLayer` (lueur rouge masquée par la silhouette, `mix-blend-mode: color`, pulsation coupée si « Réduire les animations »), `muscleMap` (schéma face + dos, zones en rouge d'après le champ `muscles`, français et anglais du catalogue).
- Image mini-Johan utilisée seulement si l'image n'a pas été remplacée par l'utilisateur. Vignettes : image mini-Johan sans lueur.
- Schéma du corps affiché sur toutes les grandes images (séance, superset, zoom, fiche exercice), photos comprises.
- 1re image : Incline_Dumbbell_Press (pecs). Ajouter chaque nouvelle image au `FILES` de `sw.js`.
- VERSION sw `appmuscu-v1.6.0`, APP_VERSION 1.6.0.
- Testé (navigateur intégré, 430×932) : fiche exercice et séance Push (lueur sur les pecs, schéma pecs), photo classique + schéma, correspondance des noms de muscles (node), 15 tests OK, aucune erreur console.
- Non testé : vue superset avec l'image, zoom, iPhone réel.
- Point d'attention : la 1re image montre un logo de marque sur les baskets ; à éviter dans les prochains prompts si l'appli est publique sur GitHub Pages.

## V1.7 décor, néons animés, animations du coin (2026-11-06)
- Fond des images mini-Johan : `img/mascotte/ex-decor.webp` (salle néon). Calque `img/mascotte/ex-neon.webp` (néons seuls, extraits par `scratchpad/neon.py`) animé en CSS : pulsation 3,2 s + scintillement bref toutes les 7 s, coupé si `prefers-reduced-motion`.
- Coin bas droit : si l'exercice a `ex.anim` (data URL), tuile blanche 104 px (58 px en superset) à la place du schéma des muscles. Sinon, schéma.
- Import des animations : page exercice (« Ajouter une animation », 2 Mo max, fichier gardé tel quel) ou Réglages > « Animations d'exercices » (plusieurs fichiers, associés par nom : `developpe-incline-halteres.webp` → « Développé incliné haltères », accents et casse ignorés).
- Droits : les GIF anatomiques trouvés par Johan sont probablement protégés. Ils restent dans `bank/` (privé) et ne vont que dans l'IndexedDB du téléphone, jamais dans `img/` ni sur GitHub Pages.
- « Repos pour cet exercice » / « Repos après chaque tour » : boîte dégradé violet → rose, bord rose, libellé blanc gras avec ⏱.
- Testé (navigateur intégré 430×932) : page exercice avec décor, néons animés (2 animations en cours), animation importée affichée 104 px, boîte de repos en page exercice et en séance. 15 tests OK, `node --check` OK, aucune erreur console.
- Non testé : import réel par le sélecteur de fichiers (anim injectée en JS dans le test), import multiple depuis Réglages, superset et zoom avec animation, iPhone.
- Note : le fichier fourni s'appelle `developpe-couche-convergent-a-la-machine.webp` ; aucun exercice de ce nom dans la base, il sera signalé « sans correspondance » à l'import.

## V1.8 échelle du décor, animation embarquée, boutons (2026-11-06)
- Droits : Johan indique que tous les visuels et GIF fournis sont libres de droits (déclaration de Johan, source non vérifiée par Claude). Ils peuvent donc être publiés. `bank/` reste exclu par `.gitignore` (sources brutes) ; les fichiers prêts vont dans `img/`.
- Animations embarquées : `python tools/anim-prep.py <source> <Id_Exercice>` retire le fond blanc relié au bord, recadre et sort `img/mascotte/anim/<Id>.webp` (360 px, durées d'origine). Puis ajouter `anim: true` dans `EX_ART` (`js/exart.js`) et le fichier dans `FILES` de `sw.js`. Une animation importée sur le téléphone reste prioritaire (fond blanc fondu dans le violet par `mix-blend-mode: multiply`).
- Coin : tuile violette 104 px. Toucher l'animation n'agrandit qu'elle (modale), toucher le reste de l'image agrandit l'image entière comme avant.
- Échelle : salle zoomée (128 %, ancrée à 72 % en hauteur), personnage à 76 % de la hauteur, pieds au sol au premier plan, vignettage léger. Les tubes du plafond sont recadrés, la barre néon horizontale reste visible et animée.
- Bouton « Exercice suivant » : dégradé violet → rose, texte blanc.
- Testé (navigateur intégré 430×932) : page exercice, séance Push sur le développé incliné, zoom de l'animation seule, bouton suivant. 15 tests OK, `node --check` OK, aucune erreur console. Non testé : superset avec animation, iPhone.

## V1.9 Progrès en onglets, suppression, Corps, ressenti replié (2026-11-06)
- Progrès : 3 onglets (`state.ui.ptab`). Séances : calendrier, une carte par type de séance (courbe de volume, badge % de la dernière séance contre la précédente du même type, groupé par `workoutId`), historique cliquable vers le récap. Exercices : liste existante. Corps : saisie poids (kg) et masse grasse (%, facultative), stockées dans kv `body` = `[{t, w, bf}]` (donc incluses dans la sauvegarde), 2 courbes, liste avec suppression.
- Récap : ✕ par exercice (si c'est le dernier, la séance entière est supprimée). Après suppression, retour à Progrès. Les drapeaux de record déjà stockés dans les autres séances ne sont pas recalculés (les courbes, elles, se mettent à jour).
- Ressenti et note : ligne repliée sous chaque série (« Série correcte · note ») ou tour de superset (« Tour correct »), crayon ✎ à droite ; le crayon ouvre ressenti + note + « Valider » (`state.ui.editSub`, helper `subLine`).
- Minuteur : −15 s / +15 s masqués par défaut, réglage « Minuteur » dans Réglages (kv `timerAdj`).
- Accueil Pull : mini-Johan placé sur le portique de traction du décor (`.scene.k-traction`).
- Courbes : axe avec une décimale si l'écart est inférieur à 10 (poids, masse grasse).
- Testé (navigateur intégré 430×932) : 3 onglets, badge % (y compris séance précédente à 0 kg), ajout de 3 mesures et suppression, retrait d'exercice persistant après rechargement, suppression de séance, crayon + Valider en série et en superset (note tapée puis Valider directement), minuteur sans puis avec ±15 s, position Pull. 15 tests OK, `node --check` OK, aucune erreur console. Non testé : iPhone.

## Prochaine étape
Johan : voir le MVP en local (http://localhost:8080), puis mise en ligne GitHub Pages et test sur l'iPhone.

## V2.0 (2026-11-06) : personnages animés, décor 2, consigne néon
- Coin animé supprimé (animation du coin, import dans Réglages et sur la page exercice, `img/mascotte/anim/`). Une animation importée auparavant reste dans la base mais n'est plus affichée.
- Personnages animés (GIF fond vert de Johan, `bank/mascotte/exercices/`) convertis par `tools/gif-prep.py` en WebP animé 512 px transparent dans `img/mascotte/ex/<Id>.webp` : Incline_Dumbbell_Press, Leverage_Chest_Press (convergent), Barbell_Hip_Thrust, Butterfly (pec deck). Les deux derniers et le convergent sont des exercices du catalogue : l'image s'affiche une fois l'exercice ajouté à une séance.
- Décor par exercice dans `EX_ART` (`js/exart.js`) : `decor: 1` salle à machines (machines, poulies, Smith), `decor: 2` salle à baie vitrée (poids libres, poids du corps). Décor 2 et son calque néon préparés par `tools/decor2-prep.py` (`ex-decor2.webp`, `ex-neon2.webp`), même animation néon que le décor 1.
- Consigne : dans la grande image de séance et la page exercice, colonne de droite en orange néon (#ffab40, 10 lignes max) ; texte complet dans l'agrandissement. Exercices sans personnage : bloc orange sous l'image. Superset : liste repliable, texte en orange. Modification toujours sur la page exercice.
- Ajouter un exercice : `python tools/gif-prep.py "<gif>" <Id>`, une ligne dans `EX_ART` avec le décor, le fichier dans `FILES` de `sw.js`, incrémenter `VERSION`.
- Testé (navigateur intégré 430×932) : décor 1 et 2, néons animés (neonpulse/neonflick), consigne affichée et non tronquée (Incline), schéma des muscles si pas de consigne, agrandissement, Réglages sans l'import, aucune erreur console. 15 tests unitaires OK, `node --check` OK. Non testé sur iPhone. Poids des WebP : 257 à 461 Ko chacun.

## V2.1 (2026-11-06) : corrections, suppression, carnet de bugs
- Consigne : panneau qui s'adapte au texte (haut droite, 46 % de large, hauteur max = image), texte 13 px, 9 lignes max, sans flou d'arrière-plan.
- Exercices : bouton « Supprimer cet exercice » (page exercice) : retiré des séances types, historique gardé ou supprimé au choix ; refusé si l'exercice est dans la séance en cours. Alerte si on crée un exercice perso au nom déjà existant.
- Historique : bouton « Supprimer l'historique de cet exercice » (Progrès > exercice). Une séance qui ne contenait que cet exercice est supprimée.
- Hip thrust rose : c'est un doublon perso (`custom_mw4p72vxacnec`, image JPEG rose, 1 séance test 200 kg × 8). Le bon est `Barbell_Hip_Thrust` (personnage animé). À supprimer par Johan sur le téléphone, avec l'historique.
- Accueil : « · Cliquer pour modifier » ; mini-Johan Pull recalé sur la barre du portique (mains sur la barre, supports muraux masqués).
- Réglages : « Carnet de bugs » (kv `bugs` = `[{t, text}]`, inclus dans l'export), ajout, retrait avec confirmation, copie dans le presse-papiers.
- Fiabilité : adresse inconnue → accueil ; redirections sans entrée d'historique ; retour en haut à chaque écran ; séance écrite quand l'appli passe en arrière-plan ; double appui sur ✓ ignoré ; échauffement exclu du décompte de fin ; superset orphelin corrigé ; IndexedDB rouverte si iOS ferme la connexion ; import atomique et contrôle des identifiants ; son relancé après interruption iOS ; précache SW sans cache HTTP ; pas de zoom au double appui ; champs des notes à 16 px (pas de zoom iOS) ; en-tête de séance sous l'encoche.
- Non appliqué (revue) : cibles tactiles < 44 px, filtres animés (flash, flamme, drop-shadow, néons), neonflick qui écrase neonpulse, recalcul des stats, modale et clavier.
- Testé (navigateur intégré 430×932) : consigne Incline (189 px dans une image de 244 px, texte entier), carnet ajout / retrait / bouton copie, modale de suppression (3 choix, annulée), modale de purge (annulée), adresse inconnue, redirection sans séance, position Pull, aucune erreur console. 15 tests OK, `node --check` OK. Non testé : suppression réellement exécutée, copie presse-papiers, iPhone.

## Mise en ligne (2026-11-06)
- Dépôt public https://github.com/JohanOw/appmuscu (branche `main`), auteur `JohanOw` avec adresse noreply. Exclus : `bank/`, `maquettes/`, `.claude/`.
- GitHub Pages actif : https://johanow.github.io/appmuscu/ (v2.1.0). Vérifié : page, sw.js, JS, catalogue et WebP en 200 ; l'appli démarre en ligne, service worker actif, aucune erreur console (navigateur intégré).
- Le 1er déploiement est resté en file d'attente jusqu'au délai max (échec côté GitHub) ; relancé par un commit vide, OK en 2 min.
- Publier : incrémenter `VERSION` dans `sw.js` (et `APP_VERSION`), puis `git add -A`, `git commit`, `git push`.
- Prochaine étape : installation et tests sur l'iPhone, retours via le carnet de bugs.
