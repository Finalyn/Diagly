# DIAGLY : spécifications techniques

Application web et iPhone/iPad pour les professionnels du bâtiment en Suisse (directeurs de travaux, régies immobilières, architectes) et les particuliers. Relevé de l'état d'un bâtiment sur le terrain, ouvrage par ouvrage selon les codes CFC suisses, métrés automatiques, coûts, variantes, rapports, plans PDF annotés.

Ce document décrit le code tel qu'il est. La description fonctionnelle est dans `Description.md`, l'installation dans `README.md`, l'API en détail dans `server/README.md`, l'app native dans `APP-IOS.md`, la mise en ligne dans `DEPLOIEMENT.md`.

---

## STACK

### Front (`src/`)
- React 19 + TypeScript strict, Vite
- Tailwind CSS v4 (variables `@theme`), composants UI maison
- React Router 7 (pages chargées à la demande)
- TanStack Query 5, cache persisté dans IndexedDB (sept jours)
- Zustand (session, menu de gauche)
- Recharts (graphiques), Leaflet (carte), pdfjs-dist (plans PDF), jsPDF + jspdf-autotable (PDF des coûts)
- Lucide React (icônes, aucun emoji dans l'UI)
- PWA sur le web (service worker `public/sw.js`, absent de l'app native)

### App iPhone et iPad (`ios/`)
- Capacitor 8 : le front embarqué, servi depuis `capacitor://localhost`, API sur `https://diagly.ch`
- Plugins Capacitor : app, filesystem, keyboard, network, push-notifications, splash-screen, status-bar
- Plugins Swift maison : `ImpressionPlugin` (feuille d'impression), `ConnexionPlugin` (Apple, fenêtre sécurisée pour Google), `BarreOngletsPlugin` (barre du bas native, Liquid Glass sur iOS 26)
- iOS 15 minimum ; iPhone en portrait, iPad dans toutes les orientations
- Compilation et envoi TestFlight par GitHub Actions (macOS)

### Serveur (`server/`)
- Node.js 20+ + Express 4 + TypeScript
- Prisma 5 + MySQL 8 (utf8mb4), schéma appliqué par `prisma db push` (pas de migrations)
- zod (validation), JWT (accès 15 min, rafraîchissement 7 jours, renouvelé à chaque usage), bcrypt, otplib (2FA)
- helmet, CORS, express-rate-limit, compression, pino
- multer (plans, pièces jointes), exceljs (exports), mammoth (lecture des .docx)
- Nodemailer, web-push (navigateur), APNs (iPhone/iPad, `src/lib/apple.ts`)
- swagger-ui-express et zod-to-openapi (API publique), SDK MCP
- IA : appels HTTP directs à l'API d'Anthropic

### Organisation du dépôt
Un seul dépôt, sans espaces de travail : le front à la racine, le serveur dans `server/` (son propre `package.json`), le projet natif dans `ios/`. La production suit un second dépôt, privé, `Finalyn/diagly-deploy`, alimenté par `scripts/publier-production.mjs`.

---

## DESIGN

UI sobre, professionnelle et claire. Icônes Lucide React (SF Symbols dans la barre native de l'iPhone). Aucun emoji. Textes en français (Suisse romande). Montants en CHF au format `fr-CH`. Dates au format « 9 avril 2026 ». Police Inter.

Couleur principale presque noire (`#1d1d1f`) ; l'éditeur du relevé passe au bleu Diagly (`#0167ea`). Barres en verre sur téléphone.

Couleurs sémantiques :
- Priorité I : rouge
- Priorité II : orange
- Priorité III : vert
- État Mauvais : rouge, Moyen : orange, Bon : vert clair, Très bon : vert

Mise en page :
- sous 768 px (téléphone) : version de terrain, barre du bas, un panneau à la fois ;
- au-dessus : l'app complète, menu de gauche repliable ;
- tablette (écran tactile d'au moins 768 px) : l'éditeur du relevé passe à un panneau à la fois et replie le menu d'office.

---

## SCHÉMA PRISMA

Source : `server/prisma/schema.prisma`. Modèles principaux :

```
Auth et comptes
  User            email, passwordHash, role (DT | REGIE | ARCHITECT | PARTICULIER | ADMIN, défaut PARTICULIER),
                  twoFactorEnabled/Secret/Method (TOTP | EMAIL), appleSub, appleRefreshToken,
                  organizationId + orgRole, preferences (JSON, défaut {}), vuLe (dernière visite)
  RefreshToken    jeton haché, expiration, révocation
  Organization    name, slug, ownerId ; OrgInvitation (email, rôle, jeton, expiration)
  OrgRole         OWNER | ADMIN | MEMBER | VIEWER

Domaine
  Operation       regroupe plusieurs Project d'un chantier (aggregationMode TOTAL | PER_BUILDING)
  Project         le dossier : adresse, NPA, ville, canton, parcelle, buildingType, roofType,
                  yearBuilt, renovationYear, nbApartments, renovatedApartments, apartmentTypes,
                  nbFloors, floorHeight, nbStaircases, surfaces, windowPct (30), honoraryPct (12),
                  reservePct (10), status, données énergétiques, géographie (east, north, egid,
                  egrid), shareToken, reportBranding, visitPlan
  ProjectContact  interlocuteurs de la visite ; ProjectMail : mails envoyés
  Diagnostic      visitDate, status (DRAFT | IN_PROGRESS | COMPLETED), notes
  DiagnosticItem  le relevé : cfcCode, cfcLabel, articleId + etapeNumero, localisation
                  (COMMUNS | LOGEMENTS), state (TRES_BON | BON | MOYEN | MAUVAIS, null = pas évalué),
                  priority (I | II | III), notes, works (JSON), photos (JSON, data URL), area,
                  sharePct, quantityManual, costManual, costIndex, unit, yearInstalled,
                  interventionYear, estimatedCost, improvement(+Cost), norms(+Cost)
  ProjectVariant  variante nommée ; VariantLine : remplace un relevé (replacesItemId) ou ajoute un travail
  Plan            fichier sur disque, scalePxPerM, annotations (JSON) ; PlanBoard : atelier (inutilisé)
  Event           calendrier (VISITE | REUNION | TRAVAUX | ECHEANCE | APPEL | AUTRE), reminderSentAt
  Partner         annuaire des prestataires ; PartnerRequest : demandes de mise en relation

Base CFC v3
  CfcNomenclature    SN 506 500, quatre niveaux, code texte
  Article            id du classeur (A005), cfcCode, nom, domaineRapport, groupeAlternatives,
                     echafaudage, unités, baseQuantite, coefficient, articleLieId, actif
  ArticleEtat        par état (tres_bon | bon | moyen | mauvais | amelioration | normes) :
                     travaux, prix, partPrixMauvais (état moyen), unité (m2 | ml | pce | forfait)
  EtapeVisite        les sept étapes ; ArticleEtape : article × étape, ordre
  PosteAutomatique   postes du devis non relevés (déclencheur, règle de quantité, prix)
  ArticleHistorique  toute modification d'un article, avec son auteur

Ancien catalogue (seed, encore lu)
  CfcCatalogEntry, CatalogItem (prix par état en texte, personnalisables par compte)

Notifications et appareils
  Notification      type, titre, texte, url, clé de regroupement unique par compte, lueLe
  PushSubscription  navigateur (Web Push) ; AppareilPush : jeton APNs d'un iPhone ou iPad

Support et API
  SupportTicket, SupportMessage ; ApiKey, ApiAccessLog ; WebhookEndpoint, WebhookDelivery
```

Une contrainte `UNIQUE` ajoutée fait poser une question à `prisma db push`, ce qui fait échouer le build de production : `users.apple_sub` n'en a donc pas.

---

## ROUTES API

Toutes sous `/api`, authentifiées par `Authorization: Bearer <accessToken>` sauf mention. Détail dans `server/README.md`.

```
GET    /health                                  public

POST   /api/auth/register | login | refresh | logout
GET    /api/auth/me            PUT /api/auth/me            PUT /api/auth/preferences
POST   /api/auth/change-password | forgot-password | reset-password
GET    /api/auth/2fa/options   POST /api/auth/2fa/setup | enable | disable | verify | resend
POST   /api/auth/2fa/email/code | email/enable
GET    /api/auth/google        GET /api/auth/google/callback      (?app=1 depuis l'app)
POST   /api/auth/apple                                             (app iPhone/iPad)
GET    /api/auth/apple/web     POST /api/auth/apple/web/retour    (site, retour Apple en form_post)
GET    /api/auth/fournisseurs                                      (site : { google, apple } selon la configuration)
POST   /api/auth/compte/supprimer

GET    /api/cfc/base           GET /api/cfc/base/nomenclature
GET    /api/cfc/base/articles/:id/historique
PUT    /api/cfc/base/articles/:id      POST /api/cfc/base/articles      PUT /api/cfc/base/postes/:code
GET    /api/cfc/catalog[/:code]  GET /api/cfc/items[/:id]  GET /api/cfc/categories
POST   /api/cfc/items  POST /api/cfc/items/reset  PUT|DELETE /api/cfc/items/:id

GET|POST          /api/projects
GET|PUT|DELETE    /api/projects/:id
POST|DELETE       /api/projects/:id/share
GET|POST          /api/projects/:id/diagnostics

GET               /api/diagnostics/recent-items
GET|PUT|DELETE    /api/diagnostics/:id
GET|POST          /api/diagnostics/:id/items        (POST : id UUID facultatif, création idempotente)
POST              /api/diagnostics/:id/reindex
GET|PUT|DELETE    /api/diagnostics/items/:itemId

GET|POST /api/operations     GET|PUT|DELETE /api/operations/:id
GET|POST /api/variants/projects/:projectId    PUT|DELETE /api/variants/:id
POST /api/variants/:id/lines   PUT|DELETE /api/variants/lines/:lineId
GET|POST /api/plans          PUT|DELETE /api/plans/:id
GET|POST /api/boards         GET|PUT|DELETE /api/boards/:id
GET|POST /api/events         PUT|DELETE /api/events/:id
GET /api/visite/:projectId   PUT /api/visite/:projectId/plan
POST /api/visite/:projectId/contacts   PUT|DELETE /api/visite/contacts/:id
POST /api/visite/:projectId/mails

POST /api/assistant/chat | vision | analysis-chat | cecb-import
POST /api/demarrage/document | cecb
GET  /api/geo/affectation
GET  /api/notifications      PUT /api/notifications/:id/lue   PUT /api/notifications/lues
DELETE /api/notifications/:id
GET  /api/push/vapid (public)   POST /api/push/subscribe | unsubscribe | appareil | appareil/retirer | test
GET  /api/export/default-template   GET|POST /api/export/projects/:id   (json | csv | xlsx)
GET|POST /api/org   PUT /api/org   GET /api/org/members   PUT|DELETE /api/org/members/:userId
GET|POST /api/org/invitations   DELETE /api/org/invitations/:id
GET /api/org/invitations/token/:token   POST /api/org/invitations/token/:token/accept
GET /api/partenaires/config   GET|POST /api/partenaires   PUT|DELETE /api/partenaires/:id
POST /api/partenaires/:id/offre   POST /api/partenaires/:id/demandes
GET /api/partenaires/demandes   PATCH /api/partenaires/demandes/:id   GET /api/partenaires/admin/demandes
POST /api/support/attachments   GET|POST /api/support/tickets   GET /api/support/tickets/:id
POST /api/support/tickets/:id/messages
GET|POST /api/api-keys   DELETE /api/api-keys/:id
GET /api/webhooks/events   GET|POST /api/webhooks   PUT|DELETE /api/webhooks/:id
POST /api/webhooks/:id/rotate-secret | :id/test   GET /api/webhooks/:id/deliveries
POST /api/webhooks/deliveries/:deliveryId/replay

Publics, sans jeton
GET  /api/market/index        GET /api/vitrine/annee        GET /api/share/:token

Par clé d'API (Authorization: Bearer <clé> ou X-API-Key), lecture seule
GET  /api/v1/diagnostics[/:id[/elements | /costs | /work-plan]]
GET  /api/v1/buildings[/:id]
GET  /api/v1/portfolio/summary | elements | costs | work-plan
GET  /api/v1/openapi.json   /api/v1/docs                   (publics)
POST /api/mcp                                              (serveur MCP)
```

Fichiers : `GET /uploads/<fichier>?t=<jeton signé>`, jeton délivré par l'API, valable 30 jours.

---

## ROUTES WEB (React Router, `src/App.tsx`)

```
/                          vitrine (dans l'app native : redirige vers /app)
/bientot                   page « bientôt disponible », pour fermer le site le temps d'une intervention
/landing, /landing-2       anciennes vitrines, liées de nulle part
/landing-3                 redirige vers /
/dashboard                 redirige vers /app/dashboard
/share/:token              rapport partagé, lecture seule, sans compte
/preview                   maquette de démonstration, sans compte
/login, /oauth-callback, /register, /forgot-password, /reset-password/:token, /onboarding
/register/payment          écran de paiement sans effet (dans l'app native : redirige vers /app)

/app                       liste des diagnostics sur téléphone, tableau de bord ailleurs
/app/dashboard             Accueil
/app/projects              Diagnostics
/app/projects/new          nouveau diagnostic
/app/projects/:id          ouvre le relevé
/app/projects/:id/diagnostic   le relevé (éditeur), dans le dossier
/app/projects/:id/fiche | edit | visite | plans | cecb | couts | variantes | photos | rapports
/app/projects/:id/calendrier   échéancier du dossier (sans enregistrement)
/app/projects/:id/sommaire     sommaire du dossier sur téléphone
/app/diagnostic/:id        le relevé ouvert seul ; /app/diagnostic/:id/item/:itemId y redirige
/app/metres                Métrés : déposer un jeu de plans, liste des métrés (un par dossier qui a des plans)
/app/metres/:projectId     espace de travail des Métrés, plein écran (feuilles, plan, quantités) ;
                           /app/plans et /app/plans/:id y mènent
/app/assistant             Assistant IA
/app/cfc                   Base de données
/app/planning              calendrier global
/app/settings              Paramètres (?s=<section>) ; /app/team redirige vers ses membres
/app/integrations          clés d'API, webhooks, MCP
/app/prestataires          annuaire et demandes
/app/join/:token           accepter une invitation
/app/support, /app/support/new, /app/support/:id, /app/support/doc/:slug, /app/support/tuto/:slug

Bientôt disponible (écran d'attente)
/app/buildings[/new | /:id | /:id/apartments/new | /:id/apartments/:aptId]
/app/reports/:id   /app/tenders/:id
```

Sur téléphone, seules sont ouvertes : la liste et la création, le dossier (sommaire, fiche, visite, photos, coûts, étiquette énergétique, rapports, relevé), l'éditeur, la base de données, les Métrés (en lecture : quantités et état des feuilles), l'assistant, les paramètres, l'aide et l'invitation. Toute autre adresse ramène à `/app/projects` (`AppLayout.tsx`).

---

## CONTENU DES PAGES PRINCIPALES

### /app/dashboard (Accueil)
- Carte « Reprendre » sur le dernier dossier modifié : statut, relevés, urgents, coût estimé HT, date de visite, bouton « Reprendre le relevé »
- Accès rapides : Nouveau diagnostic, Mes diagnostics, Base de données, Assistant
- Activité récente

### /app/projects (Diagnostics)
- Dossiers et opérations, recherche, filtre par type de bâtiment
- Onglets Tous / En cours / À traiter / Terminés / Archivés, pagination, colonnes réglables, cartes sur téléphone

### /app/projects/new
- Point de départ : de zéro, un document (PDF, docx, xlsx, csv, txt) ou un CECB en PDF, lus par l'IA pour pré-remplir
- Étapes : Informations (adresse par geo.admin, registre des bâtiments), Surfaces, Récapitulatif
- Bâtiments supplémentaires possibles (opération)

### /app/projects/:id/diagnostic (le relevé)
- Parcours en sept étapes de visite (Façade, Cage d'escalier, Structure, Locaux techniques, Appartements, Aménagements extérieurs, Autres), ouvrages rangés par étape puis par code CFC
- Fiche d'un ouvrage : photos, état, priorité, travaux, notes, quantité, coûts, amélioration et normes, Guide IA
- « Suivant » : ouvre l'ouvrage d'après ; pas encore relevé, il demande « présent ou absent » avant de créer quoi que ce soit
- Récapitulatif des oublis (photo, quantité)
- Sur téléphone et tablette : un panneau à la fois

### /app/projects/:id/couts
- Postes par priorité I, II, III ; synthèse HT, honoraires, réserve, TVA, total ; taux modifiables ; export PDF et données

### /app/projects/:id/variantes
- Variantes nommées, lignes qui remplacent ou ajoutent, comparaison avec le diagnostic de base

### /app/projects/:id/plans
- Import PDF ou image, aperçu, éditeur : étalonner, mesurer, dessiner, flèche, note, zone, calque de référence ; zone rattachable à un ouvrage ; quantités depuis les plans ; export

### /app/projects/:id/rapports
- Rapports Complet, Rapport, De l'existant, Rapports photo ; personnalisation logo et couleur par dossier ; impression PDF ; export ; lien de partage

### /app/projects/:id/cecb (Étiquette énergétique)
- Estimation A à G d'après les ouvrages ou l'année ; import d'un CECB en PDF par l'IA, validé par l'utilisateur

### /app/projects/:id/visite
- Interlocuteurs, rendez-vous (recopié au calendrier), préparation, mails pré-remplis dont l'avis aux locataires

### /app/cfc (Base de données)
- Onglets Articles et prix, Postes de chantier, Honoraires et TVA ; arborescence CFC, contrôles de cohérence, export Excel, fiche d'article avec historique ; écriture réservée aux responsables

### /app/settings
- Mon compte : Profil, Sécurité (mot de passe, 2FA), Notifications, Compte (déconnexion, suppression du compte)
- Mon travail : Entreprise, Personnalisation (logo et couleur des rapports), Facturation (masquée dans l'app native)
- Mon organisation : Membres, Invitations, Rôles et droits

---

## APP IPHONE ET IPAD

Pas d'écrans propres : le même front, avec des comportements propres à l'app (`src/lib/plateforme.ts`, `src/lib/natif.ts`) :
- iPhone : version de terrain, barre du bas native : au centre trois boutons hors dossier (Diagnostics, Base de données, Paramètres) ou deux dans un dossier (Relevé, Dossier) ; à gauche, dans un dossier, le retour à la liste ; à droite, toujours, l'Assistant ;
- iPad : l'app complète ;
- connexion Apple et Google par les fenêtres d'iOS ; suppression du compte ;
- notifications APNs, permission demandée après la première connexion ;
- pas de vitrine, pas de paiement, pas de section Facturation, pas de service worker.

### Hors ligne
- File d'envoi des relevés (`src/lib/hors-ligne/`) : créer, modifier, supprimer ; écrite sur l'appareil avant tout, envoyée dans l'ordre, une à la fois, avec relances (5 s à 60 s)
- Identifiant du relevé créé sur l'appareil (UUID) ; création idempotente côté serveur (renvoi : 200 avec le relevé existant ; identifiant pris ailleurs : 409)
- Les lectures superposent la file aux réponses du serveur
- « Préparer pour le terrain » charge le dossier, sa visite et la base CFC ; les plans n'y sont pas
- Les autres écritures demandent le réseau

---

## LOGIQUE MÉTIER

Fichiers : `src/lib/base-cfc/` (base v3 : quantités, prix, postes, étapes, devis par CFC), `src/lib/devis.ts` (devis et cascade), `src/lib/formulas.ts` et `src/lib/diagnostic-auto.ts` (ancien calcul, encore utilisé par les variantes et une partie des rapports), `server/src/lib/market.ts` (coefficient marché).

### Quantités (base v3)
```
quantité = valeur de la base de l'article × coefficient (2 décimales)
façade   = périmètre × étages × hauteur d'étage (2,7 m par défaut), sinon facadeArea
fenêtres = façade × part vitrée ; façade moins fenêtres = max(0, façade − fenêtres)
pièces d'eau = logements × 2 ; portes d'entrée = cages
règles nommées : stores (par typologie), eaux pluviales (descentes selon la surface bâtie × hauteur),
                 sprinklers (surface de parking, sinon surface bâtie)
une quantité saisie à la main (quantityManual) n'est plus recalculée
```

### Prix et coûts
```
prix unitaire = prix de l'état ; état moyen = part fixe + part × prix mauvais
montant       = quantité × prix unitaire
devis         = réparation + mise aux normes + postes automatiques ; amélioration en option, hors total
honoraires    = HT × honoraryPct / 100
réserve       = (HT + honoraires) × reservePct / 100
TVA           = (HT + honoraires + réserve) × 0,081
un coût forcé à la main (costManual) n'est plus recalculé
```

### Postes automatiques (`src/lib/base-cfc/postes.ts`)
- 121 Protection des ouvrages existants : forfait, toujours
- 211.1 Échafaudage de façade : dès qu'un ouvrage marqué « échafaudage » est chiffré
- 285.0 Échafaudage de cage : par cage, si un mur ou un plafond de la cage d'escalier est en mauvais état
- 287 Nettoyage : toujours, sur la surface de plancher

### Plan de travaux
```
année d'intervention (si non saisie) : I = année de base, II = +5, III = +10, sans priorité = +5
horizons affichés : « 0 à 5 ans », « 5 à 10 ans », « au-delà de 10 ans »
```

### Coefficient marché
```
coefficient = DIAGLY_MARKET_INDEX / DIAGLY_BASE_INDEX (1 par défaut)
POST /api/diagnostics/:id/reindex : coûts × coefficient courant / costIndex de la ligne
  (1,123 pour les lignes écrites avant la colonne), sauf coûts forcés à la main
```

### Étiquette énergétique
- Estimation indicative, toujours présentée comme telle ; remplacée par les valeurs d'un CECB importé

---

## RAPPORTS

Rendu à l'écran en pages A4 (`src/components/report/`), imprimé en PDF par le navigateur ou la feuille d'impression d'iOS. Pas de génération PDF côté serveur.
- Complet, Rapport, De l'existant, Rapports photo
- Apparence : celle du bureau (Paramètres, Personnalisation), ou propre au dossier (`reportBranding`)
- Partage : `/share/:token`, mise en page fixe en lecture seule, sans les notes internes
- Coûts : PDF dédié (`src/lib/export-costs.ts`) ; données : Excel, CSV, JSON (`server/src/routes/export.ts`)

---

## INTÉGRATIONS

### geo.admin
```
api3.geo.admin.ch : autocomplétion d'adresse, registre des bâtiments (EGID), parcelle (EGRID)
```

### Cadastres RDPPF
```
GET /api/geo/affectation : affectation de la parcelle pour Vaud et Genève, appelée côté serveur
```

### Fonds de carte
```
CARTO, clé publique VITE_CARTO_KEY inscrite au build
```

### Anthropic
```
assistant, Guide IA, lecture de documents et de CECB ; modèle par ANTHROPIC_MODEL
```

### API publique, webhooks, MCP
```
API v1 en lecture seule par clé d'API (120 requêtes par minute et par clé)
Webhooks : diagnostic.finalise, rapport.genere, element.modifie, plan_travaux.mis_a_jour,
           signés HMAC-SHA256 (X-Diagly-Signature), six tentatives, rejeu
MCP : portfolio_summary, search_diagnostics, get_diagnostic, query_elements, aggregate_costs, work_plan
```

---

## SEED (`server/prisma/seed.ts`)

- Un compte ADMIN `contact@finalyn.com`, créé seulement si la base n'a aucun compte
- 645 entrées de l'ancienne nomenclature CFC et 113 postes de l'ancien catalogue (`seed-data.json`), seulement si le catalogue est vide
- La base CFC v3 n'est pas dans le seed : elle s'importe depuis le classeur du bureau (`server/prisma/base-cfc/importer.ts`), privé

---

## VARIABLES D'ENVIRONNEMENT

Serveur (`server/src/lib/env.ts`, liste commentée dans `server/README.md`) :

```env
DATABASE_URL=            # obligatoire
JWT_ACCESS_SECRET=       # obligatoire, 32 caractères min.
JWT_REFRESH_SECRET=      # obligatoire, 32 caractères min.
NODE_ENV=development
PORT=4000
CORS_ORIGIN=http://localhost:5173
APP_URL=http://localhost:4000
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
BCRYPT_ROUNDS=12
API_KEY_PEPPER=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
SUPPORT_EMAIL=
FINALYN_ADMINS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
APPLE_BUNDLE_ID=ch.diagly.app
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=       # contenu du .p8 en base64
APPLE_SERVICES_ID=       # connexion Apple sur le site (Services ID, ex. ch.diagly.web)
APNS_SANDBOX=false
STATIC_DIR=              # lu hors de env.ts : dossier du front construit
DIAGLY_BASE_INDEX=       # lus hors de env.ts : coefficient marché
DIAGLY_MARKET_INDEX=
DIAGLY_MARKET_INDEX_DATE=
DIAGLY_MARKET_INDEX_SOURCE=
DIAGLY_LEGACY_COST_INDEX=
```

Front (`.env.local`, inscrites au build) :

```env
VITE_API_URL=            # vide : même origine en production, localhost:4000 en dev, https://diagly.ch pour l'app
VITE_CARTO_KEY=
VITE_BASE=               # sous-chemin éventuel du site
```

---

## ÉTAT

Construit : comptes (2FA, Google, Apple, suppression), organisations, dossiers et opérations, relevé par étapes avec Guide IA, hors ligne pour les relevés, base CFC v3 éditable, coûts, variantes, plans annotés, étiquette énergétique, visite, rapports et partage, exports, notifications (cloche, push, email, APNs), prestataires, support, API publique, webhooks, MCP, app iPhone et iPad.

Pas construit : parc immobilier, appels d'offres, paiement en ligne, app Android.

---

## COMMANDES

```bash
npm install && npm run dev                 # front, http://localhost:5173
npm run build                              # tsc -b + build web dans dist/
npm run build:app                          # front de l'app + cap sync ios
npm run lint                               # ESLint
npx vitest run                             # tests (front et serveur)

cd server
npm install && npm run db:up               # MySQL par Docker
npx prisma db push                         # schéma
npm run db:seed                            # premier compte et ancien catalogue
npm run dev                                # API, http://localhost:4000

node scripts/publier-production.mjs [--pousser]   # mise en ligne (DEPLOIEMENT.md)
```

---

## RÈGLES GÉNÉRALES

- Aucun emoji dans l'UI, aucun tiret cadratin dans ce qui s'affiche
- Icônes Lucide React uniquement côté web
- Tous les textes en français
- Montants : CHF au format suisse romand
- Dates : « 9 avril 2026 »
- Erreurs de formulaire : messages clairs en français
- Diagnostic toujours modifiable, aucune donnée figée
- Une écriture faite sur le terrain passe par la file d'envoi (`saisir()`), jamais par un appel direct
- L'API reste compatible avec les versions installées de l'app : on ajoute, on ne retire qu'après une version qui ne s'en sert plus
