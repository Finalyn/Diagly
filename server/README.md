# Diagly — Backend

API REST pour Diagly. Node 20+ / Express / Prisma / MySQL 8.

## Prérequis

- **Node.js 20+**
- **Docker Desktop** (pour MySQL en local) — https://www.docker.com/products/docker-desktop/

## Démarrage en local

```powershell
# 1. Copier la config
cp .env.example .env
#    Génère deux secrets JWT longs et remplace les valeurs par défaut :
#    node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 2. Installer les deps
npm install

# 3. Lancer MySQL (docker compose)
npm run db:up

# 4. Appliquer les migrations Prisma (crée toutes les tables)
#    → exécute aussi automatiquement le seed (cfc_catalog + catalog_items)
npm run db:migrate

# 5. Lancer l'API en mode dev (watch + hot reload)
npm run dev
```

L'API écoute par défaut sur **http://localhost:4000**.

Healthcheck : `GET /health` → `{ ok: true, db: "up" }`.

## Scripts npm

| script           | description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| `dev`            | Serveur en mode développement (tsx watch)                         |
| `build`          | Compilation TypeScript → `dist/`                                  |
| `start`          | Lance `dist/index.js` (prod)                                      |
| `db:up`          | Démarre MySQL via docker-compose                                  |
| `db:down`        | Stoppe le container MySQL                                         |
| `db:migrate`     | `prisma migrate dev` — crée/migre le schéma + lance le seed       |
| `db:deploy`      | `prisma migrate deploy` — applique les migrations (prod)          |
| `db:generate`    | Régénère le client Prisma typé                                    |
| `db:studio`      | Ouvre Prisma Studio (UI web pour explorer la DB)                  |
| `db:seed`        | Re-seed cfc_catalog + catalog_items depuis `../sql/seed_data.sql` |
| `db:reset`       | Reset complet (drop + recreate + seed) — ⚠️ détruit toutes les données |
| `lint`           | Type-check uniquement                                             |

## Architecture

```
src/
├── index.ts              # entrypoint Express
├── lib/                  # env, prisma, logger, jwt, hash, http-error
├── middlewares/          # auth, error, validate
└── routes/
    ├── auth.ts           # /api/auth/*
    ├── cfc.ts            # /api/cfc/* (lecture seule)
    ├── projects.ts       # /api/projects/* + /:id/diagnostics
    └── diagnostics.ts    # /api/diagnostics/:id + /items
prisma/
├── schema.prisma         # schéma DB
└── seed.ts               # importe ../sql/seed_data.sql
```

## API — endpoints

Toutes les routes (sauf `/health` et `/api/auth/{register,login,refresh}`) requièrent l'en-tête :

```
Authorization: Bearer <accessToken>
```

### Auth

| méthode | route                  | corps                                                      |
| ------- | ---------------------- | ---------------------------------------------------------- |
| POST    | `/api/auth/register`   | `{ email, password, firstName?, lastName?, role? }`        |
| POST    | `/api/auth/login`      | `{ email, password }`                                      |
| POST    | `/api/auth/refresh`    | `{ refreshToken }`                                         |
| POST    | `/api/auth/logout`     | `{ refreshToken }`                                         |
| GET     | `/api/auth/me`         | —                                                          |

Réponses login/register/refresh : `{ user, accessToken, refreshToken }`.

### Catalogue CFC

| méthode | route                          | description                                             |
| ------- | ------------------------------ | ------------------------------------------------------- |
| GET     | `/api/cfc/catalog`             | Nomenclature CFC suisse complète. Filtres : `?level=`, `?parent=`, `?search=` |
| GET     | `/api/cfc/catalog/:code`       | Une entrée                                              |
| GET     | `/api/cfc/items`               | Items opérationnels avec prix. Filtres : `?category=`, `?cfc=`, `?search=` |
| GET     | `/api/cfc/items/:id`           | Un item                                                 |
| GET     | `/api/cfc/categories`          | Catégories distinctes (STRUCTURE, FACADE, ...)          |

### Projects

| méthode | route                              |
| ------- | ---------------------------------- |
| GET     | `/api/projects`                    |
| POST    | `/api/projects`                    |
| GET     | `/api/projects/:id`                |
| PUT     | `/api/projects/:id`                |
| DELETE  | `/api/projects/:id`                |
| GET     | `/api/projects/:id/diagnostics`    |
| POST    | `/api/projects/:id/diagnostics`    |

### Diagnostics + items

| méthode | route                                          |
| ------- | ---------------------------------------------- |
| GET     | `/api/diagnostics/:id`                         |
| PUT     | `/api/diagnostics/:id`                         |
| DELETE  | `/api/diagnostics/:id`                         |
| GET     | `/api/diagnostics/:id/items`                   |
| POST    | `/api/diagnostics/:id/items`                   |
| GET     | `/api/diagnostics/items/:itemId`               |
| PUT     | `/api/diagnostics/items/:itemId`               |
| DELETE  | `/api/diagnostics/items/:itemId`               |

## Smoke test

Voir `scripts/smoke-test.ps1` pour un parcours complet (register → create project → create diagnostic → add item → list).

## Déploiement Infomaniak (Cloud Server)

1. Sur le VPS, installer Node 20 + MySQL 8 (apt) ou utiliser MySQL managé Infomaniak.
2. Créer une base `diagly` + un user dédié.
3. Cloner le repo, copier `.env.example` → `.env`, remplir avec la connexion prod.
4. `npm ci && npm run build`
5. `npm run db:deploy` (applique migrations)
6. `npm run db:seed` (charge cfc_catalog + catalog_items)
7. Lancer `node dist/index.js` derrière un reverse-proxy (Nginx/Caddy) + process manager (systemd ou PM2).
