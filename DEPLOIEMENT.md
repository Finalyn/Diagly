# Mettre Diagly en ligne

Le dépôt n'écrivait nulle part comment se fait une mise en ligne. Elle se faisait
à la main, et l'ordre des opérations, qui compte, ne tenait que dans la mémoire de
celui qui l'avait déjà faite. Ce document et `scripts/deploy.sh` le fixent.

## Comment l'application est servie

Un seul processus Node. L'API Express répond sur `/api`, et sert aussi le front
construit, dont le chemin lui est donné par la variable `STATIC_DIR`. Toute route
inconnue renvoie `index.html`, puisque le routage est côté navigateur. Le tout
tourne derrière le reverse proxy Infomaniak, qui termine le TLS et transmet le
vrai client dans `X-Forwarded-For`.

Sur le serveur, l'application attend donc cette forme :

```
<DEPLOY_PATH>/
  web/           le front construit, c'est lui que STATIC_DIR désigne
  server/
    dist/        l'API compilée, lancée par node dist/index.js
    prisma/      le schéma, pour prisma db push
    .env         la configuration de production, jamais transférée d'ici
    node_modules/
  sauvegardes/   les dumps pris avant chaque changement de schéma
```

Le `.env` de production vit sur le serveur et n'est jamais écrasé par un
déploiement. Les variables qu'il doit porter sont listées dans
`server/.env.example`. En production, `NODE_ENV=production`, `APP_URL` porte le
vrai domaine, et `STATIC_DIR` pointe sur `<DEPLOY_PATH>/web`.

## La première fois

1. Copier `.env.deploy.example` en `.env.deploy` et le remplir. Ce fichier reste
   sur votre machine, il n'est pas versionné.
2. Vérifier que la clé SSH passe : `ssh -p <port> <user>@<hôte> 'echo ok'`.
3. Créer `sauvegardes/` à côté de `server/`, sinon le script ne pourra pas
   déposer son dump et vous préviendra sans s'arrêter.

## À chaque fois

```bash
bash scripts/deploy.sh          # simulation : montre ce qui partirait
bash scripts/deploy.sh --go     # transfère pour de vrai
```

Le script refuse de partir si l'arbre de travail n'est pas propre : on ne publie
que ce qui est commité, faute de quoi on ne sait plus ce qui tourne en ligne.

Sans `--go`, rsync tourne en simulation et rien n'est écrit. Regardez la liste
avant le premier déploiement : une erreur de `DEPLOY_PATH` avec `--delete` efface
un dossier qui n'était pas le bon.

## Le piège de la colonne preferences

`users.preferences` est un JSON `NOT NULL` avec `{}` pour défaut. Selon l'état de
départ de la table, `prisma db push` laisse des lignes à `NULL`, et la lecture des
préférences fait alors échouer la connexion des comptes déjà existants. Le site
répond, la page d'accueil s'affiche, et personne ne peut plus se connecter.

Le script répare avant de redémarrer :

```sql
UPDATE users SET preferences = '{}' WHERE preferences IS NULL;
```

Ne pas l'oublier si vous déployez à la main.

## Revenir en arrière

Le front se remet en place en republiant le commit précédent. La base, non :
`prisma db push` ne sait pas défaire. C'est pour cela que le script prend un dump
avant d'y toucher, dans `sauvegardes/avant-<horodatage>.sql`.

Un changement de schéma qui tourne mal se répare donc depuis ce dump, pas depuis
git. Vérifiez qu'il a bien été écrit avant de lancer une mise en ligne qui touche
au schéma.

## Ce que cette version change dans la base

La version du 1er octobre 2026 ajoute l'énumération `Localisation`, la colonne
`diagnostic_items.localisation`, et les tables `project_variants` et
`variant_lines`. Ce sont des ajouts : aucune colonne existante n'est supprimée ni
modifiée, et `prisma db push` refuse de lui-même s'il devait détruire quelque
chose.

Après le déploiement, le catalogue de production doit être renuméroté pour que le
parcours de visite range les ouvrages dans les six étapes. Sans cela, ils tombent
tous dans le bloc « Autres ». Ce point n'est pas automatisé : voir avec l'auteur
de la branche avant de le lancer en ligne.
