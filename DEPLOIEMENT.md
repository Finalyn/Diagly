# Mettre Diagly en ligne

Écrit après la mise en ligne du 12 octobre 2026, qui a montré que la version
précédente de ce document décrivait une installation jamais mise en place sur
le serveur.

## Comment la production tourne

Diagly tourne sur un hébergement Node.js d'Infomaniak, dans `~/sites/diagly.ch`.

Ce dossier **n'est pas un clone de ce dépôt-ci**. C'est un clone du dépôt
**privé** `Finalyn/diagly-deploy`, branche `main`, qui contient :

- le serveur : un miroir des fichiers suivis de `server/` (à la racine du dépôt
  de production, et non dans un sous-dossier) ;
- le front **déjà construit**, dans `public/` : le serveur ne le construit pas ;
- ce qui n'appartient qu'à lui : `scripts/deploy.sh`, son `.gitignore`,
  `uploads/`, l'ancienne app mobile sous `public/mobile`, et le classeur de la
  base CFC (`prisma/base-cfc/*.xlsx`, privé).

Le `.env` de production vit à la racine de `~/sites/diagly.ch`. Il n'est pas
versionné et aucune mise en ligne ne l'écrase.

`scripts/deploy-serveur.sh`, dans ce dépôt-ci, supposait que le serveur clone
`Finalyn/Diagly` : il ne sert pas.

## Mettre en ligne

### 1. Sur le poste : publier dans le dépôt de production

```bash
node scripts/publier-production.mjs            # aperçu, ne change rien
node scripts/publier-production.mjs --pousser  # construit, recopie, commite, pousse
```

Le script refuse un dépôt modifié : seul du code commité part. Il construit le
front (build web), recopie `server/`, et dit si le schéma Prisma ou les
dépendances changent. C'est ce qui décide de l'étape suivante.

### 2. Sur le serveur

Console SSH du Manager Infomaniak. **Coller une seule ligne à la fois, et
seulement la commande** : le 12 octobre, l'affichage d'une commande précédente
recollé dans la console y a été exécuté ligne par ligne, et deux de ses lignes
(`npm audit fix --force`) ont remplacé des dépendances.

**Front seul** (ni schéma ni dépendances changés) : récupérer suffit, les fichiers
de `public/` sont servis tels quels.

```bash
cd ~/sites/diagly.ch && git fetch origin && git reset --hard origin/main
```

**Code serveur, schéma ou dépendances changés** : la même ligne, puis dans le
Manager, page Node.js, **Build de l'application** (installation avec les
dépendances de développement, `prisma generate`, compilation, `prisma db push`),
puis **Redémarrer** une fois le build terminé.

En console, `bash scripts/deploy.sh` fait le même travail, avec en plus une
sauvegarde de la base avant de toucher au schéma.

Si le schéma a changé, vérifier ensuite que `prisma db push` a bien été
appliqué :

```bash
cd ~/sites/diagly.ch && npx prisma db push
```

Le 12 octobre, il ne l'avait pas été : le nouveau code lisait une colonne
absente (`users.two_factor_method`) et toute connexion répondait « Internal
server error », y compris pour un compte inexistant.

## Le piège de la colonne preferences

`users.preferences` est un JSON `NOT NULL` avec `{}` pour défaut. Selon l'état de
départ de la table, `prisma db push` laisse des lignes vides ou invalides, et la
connexion des comptes existants échoue. Après chaque `db push` :

```bash
cd ~/sites/diagly.ch && echo "UPDATE users SET preferences='{}' WHERE preferences IS NULL OR CAST(preferences AS CHAR)='' OR JSON_VALID(preferences)=0;" | npx prisma db execute --stdin --schema=prisma/schema.prisma
```

## La base CFC

Son import emprunte du code au front ; il est livré assemblé en un fichier,
`prisma/base-cfc/importer.mjs`. Toujours un aperçu d'abord :

```bash
cd ~/sites/diagly.ch && node prisma/base-cfc/importer.mjs prisma/base-cfc/DIAGLY_base_CFC_v3.xlsx
cd ~/sites/diagly.ch && node prisma/base-cfc/importer.mjs prisma/base-cfc/DIAGLY_base_CFC_v3.xlsx --appliquer
```

Les anciens articles se retrouvent **par leur nom**, jamais par leur numéro
d'ordre : la numérotation du vieux catalogue n'est pas la même en local et en
production. Par le numéro, l'aperçu du 12 octobre rattachait des relevés au
mauvais article.

## Revenir en arrière

Le code : republier le commit précédent du dépôt de production.

```bash
cd ~/sites/diagly.ch && git reset --hard <commit précédent>
```

Puis Build et Redémarrer si le serveur avait changé. La base, elle, ne se
remet pas en place par git : depuis la sauvegarde prise par `deploy.sh`
(`sauvegardes/avant-<horodatage>.sql`), ou depuis les sauvegardes automatiques
d'Infomaniak (Manager, Bases de données).
