# Diagly : le serveur

API REST de Diagly. Node 20+ / Express / Prisma / MySQL 8. En production, le
même service sert aussi le front construit (`STATIC_DIR`).

Ce fichier est recopié tel quel dans le dépôt de production
(`Finalyn/diagly-deploy`) par `scripts/publier-production.mjs`. La mise en
ligne est décrite dans `DEPLOIEMENT.md`, à la racine du dépôt source.

## Prérequis

- **Node.js 20+**
- **MySQL 8** : Docker Desktop (https://www.docker.com/products/docker-desktop/)
  pour le lancer avec `npm run db:up`, ou un MySQL installé sur la machine.

## Démarrage en local

```powershell
# 1. Copier la config
cp .env.example .env
#    Génère deux secrets JWT longs et remplace les valeurs par défaut :
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 2. Installer les dépendances
npm install

# 3. Lancer MySQL (docker compose : base diagly sur le port 3306)
npm run db:up

# 4. Créer les tables
#    Le dépôt n'a pas de dossier prisma/migrations : le schéma s'applique
#    directement, il n'y a pas d'historique de migrations à rejouer.
npx prisma db push

# 5. Charger le catalogue de départ (645 entrées CFC, 113 postes) et le premier compte
npm run db:seed

# 6. Lancer l'API en mode dev (rechargement à chaud)
npm run dev
```

L'API écoute par défaut sur **http://localhost:4000**.

Healthcheck : `GET /health` répond `{ ok: true, db: "up" }`, ou 503 avec
`db: "down"` si la base ne répond pas.

### La base CFC v3

L'éditeur du relevé lit la base CFC v3 (nomenclature, articles et leurs prix
par état, sept étapes de visite, postes automatiques), pas le catalogue du
seed. Elle vient du classeur Excel du bureau, qui n'est pas dans ce dépôt
public : il n'existe que dans le dépôt de production, privé. Avec le classeur
en main :

```powershell
npx tsx prisma/base-cfc/importer.ts chemin/vers/DIAGLY_base_CFC_v3.xlsx              # aperçu
npx tsx prisma/base-cfc/importer.ts chemin/vers/DIAGLY_base_CFC_v3.xlsx --appliquer  # écrit
```

L'import se relance sans risque : à l'identique, il ne change rien et le dit.
Sans cette base, la liste des ouvrages de l'éditeur reste vide.

## Scripts npm

| script | description |
| --- | --- |
| `dev` | serveur en mode développement (tsx watch) |
| `build` | compilation TypeScript vers `dist/` |
| `start` | lance `dist/index.js` (production) |
| `db:up` | démarre MySQL via docker compose |
| `db:down` | arrête le conteneur MySQL |
| `db:generate` | régénère le client Prisma typé |
| `db:studio` | ouvre Prisma Studio (interface web pour explorer la base) |
| `db:seed` | crée le premier compte si la base n'en a aucun, et charge `cfc_catalog` + `catalog_items` depuis `prisma/seed-data.json` s'ils sont vides |
| `lint` | vérification de types (`tsc --noEmit`) |
| `db:migrate`, `db:deploy`, `db:reset` | reposent sur `prisma migrate`, alors que le dépôt n'a pas de migrations : ne pas les utiliser. Pour repartir d'une base vide : `npx prisma db push --force-reset`, puis `npm run db:seed` (efface toutes les données) |

Les tests du serveur (`src/lib/*.test.ts`) tournent avec ceux du front :
`npx vitest run` à la racine du dépôt.

## Variables d'environnement

Lues et validées par `src/lib/env.ts` au démarrage : une variable obligatoire
absente ou trop courte arrête le serveur avec `Invalid environment
configuration` et le nom de la variable. Une variable laissée vide dans `.env`
vaut « absente ».

