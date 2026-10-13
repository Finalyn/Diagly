# Diagly

Diagnostic de bâtiment et planification de rénovation, pour la Suisse romande.

On relève l'état d'un immeuble pendant la visite, ouvrage par ouvrage et étape
par étape. L'application propose un état à partir de la photo, calcule les
métrés, applique les prix de la base CFC du bureau et sort un rapport structuré
par codes CFC, chiffré en francs.

Front en React 19 + TypeScript + Vite + Tailwind v4. API en Node + Express +
Prisma sur MySQL 8. L'app iPhone et iPad est ce même front, embarqué par
Capacitor 8 ([APP-IOS.md](APP-IOS.md)). La mise en production est décrite dans
[DEPLOIEMENT.md](DEPLOIEMENT.md).

---

## Bêta

### Ce qui est prêt à tester

- **Le site**, https://diagly.ch. Sur ordinateur, l'app complète. Sur
  téléphone (sous 768 px), la version de terrain : liste des diagnostics,
  relevé, sommaire du dossier (fiche, visite, étiquette énergétique, coûts,
  photos, rapports), base de données, paramètres, assistant.
- **L'app iPhone** : la version de terrain, en portrait, avec la barre du bas
  native (Liquid Glass sur iOS 26), la connexion Apple et Google, les
  notifications, la suppression du compte et le relevé sans réseau.
- **L'app iPad** : l'app complète, menu de gauche repliable ; dans l'éditeur du
  relevé, un panneau à la fois.

Le site et l'app partagent le même serveur et les mêmes comptes. Points
récents à éprouver :

- « Suivant » dans l'éditeur : devant un élément pas encore relevé, il demande
  s'il est présent ou absent, et ne crée un relevé que s'il est présent ;
- le Guide IA : il propose un état d'après la photo, mais refuse d'évaluer une
  photo inutilisable (capture d'écran, sujet sans rapport, image floue ou
  sombre, autre élément que celui choisi) et propose de la supprimer ;
- le relevé sans réseau : « Préparer pour le terrain » dans le sommaire du
  dossier, puis saisir sans connexion ; les saisies partent au retour du
  réseau, même après la fermeture de l'app ;
- les rappels d'absence : après une semaine, puis trois, sans venir, une
  notification nomme le dossier en cours (en semaine, le matin ; réglable dans
  Paramètres, Notifications).

### Installer l'app (testeurs)

1. L'équipe vous ajoute au groupe de test TestFlight de Diagly, dans App Store
   Connect. Vous recevez une invitation par email.
2. Installez l'app **TestFlight** depuis l'App Store, sur l'iPhone ou l'iPad
   (iOS 15 au minimum).
3. Ouvrez l'invitation, puis installez Diagly depuis TestFlight. Les versions
   suivantes y apparaissent d'elles-mêmes.
4. Connectez-vous avec votre compte diagly.ch, ou avec Apple ou Google : l'app
   travaille sur les données de production.

### Limites connues

- Pas d'app Android : le projet natif n'existe que pour iOS.
- Sur téléphone, le tableau de bord, les plans, les variantes, le calendrier,
  les intégrations et les prestataires restent sur ordinateur ou iPad : leurs
  adresses ramènent à la liste des diagnostics.
- Affichent « Bientôt disponible » : le parc immobilier (bâtiments,
  appartements), la liste globale des plans (`/app/plans`), le détail d'un
  rapport (`/app/reports/:id`) et les appels d'offres. Les plans se travaillent
  dans le dossier, onglet Plans.
- Le calendrier n'a plus d'entrée dans les menus : le calendrier global
  (`/app/planning`, vue mois) ne s'ouvre que par son adresse ou par un rappel
  de visite, et ce rappel, touché sur téléphone, ramène à la liste des
  diagnostics. L'échéancier du dossier (`/calendrier`) n'enregistre rien.
- Sans réseau, seuls les relevés (créer, modifier, supprimer) sont gardés et
  envoyés plus tard. La fiche du bâtiment, la visite, les plans et les
  rapports demandent le réseau. « Préparer pour le terrain » n'embarque pas
  les plans, et ce qui est gardé sur l'appareil n'est relu que sept jours.
- L'app embarque son front : une correction du site n'atteint l'iPhone et
  l'iPad qu'à la version TestFlight suivante.
- Aucun paiement en ligne n'est branché ; dans l'app, la section Facturation
  des paramètres est masquée.
- L'assistant IA accepte 40 demandes par tranche de 10 minutes et par
  personne.
- Une demande de support part par email à l'équipe ; les réponses ne
  s'écrivent pas depuis l'app.

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
fonctionne tel quel en local. La liste complète des variables est dans
[server/README.md](server/README.md).

