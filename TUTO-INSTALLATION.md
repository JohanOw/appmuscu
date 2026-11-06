# Installer AppMuscu sur l'iPhone

Durée : environ 20 minutes la première fois. Coût : 0 €.

Principe : le code de l'appli est publié gratuitement sur GitHub Pages (un site web). Safari l'installe ensuite sur l'écran d'accueil. Tes données (séances, records) restent **uniquement sur le téléphone**. Rien n'est envoyé sur GitHub.

---

## 0. Prérequis : vérifier la version d'iOS

`[iPhone]` Réglages > Général > Informations > **Version d'iOS**.

- Il faut **iOS 18.4 ou plus récent**. Avant, l'écran peut se mettre en veille pendant le repos en mode installé.
- Si la version est plus ancienne : Réglages > Général > Mise à jour logicielle.

---

## 1. Créer un compte GitHub (à faire toi-même)

`[PC]` Va sur https://github.com/signup et crée un compte gratuit.

- Le nom d'utilisateur choisi apparaîtra dans l'adresse de l'appli : `https://<nom-utilisateur>.github.io/appmuscu/`.
- Active la double authentification proposée par GitHub.

---

## 2. Créer le dépôt

`[PC]` Une fois connecté :

1. Clique sur **+** en haut à droite, puis **New repository**.
2. **Repository name** : `appmuscu` (en minuscules, c'est la fin de l'adresse).
3. Coche **Public**. GitHub Pages est gratuit uniquement pour les dépôts publics. Seul le code est public, pas tes données.
4. Ne coche rien d'autre. Clique **Create repository**.

---

## 3. Envoyer les fichiers

Fait avec Git depuis le dossier `C:\Users\Johan\Desktop\Claude\AppMuscu` (dépôt `https://github.com/JohanOw/appmuscu`).

- Auteur des envois : `JohanOw`, adresse privée `127040355+JohanOw@users.noreply.github.com` (le Gmail n'apparaît pas publiquement).
- Exclus par `.gitignore` : `bank/`, `maquettes/`, `.claude/`.
- Au premier envoi, une fenêtre GitHub s'ouvre sur le PC : **Sign in with your browser**, connexion faite par Johan. Windows garde ensuite la connexion.

Contrôle : à la racine du dépôt sur GitHub, tu dois voir `index.html` directement, pas un dossier `AppMuscu` qui le contient.

---

## 4. Activer GitHub Pages

`[PC]` Dans le dépôt :

1. **Settings** > **Pages** (menu de gauche).
2. **Source** : `Deploy from a branch`.
3. **Branch** : `main`, dossier `/ (root)`, puis **Save**.
4. Attends 1 à 2 minutes, puis recharge la page. L'adresse apparaît en haut : `https://<nom-utilisateur>.github.io/appmuscu/`.

Contrôle : ouvre cette adresse sur le PC. L'écran d'accueil « AppMuscu » doit s'afficher.

---

## 5. Installer sur l'iPhone

`[iPhone]`

1. Ouvre l'adresse dans **Safari** (pas Chrome ni une autre appli : seule l'installation via Safari est prise en charge ici).
2. Touche le bouton **Partager** (carré avec une flèche vers le haut).
3. Fais défiler et choisis **Sur l'écran d'accueil**. Si l'option n'apparaît pas tout de suite, cherche-la sous « Plus » ou « Modifier les actions ».
4. Laisse l'option « Ouvrir comme app web » activée si elle est proposée, puis **Ajouter**.
5. Lance AppMuscu **depuis l'icône** de l'écran d'accueil. C'est ce mode « installé » qui garde l'écran allumé pendant le repos et protège mieux les données.

Ouvre l'appli une fois avec du réseau : elle se met alors en cache et marche ensuite sans connexion à la salle.

---

## 6. Faire une première sauvegarde

Les données sont dans l'appli, sur le téléphone. Si tu supprimes l'icône ou changes de téléphone, elles sont perdues sans sauvegarde.

`[iPhone]` Dans AppMuscu :

1. Le plus simple : à la fin de chaque séance, sur l'écran **Récap**, appuie sur **Sauvegarder**. Sinon : roue crantée en haut à droite de l'écran Entraînement > **Exporter**.
2. Dans la feuille de partage, choisis **Enregistrer dans Fichiers**, puis **iCloud Drive** (ou envoie-toi le fichier par Mail).
3. La date du dernier export est affichée dans les réglages (roue crantée).

Restaurer (nouveau téléphone ou réinstallation) : roue crantée > **Importer une sauvegarde** > choisis le fichier `appmuscu-sauvegarde-AAAA-MM-JJ.json` > **Restaurer**. Attention : les données actuelles du téléphone sont remplacées.

---

## 7. Mettre à jour l'appli plus tard

1. `[PC]` Modifie les fichiers en local (ou demande à Claude, puis dis « publie »).
2. `[PC]` Dans `sw.js`, incrémente la version, par exemple `appmuscu-v2.1.0` devient `appmuscu-v2.1.1`. **Indispensable** : sinon l'iPhone continue d'utiliser l'ancienne version en cache.
3. `[PC, Git Bash]` Dans le dossier AppMuscu :

   ```bash
   git add -A
   ```

   ```bash
   git commit -m "Description du changement"
   ```

   ```bash
   git push
   ```

   Attends 1 à 2 minutes que GitHub Pages republie.
4. `[iPhone]` Ouvre AppMuscu avec du réseau, ferme-la complètement (balayer vers le haut), puis rouvre-la. La nouvelle version est chargée.

Les données ne sont pas touchées par une mise à jour. Fais quand même un export avant, par sécurité.

---

## En cas de problème

| Symptôme | Cause probable | Action |
|---|---|---|
| Page 404 sur l'adresse | Pages pas encore prêt, ou `index.html` dans un sous-dossier | Attendre 2 min ; vérifier l'étape 3 |
| L'appli ne change pas après une mise à jour | Version de `sw.js` non incrémentée | Incrémenter, renvoyer `sw.js`, fermer et rouvrir l'appli |
| L'écran se met en veille pendant le repos | iOS < 18.4, ou appli ouverte dans Safari et pas depuis l'icône | Mettre à jour iOS ; lancer depuis l'icône |
| Pas de son à la fin du repos | Volume bas ou mode silencieux (à vérifier en vrai) | Monter le volume ; tester avec et sans mode silencieux |
| Image d'un exercice du catalogue absente | Pas de réseau au moment de l'ajout | Ajouter l'exercice avec du réseau, ou remplacer l'image à la main |