| variable | défaut | rôle |
| --- | --- | --- |
| `DATABASE_URL` | obligatoire | connexion MySQL |
| `JWT_ACCESS_SECRET` | obligatoire, 32 caractères min. | signe les jetons d'accès, les liens de réinitialisation et l'état OAuth |
| `JWT_REFRESH_SECRET` | obligatoire, 32 caractères min. | signe les jetons de rafraîchissement |
| `NODE_ENV` | `development` | `production` en ligne : coupe l'accès CORS depuis localhost |
| `PORT` | `4000` | port d'écoute |
| `CORS_ORIGIN` | `http://localhost:5173` | origines autorisées, séparées par des virgules ; `capacitor://localhost` (l'app iPhone/iPad) est ajoutée en dur |
| `APP_URL` | `http://localhost:4000` | URL publique : retour de Google, liens de mot de passe oublié et d'invitation. Laissée à localhost en production, le serveur le signale au démarrage |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `7d` | durée des jetons |
| `BCRYPT_ROUNDS` | `12` | coût du hachage des mots de passe (10 à 15) |
| `API_KEY_PEPPER` | `JWT_ACCESS_SECRET` | poivre du hachage des clés d'API (16 caractères min.) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | vides | envoi des emails ; sans eux, pas d'email (voir plus bas) |
| `SMTP_FROM` | `Diagly <noreply@diagly.ch>` | expéditeur |
| `SUPPORT_EMAIL` | `contact@finalyn.com` | reçoit les demandes de support |
| `FINALYN_ADMINS` | `contact@finalyn.com` | comptes qui gèrent l'annuaire des prestataires (en plus du rôle ADMIN), séparés par des virgules |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | vides | connexion Google |
| `ANTHROPIC_API_KEY` | vide | assistant IA ; sans elle, l'assistant se dit indisponible |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5-20251001` | modèle de l'assistant |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | vides | notifications push du navigateur |
| `VAPID_SUBJECT` | `mailto:contact@diagly.ch` | contact déclaré au service push |
| `APPLE_BUNDLE_ID` | `ch.diagly.app` | identifiant de l'app iPhone/iPad (connexion Apple, APNs, retour de Google vers l'app) |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | vides | clé `.p8` d'Apple, `APPLE_PRIVATE_KEY` étant son contenu en base64 sur une ligne : notifications sur l'iPhone (APNs) et révocation de l'accès Apple à la suppression d'un compte. Sans elle, la connexion Apple marche quand même |
| `APPLE_SERVICES_ID` | vide | « Se connecter avec Apple » sur le site : l'identifiant de service (Services ID, par ex. `ch.diagly.web`) rattaché à l'App ID de l'app. Adresse de retour à déclarer chez Apple : `APP_URL` + `/api/auth/apple/web/retour` (https). Sans lui, le bouton Apple n'apparaît pas sur le site |
| `APNS_SANDBOX` | `false` | `true` seulement pour une app compilée en développement ; TestFlight et l'App Store utilisent l'APNs de production |

Lues directement dans le code, hors de `env.ts` :

| variable | rôle |
| --- | --- |
| `STATIC_DIR` | dossier du front construit, servi par le même service (production : `public/`). Absente, seul l'API répond |
| `DIAGLY_BASE_INDEX`, `DIAGLY_MARKET_INDEX`, `DIAGLY_MARKET_INDEX_DATE`, `DIAGLY_MARKET_INDEX_SOURCE` | coefficient marché des coûts (`src/lib/market.ts`) : indice courant sur indice de base, 1 par défaut |
| `DIAGLY_LEGACY_COST_INDEX` | coefficient présumé des coûts écrits avant la colonne `cost_index` (`1.123` par défaut), pour la réindexation |

`.env.example` ne liste pas encore `FINALYN_ADMINS`, les variables `APPLE_*`,
`APNS_SANDBOX`, `STATIC_DIR` ni `DIAGLY_*`.

Sans SMTP : une invitation d'équipe renvoie son lien, à copier ; le lien de mot
de passe oublié part dans le journal du serveur, et l'écran le dit.

## Architecture