### 4. Créer les tables et charger le catalogue

```bash
npm install
npx prisma db push
npm run db:seed
```

Le seed charge 645 entrées de la nomenclature CFC et les 113 postes de
l'ancien catalogue, puis crée un premier compte si la base n'en a aucun. Il est
sans effet s'il est relancé sur une base déjà remplie.

> Le dépôt ne contient pas de dossier `prisma/migrations` : le schéma est appliqué
> avec `prisma db push`, pas avec `prisma migrate`.

L'éditeur du relevé lit la **base CFC v3** (articles, prix par état, étapes de
visite, postes automatiques), que le seed ne charge pas. Elle s'importe depuis
le classeur Excel du bureau, qui n'est pas dans ce dépôt public (voir
[server/README.md](server/README.md), « La base CFC v3 »). Sans elle, la liste
des ouvrages de l'éditeur reste vide.

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

Le seed crée un compte administrateur, `contact@finalyn.com`, avec le mot de
passe de départ écrit dans `server/prisma/seed.ts`. Ce dépôt étant public, ce
mot de passe l'est aussi : changez-le depuis les paramètres si vous exposez
votre installation ailleurs que sur votre machine.

---

## Ce qui marche sans rien de plus

Le diagnostic (une fois la base CFC v3 importée), les métrés, les coûts, les
variantes, les rapports, les exports et la recherche d'adresse fonctionnent dès
l'installation. La recherche d'adresse et le registre des bâtiments passent par
les services publics fédéraux geo.admin.ch, qui ne demandent aucune clé.

## Ce qui demande une clé, et reste facultatif

| Fonction | Variable | Sans la clé |
| --- | --- | --- |
| Assistant IA (état depuis la photo, conversation, lecture d'un document ou d'un CECB) | `ANTHROPIC_API_KEY` dans `server/.env` | L'assistant répond qu'il est indisponible, le reste fonctionne |
| Fonds de carte sans filigrane | `VITE_CARTO_KEY` dans `.env.local` | Les tuiles portent la mention « API KEY REQUIRED » |
| Envoi d'emails (invitations, mot de passe oublié, notifications, support) | `SMTP_*` dans `server/.env` | Une invitation donne un lien à copier ; le lien de mot de passe oublié part dans le journal du serveur |
| Connexion Google | `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` | Le bouton reste affiché, la connexion répond « Connexion Google non disponible pour le moment » |
| Notifications push du navigateur | `VAPID_PUBLIC_KEY` et `VAPID_PRIVATE_KEY` | Pas de push ; la cloche fonctionne |
| Notifications sur l'iPhone et l'iPad | `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Pas de notification dans l'app ; la connexion Apple fonctionne |

Pour la carte, copiez `.env.local.example` en `.env.local` à la racine et
renseignez la clé. Elle est gratuite et s'obtient sans compte sur
https://carto.com/basemaps/apikey/.

---

## Structure du dépôt

```
src/                 application React (site et app iPhone/iPad)
  pages/app/         les écrans du produit (relevé, coûts, rapports, plans...)
  pages/auth/        connexion, inscription, mot de passe oublié
  pages/marketing/   la vitrine publique
  components/        composants partagés (layout, rapports, plans, Guide IA...)
  lib/               calculs (base CFC, devis, métrés), appels API, natif
  lib/hors-ligne/    file d'envoi des relevés sans réseau
  stores/            état global (session, menu de gauche...)
server/              API Express
  src/routes/        les endpoints, un fichier par domaine
  src/lib/           environnement, prisma, notifications, IA, calculs partagés
  prisma/            schéma de la base, données de départ, import de la base CFC
ios/                 projet natif de l'app iPhone/iPad (Capacitor 8)
scripts/             mise en production (publier-production.mjs)
.github/workflows/   compilation de l'app iOS et envoi TestFlight
```

## Commandes utiles

À la racine (front) :

| commande | effet |
| --- | --- |
| `npm run dev` | application en développement, rechargement à chaud |
| `npm run build` | vérifie les types (`tsc -b`) et construit `dist/` pour la mise en ligne |
| `npm run build:app` | construit le front de l'app iPhone/iPad et le copie dans `ios/` (`cap sync ios`) |
| `npm run lint` | vérifie le code avec ESLint |
| `npx vitest run` | lance les tests (front et serveur) |

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

**L'éditeur du relevé ne propose aucun ouvrage.** La base CFC v3 n'est pas
importée (étape 4).

**La page reste blanche.** Vérifiez que l'API tourne bien dans son terminal :
http://localhost:4000/health doit répondre.
