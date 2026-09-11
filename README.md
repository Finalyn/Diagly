# Diagly

Diagnostic de bâtiment et planification de rénovation, pour la Suisse romande.

On relève l'état d'un immeuble pendant la visite, ouvrage par ouvrage. L'application
propose un état à partir de la photo, calcule les métrés, applique les prix du catalogue
du bureau et sort un rapport structuré par codes CFC, chiffré en francs.

Front en React 19 + TypeScript + Vite. API en Node + Express + Prisma sur MySQL 8.

---

## Démarrage en local

Comptez une vingtaine de minutes la première fois, l'essentiel étant l'installation
de MySQL.

### Ce qu'il faut avoir

- **Node.js 20 ou plus** : https://nodejs.org (prenez la version LTS)
- **MySQL 8**, au choix :
  - **Docker Desktop** (le plus simple) : https://www.docker.com/products/docker-desktop/
  - ou MySQL installé directement sur la machine

Vérifiez que Node répond avant de continuer :

```bash
node --version
```

### 1. Récupérer le code

```bash
git clone https://github.com/Finalyn/Diagly.git
cd Diagly
```

### 2. Lancer la base de données

Avec Docker, depuis le dossier `server/` :

```bash
cd server
npm run db:up
```

Cela démarre un MySQL sur le port 3306, avec la base `diagly` déjà créée.

Sans Docker, créez à la main une base `diagly` et un utilisateur, puis adaptez
`DATABASE_URL` à l'étape suivante.

### 3. Configurer l'API

Toujours dans `server/` :

```bash
cp .env.example .env
```

Puis ouvrez `.env` et remplacez les deux secrets JWT par des valeurs longues et
aléatoires. Cette commande en génère une, à lancer deux fois :

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Ce sont les seules valeurs obligatoires à changer. Tout le reste du fichier
fonctionne tel quel en local.

### 4. Créer les tables et charger le catalogue

```bash
npm install
npx prisma db push
npm run db:seed
```

Le seed charge 645 entrées de la nomenclature CFC et les 111 postes du catalogue,
puis crée un compte pour se connecter. Il est sans effet s'il est relancé sur une
base déjà remplie.

> Le dépôt ne contient pas de dossier `prisma/migrations` : le schéma est appliqué
> avec `prisma db push`, pas avec `prisma migrate`.

### 5. Lancer l'API

```bash
npm run dev
```

Elle écoute sur http://localhost:4000. Pour vérifier, ouvrez
http://localhost:4000/health : la réponse doit contenir `{ "ok": true }`.

### 6. Lancer l'application

Dans un **second terminal**, à la racine du dépôt :

```bash
npm install
npm run dev
```

L'application est sur http://localhost:5173.

### Se connecter

Le seed crée ce compte :

```
contact@finalyn.com
Diagly2026!
```

C'est un compte de démarrage local. Il est écrit en clair dans ce dépôt public :
changez le mot de passe depuis les réglages si vous exposez votre installation
ailleurs que sur votre machine.

---

## Ce qui marche sans rien de plus

Le diagnostic, le catalogue, les métrés, les coûts, les variantes, les rapports,
les exports et la recherche d'adresse fonctionnent dès l'installation. La recherche
d'adresse et le registre des bâtiments passent par les services publics fédéraux
geo.admin.ch, qui ne demandent aucune clé.

## Ce qui demande une clé, et reste facultatif

| Fonction | Variable | Sans la clé |
| --- | --- | --- |
| Assistant IA (état depuis la photo, analyse, import CECB) | `ANTHROPIC_API_KEY` dans `server/.env` | L'assistant répond qu'il est indisponible, le reste fonctionne |
| Fonds de carte sans filigrane | `VITE_CARTO_KEY` dans `.env.local` | Les tuiles portent la mention « API KEY REQUIRED » |
| Envoi d'emails (invitations, mot de passe oublié) | `SMTP_*` dans `server/.env` | Le lien est affiché à l'écran au lieu d'être envoyé |
| Connexion Google | `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` | Le bouton Google n'apparaît pas |

Pour la carte, copiez `.env.local.example` en `.env.local` à la racine et
renseignez la clé. Elle est gratuite et s'obtient sans compte sur
https://carto.com/basemaps/apikey/.

---

## Structure du dépôt

```
src/                 application React
  pages/app/         les écrans du produit (diagnostic, coûts, rapports, plans...)
  pages/marketing/   la page publique
  lib/               métrés automatiques, export, animations, appels API
server/              API Express
  src/routes/        les endpoints, un fichier par domaine
  src/lib/           environnement, prisma, journalisation, calculs partagés
  prisma/            schéma de la base et données de départ
```

## Commandes utiles

À la racine (front) :

| commande | effet |
| --- | --- |
| `npm run dev` | application en développement, rechargement à chaud |
| `npm run build` | construit `dist/` pour la mise en ligne |
| `npm run lint` | vérifie le style et les erreurs de typage |
| `npx vitest run` | lance les tests |

Dans `server/` :

| commande | effet |
| --- | --- |
| `npm run dev` | API en développement |
| `npm run db:up` / `db:down` | démarre ou arrête MySQL via Docker |
| `npx prisma db push` | applique le schéma à la base |
| `npm run db:seed` | charge le catalogue de départ |
| `npm run db:studio` | ouvre une interface web pour explorer la base |
| `npm run lint` | vérification de types |

Le détail de l'API est dans [server/README.md](server/README.md).

---

## En cas de blocage

**`Invalid environment configuration` au lancement de l'API.** Un des deux secrets
JWT fait moins de 32 caractères, ou `DATABASE_URL` est absente. Le message liste la
variable en cause.

**`Can't reach database server`.** MySQL n'est pas démarré. Avec Docker :
`npm run db:up` depuis `server/`.

**L'application se charge mais le catalogue est vide.** Le seed n'a pas tourné :
`npm run db:seed` depuis `server/`.

**La page reste blanche.** Vérifiez que l'API tourne bien dans son terminal :
http://localhost:4000/health doit répondre.