```
src/
├── index.ts              # entrée Express : sécurité (helmet, CORS), routes, /uploads, front statique
├── lib/                  # env, prisma, journal, jwt, hachage, mails, notifications, push et APNs,
│                         # planificateur, webhooks, export, IA (contexte, analyse photo), marché
├── middlewares/          # auth, organisation (rôles), clé d'API, limites de débit, validation, erreurs
├── mcp/                  # outils du serveur MCP
└── routes/               # un fichier par domaine (tableau ci-dessous) ; v1/ = API publique
prisma/
├── schema.prisma         # schéma de la base
├── seed-data.json        # catalogue de départ (645 CFC, 113 postes)
├── seed.ts               # charge seed-data.json, idempotent
├── base-cfc/             # import de la base CFC v3 depuis le classeur
└── correspondance/       # correspondance entre l'ancien catalogue et la base v3
```

Au démarrage, le serveur lance deux tâches de fond : le planificateur de
notifications (`lib/scheduler.ts` : rappels de visite une demi-heure avant,
résumé du lundi pour qui l'a demandé, rappels d'absence) et l'envoi des
webhooks (`lib/webhook-worker.ts`).

## API

Toutes les routes de `/api` sont limitées en débit (600 requêtes par minute et
par IP). Sauf mention contraire, elles demandent l'en-tête :

```
Authorization: Bearer <accessToken>
```

Un membre au rôle VIEWER d'une organisation ne peut que lire : les écritures
sur les dossiers, diagnostics, visites, plans, variantes et opérations lui sont
refusées.

