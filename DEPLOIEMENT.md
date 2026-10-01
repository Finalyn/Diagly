# Mettre Diagly en ligne

Le dépôt n'écrivait nulle part comment se fait une mise en ligne. Elle tenait dans
une commande recopiée de mémoire, et cette commande oubliait trois choses qui
tiennent le site debout. Ce document et `scripts/deploy-serveur.sh` les fixent.

## Comment l'application tourne

Le dépôt est cloné sur le serveur, dans `~/sites/diagly.ch`. On ne transfère donc
rien depuis un poste : le serveur va chercher le code sur GitHub lui-même.

Un seul processus Node, lancé par pm2. L'API Express répond sur `/api` et sert
aussi le front construit, dont le chemin lui est donné par `STATIC_DIR`. Toute
route inconnue renvoie `index.html`, puisque le routage est côté navigateur. Le
tout est derrière le reverse proxy Infomaniak, qui termine le TLS.

Deux paquets npm distincts, et c'est le piège principal :

- la racine construit **le front** dans `dist/` ;
- `server/` est un paquet à part, avec ses propres dépendances et sa propre
  compilation, dans `server/dist/`, qui est ce que pm2 exécute.

`npm run build` à la racine ne touche pas au second. Le `tsconfig.json` racine ne
référence que `tsconfig.app.json` et `tsconfig.node.json`, et celui-ci n'inclut
que `src`.

Le `.env` de production vit dans `server/` sur le serveur. Il n'est pas versionné
et aucun déploiement ne l'écrase. Les variables attendues sont dans
`server/.env.example` ; en production `NODE_ENV=production`, `APP_URL` porte le
vrai domaine, et `STATIC_DIR` pointe sur le `dist/` de la racine.

## Mettre en ligne

```bash
cd ~/sites/diagly.ch
git fetch origin
git reset --hard origin/release-2026-10-01
bash scripts/deploy-serveur.sh
```

La branche par défaut du dépôt est **`master`**, pas `main`. Un `git reset --hard
origin/main` échoue, et comme tout s'enchaîne en `&&`, la suite ne s'exécute
jamais : la commande ne fait alors rien, sans le dire.

## Ce que le script fait, et que la commande manuelle oubliait

1. **Le front.** `npm ci` puis `npm run build`, vers `dist/`.
2. **L'API.** `npm ci --omit=dev` dans `server/`, `prisma generate`, puis
   `npm run build` vers `server/dist/`. Sans cette étape, `pm2 restart` relance
   l'ancien code serveur et la mise en ligne n'a rien changé côté API.
3. **Une sauvegarde de la base**, dans `sauvegardes/avant-<horodatage>.sql`. Elle
   est obligatoire : si `mysqldump` échoue, le script s'arrête avant de toucher au
   schéma. `prisma db push` ne sait pas défaire.
4. **Le schéma**, avec `prisma db push`, puis la réparation de `users.preferences`.
5. **Le redémarrage**, et un appel à `/health` pour vérifier que l'API répond.

## Le piège de la colonne preferences

`users.preferences` est un JSON `NOT NULL` avec `{}` pour défaut. Selon l'état de
départ de la table, `prisma db push` laisse des lignes à `NULL`, et la lecture des
préférences fait alors échouer la connexion des comptes déjà existants. Le site
répond, la page d'accueil s'affiche, et plus personne ne peut se connecter.

Le script répare avant de redémarrer :

```sql
UPDATE users SET preferences = '{}' WHERE preferences IS NULL;
```

Ne pas l'oublier si vous déployez à la main.

## Revenir en arrière

Le code se remet en place en republiant le commit précédent :

```bash
git reset --hard <commit précédent>
bash scripts/deploy-serveur.sh
```

La base, non. Un changement de schéma qui tourne mal se répare depuis le dump pris
juste avant, pas depuis git :

```bash
mysql -u <user> -p <base> < sauvegardes/avant-<horodatage>.sql
```

## Ce que la version du 1er octobre 2026 change dans la base

Elle ajoute l'énumération `Localisation`, la colonne
`diagnostic_items.localisation`, et les tables `project_variants` et
`variant_lines`. Ce sont des ajouts : aucune colonne existante n'est supprimée ni
modifiée, et `prisma db push` refuse de lui-même s'il devait détruire quelque
chose.

Après la mise en ligne, le catalogue de production doit être renuméroté pour que
le parcours de visite range les ouvrages dans les six étapes. Sans cela, ils
tombent tous dans le bloc « Autres ». Le site fonctionne, cet écran est inutilisable.
Ce point n'est pas automatisé : à voir avec l'auteur de la branche.