| préfixe | fichier | contenu |
| --- | --- | --- |
| `/health` | `index.ts` | état du serveur et de la base, sans authentification |
| `/api/auth` | `auth.ts` | comptes, jetons, 2FA, Google, Apple, suppression du compte |
| `/api/cfc` | `cfc.ts` | ancien catalogue, base CFC v3 (lecture, écriture réservée aux responsables) |
| `/api/projects` | `projects.ts` | dossiers, leurs diagnostics, lien de partage |
| `/api/diagnostics` | `diagnostics.ts` | diagnostics et relevés |
| `/api/operations` | `operations.ts` | opérations multi-bâtiments |
| `/api/variants` | `variants.ts` | variantes d'un dossier et leurs lignes |
| `/api/plans` | `plans.ts` | plans PDF ou images (fichiers dans `uploads/`) |
| `/api/boards` | `boards.ts` | ateliers multi-plans (le front ne s'en sert plus) |
| `/api/events` | `events.ts` | calendrier |
| `/api/visite` | `visite.ts` | organisation de la visite : interlocuteurs, rendez-vous, mails |
| `/api/assistant` | `assistant.ts` | assistant IA : conversation, analyse de photos, import d'un CECB |
| `/api/demarrage` | `demarrage.ts` | lecture IA d'un document ou d'un CECB pour pré-remplir un nouveau dossier |
| `/api/partenaires` | `partenaires.ts` | annuaire des prestataires et demandes de mise en relation |
| `/api/geo` | `geo.ts` | affectation de la parcelle par le cadastre RDPPF (Vaud et Genève), appelé côté serveur |
| `/api/notifications` | `notifications.ts` | la cloche : liste, lu, supprimé |
| `/api/push` | `push.ts` | push du navigateur et appareils iOS ; `GET /vapid` est public |
| `/api/export` | `export.ts` | export d'un dossier en JSON, CSV ou XLSX |
| `/api/org` | `org.ts` | organisation, membres, invitations |
| `/api/support` | `support.ts` | tickets de support et pièces jointes |
| `/api/api-keys`, `/api/webhooks` | `api-keys.ts`, `webhooks.ts` | gestion des clés d'API et des webhooks |
| `/api/v1` | `v1/` | API publique en lecture seule, par clé d'API ; documentation sur `/api/v1/docs` |
| `/api/mcp` | `mcp.ts` | serveur MCP (JSON-RPC en POST), par clé d'API |
| `/api/market`, `/api/vitrine`, `/api/share` | `market.ts`, `vitrine.ts`, `share.ts` | publics : coefficient marché, données de la vitrine, rapport partagé en lecture seule |

Les fichiers de `/uploads` ne se lisent qu'avec le jeton signé que l'API ajoute
à leur URL (`?t=`), valable 30 jours.

### Auth

| méthode | route | corps |
| --- | --- | --- |
| POST | `/api/auth/register` | `{ email, password, firstName?, lastName?, companyName?, phone? }` (tout nouveau compte est PARTICULIER) |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` |
| POST | `/api/auth/logout` | `{ refreshToken }` |
| GET / PUT | `/api/auth/me` | profil |
| PUT | `/api/auth/preferences` | préférences (entreprise, notifications, apparence) |
| POST | `/api/auth/change-password` | |
| POST | `/api/auth/forgot-password`, `/api/auth/reset-password` | lien par email, valable 30 minutes |
| | `/api/auth/2fa/*` | double authentification par application (TOTP) ou par email ; `verify` et `resend` à la connexion |
| GET | `/api/auth/google`, `/api/auth/google/callback` | connexion Google ; `?app=1` revient vers l'app iPhone/iPad |
| POST | `/api/auth/apple` | `{ identityToken, authorizationCode?, firstName?, lastName? }`, depuis l'app |
| GET | `/api/auth/apple/web` | connexion Apple sur le site : redirige vers Apple ; Apple revient par un POST (`form_post`) sur `/api/auth/apple/web/retour` |
| GET | `/api/auth/fournisseurs` | `{ google, apple }` : les connexions que le site peut proposer, d'après la configuration |
| POST | `/api/auth/compte/supprimer` | `{ confirmation: "SUPPRIMER" }` |

Réponses de login, register et refresh : `{ user, accessToken, refreshToken }`.
Si la 2FA est active, login (et Google, Apple) répond d'abord par l'étape du
code. Le jeton de rafraîchissement change à chaque usage.

### Catalogue CFC

| méthode | route | description |
| --- | --- | --- |
| GET | `/api/cfc/base` | base CFC v3 en un appel : articles (six états), étapes de visite, postes automatiques |
| GET | `/api/cfc/base/nomenclature` | nomenclature CFC complète |
| GET | `/api/cfc/base/articles/:id/historique` | modifications d'un article |
| PUT / POST | `/api/cfc/base/articles[/:id]`, `/api/cfc/base/postes/:code` | écriture de la base, réservée au rôle ADMIN ou aux OWNER/ADMIN d'une organisation, tracée dans `article_historique` |
| GET | `/api/cfc/catalog[/:code]`, `/api/cfc/items[/:id]`, `/api/cfc/categories` | ancien catalogue (seed) |
| POST / PUT / DELETE | `/api/cfc/items`, `/api/cfc/items/:id`, `/api/cfc/items/reset` | personnalisation de l'ancien catalogue par compte |

### Dossiers et diagnostics

| méthode | route |
| --- | --- |
| GET / POST | `/api/projects` |
| GET / PUT / DELETE | `/api/projects/:id` |
| POST / DELETE | `/api/projects/:id/share` |
| GET / POST | `/api/projects/:id/diagnostics` |
| GET | `/api/diagnostics/recent-items` |
| GET / PUT / DELETE | `/api/diagnostics/:id` |
| GET / POST | `/api/diagnostics/:id/items` |
| POST | `/api/diagnostics/:id/reindex` (`?preview=1` sans écrire) |
| GET / PUT / DELETE | `/api/diagnostics/items/:itemId` |

`POST /api/diagnostics/:id/items` accepte un `id` (UUID) choisi par l'appareil :
c'est ce qui rend la création idempotente pour le relevé hors ligne. Un
renvoi du même relevé rend celui qui existe (200), un identifiant déjà pris
dans un autre diagnostic répond 409.

## Smoke test

Voir `scripts/smoke-test.ps1` pour un parcours complet (register, création d'un
dossier, d'un diagnostic, ajout d'un relevé, liste).

## Mise en production

La production tourne sur un hébergement Node.js d'Infomaniak, qui suit le dépôt
privé `Finalyn/diagly-deploy` : un miroir de ce dossier, avec le front déjà
construit dans `public/`. On n'y clone pas le dépôt source. Marche à suivre,
variables du `.env` de production, réparation de la colonne `preferences` après
un `prisma db push`, import de la base CFC et retour en arrière : voir
`DEPLOIEMENT.md` dans le dépôt source.
