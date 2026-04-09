# DIAGLY — Spécifications techniques

Application SaaS web + mobile pour les professionnels du bâtiment en Suisse (directeurs de travaux, régies immobilières, architectes). Diagnostic de bâtiment terrain via smartphone, gestion de projets de rénovation, calcul de métrés automatique selon codes CFC suisses, visualisation de plans PDF, CRM parc immobilier.

---

## STACK

### Frontend web
- React 18 + TypeScript strict
- Vite
- Tailwind CSS + shadcn/ui
- React Router v6
- Zustand (state global)
- TanStack Query (fetching + cache)
- React Hook Form + Zod (formulaires)
- Recharts (graphiques)
- react-pdf (visualisateur plans)
- Konva.js (annotations + mesures sur plans)
- Framer Motion (animations)
- Lucide React (icônes — aucun emoji dans l'UI)

### Backend
- Node.js + Express + TypeScript
- Prisma ORM + PostgreSQL
- JWT (access 15min + refresh 7j)
- Multer (upload fichiers)
- Sharp (traitement images)
- pdf-lib (génération rapports PDF)
- Nodemailer (emails)
- Stripe (abonnements)

### Mobile
- React Native + Expo
- Monorepo partagé avec le web
- Offline-first + sync réseau
- expo-camera, expo-sqlite

### Infrastructure
- Monorepo pnpm workspaces
- apps/web, apps/mobile, packages/ui, packages/db, packages/api-client, packages/utils

---

## DESIGN

UI sobre, professionnelle et claire. Composants shadcn/ui. Icônes Lucide React uniquement. Aucun emoji. Textes en français (Suisse romande). Montants en CHF avec séparateur de milliers. Dates au format "9 avril 2026".

Couleurs sémantiques :
- Priorité I → rouge
- Priorité II → orange  
- Priorité III → vert
- Statut Clôturé → vert
- Statut En cours → bleu
- Statut Appel d'offres → violet

---

## SCHÉMA PRISMA

```prisma
model User {
  id               String    @id @default(cuid())
  email            String    @unique
  passwordHash     String
  firstName        String
  lastName         String
  role             UserRole  @default(DT)
  companyName      String?
  phone            String?
  avatarUrl        String?
  plan             Plan      @default(STARTER)
  stripeCustomerId String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
  projects         Project[]
  buildings        Building[]
}

enum UserRole { DT REGIE ARCHITECT ADMIN }
enum Plan { STARTER PRO STUDIO }

model Project {
  id            String        @id @default(cuid())
  name          String
  address       String
  city          String
  canton        String
  parcelNumber  String?
  yearBuilt     Int?
  buildingType  BuildingType
  nbApartments  Int?
  nbFloors      Int?
  floorHeight   Float?
  nbStaircases  Int?
  floorArea     Float?
  builtArea     Float?
  facadeArea    Float?
  terrainArea   Float?
  perimeter     Float?
  windowPct     Float         @default(0.30)
  honoraryPct   Float         @default(0)
  reservePct    Float         @default(5)
  status        ProjectStatus @default(CREATED)
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  buildingId    String?
  building      Building?     @relation(fields: [buildingId], references: [id])
  diagnostics   Diagnostic[]
  plans         ProjectPlan[]
  reports       Report[]
  tenders       Tender[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
}

enum BuildingType { LOGEMENT SCOLAIRE ADMINISTRATIF INDUSTRIEL HOTEL COMMERCIAL AUTRE }
enum ProjectStatus { CREATED VISIT_PLANNED DIAGNOSTIC_IN_PROGRESS REPORT_DRAFT REPORT_DONE TENDER_OPEN TENDER_CLOSED WORK_IN_PROGRESS CLOSED }

model Diagnostic {
  id        String          @id @default(cuid())
  projectId String
  project   Project         @relation(fields: [projectId], references: [id])
  visitDate DateTime?
  status    DiagStatus      @default(DRAFT)
  notes     String?
  items     DiagnosticItem[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

enum DiagStatus { DRAFT IN_PROGRESS COMPLETED }

model DiagnosticItem {
  id             String        @id @default(cuid())
  diagnosticId   String
  diagnostic     Diagnostic    @relation(fields: [diagnosticId], references: [id])
  cfcCode        String
  cfcLabel       String
  state          ElementState
  priority       Priority
  notes          String?
  photos         Photo[]
  works          String[]
  estimatedCost  Float?
  area           Float?
  unit           String?
  yearInstalled  Int?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
}

enum ElementState { TRES_BON BON MOYEN MAUVAIS }
enum Priority { I II III }

model Photo {
  id               String         @id @default(cuid())
  diagnosticItemId String
  diagnosticItem   DiagnosticItem @relation(fields: [diagnosticItemId], references: [id])
  url              String
  thumbnailUrl     String?
  caption          String?
  createdAt        DateTime       @default(now())
}

model CFCItem {
  id          String  @id @default(cuid())
  code        String  @unique
  label       String
  unit        String
  priceMin    Float
  priceMax    Float
  priceAvg    Float
  category    String
  subcategory String?
  works       Json
  userId      String?
}

model ProjectPlan {
  id           String    @id @default(cuid())
  projectId    String
  project      Project   @relation(fields: [projectId], references: [id])
  name         String
  type         PlanType
  fileUrl      String
  scale        Float?
  annotations  Json?
  measurements Json?
  version      Int       @default(1)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

enum PlanType { FLOOR FACADE SECTION SITE OTHER }

model Building {
  id         String      @id @default(cuid())
  name       String
  address    String
  city       String
  yearBuilt  Int?
  userId     String
  user       User        @relation(fields: [userId], references: [id])
  apartments Apartment[]
  projects   Project[]
  createdAt  DateTime    @default(now())
}

model Apartment {
  id         String        @id @default(cuid())
  buildingId String
  building   Building      @relation(fields: [buildingId], references: [id])
  number     String
  floor      Int
  area       Float?
  rooms      Float?
  tenant     String?
  history    WorkHistory[]
  createdAt  DateTime      @default(now())
}

model WorkHistory {
  id          String    @id @default(cuid())
  apartmentId String
  apartment   Apartment @relation(fields: [apartmentId], references: [id])
  date        DateTime
  description String
  cfcCode     String?
  cost        Float?
  company     String?
  photos      String[]
  createdAt   DateTime  @default(now())
}

model Report {
  id        String     @id @default(cuid())
  projectId String
  project   Project    @relation(fields: [projectId], references: [id])
  type      ReportType
  pdfUrl    String?
  status    String     @default("draft")
  data      Json?
  createdAt DateTime   @default(now())
}

enum ReportType { DIAGNOSTIC DEVIS CECB PARC }

model Tender {
  id        String          @id @default(cuid())
  projectId String
  project   Project         @relation(fields: [projectId], references: [id])
  title     String
  status    TenderStatus    @default(DRAFT)
  companies TenderCompany[]
  createdAt DateTime        @default(now())
}

enum TenderStatus { DRAFT SENT RECEIVED AWARDED CLOSED }

model TenderCompany {
  id       String @id @default(cuid())
  tenderId String
  tender   Tender @relation(fields: [tenderId], references: [id])
  name     String
  email    String
  amount   Float?
  status   String @default("pending")
}
```

---

## ROUTES API

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
POST   /api/auth/forgot-password
POST   /api/auth/reset-password

GET    /api/dashboard/stats
GET    /api/dashboard/activity

GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
DELETE /api/projects/:id

GET    /api/projects/:id/diagnostics
POST   /api/projects/:id/diagnostics
GET    /api/diagnostics/:id
PUT    /api/diagnostics/:id
POST   /api/diagnostics/:id/items
PUT    /api/diagnostics/:id/items/:itemId
DELETE /api/diagnostics/:id/items/:itemId
POST   /api/diagnostics/:id/items/:itemId/photos
DELETE /api/diagnostics/:id/items/:itemId/photos/:photoId

GET    /api/cfc
GET    /api/cfc/:code
PUT    /api/cfc/:code

GET    /api/projects/:id/plans
POST   /api/projects/:id/plans
GET    /api/plans/:id
PUT    /api/plans/:id
DELETE /api/plans/:id

POST   /api/projects/:id/reports/diagnostic
POST   /api/projects/:id/reports/devis
POST   /api/projects/:id/reports/cecb
GET    /api/reports/:id/download

GET    /api/buildings
POST   /api/buildings
GET    /api/buildings/:id
PUT    /api/buildings/:id
GET    /api/buildings/:id/apartments
POST   /api/buildings/:id/apartments
GET    /api/apartments/:id
PUT    /api/apartments/:id
POST   /api/apartments/:id/history

GET    /api/projects/:id/tenders
POST   /api/projects/:id/tenders
PUT    /api/tenders/:id
POST   /api/tenders/:id/send

POST   /api/cecb/estimate

POST   /api/billing/create-checkout
POST   /api/billing/webhook
GET    /api/billing/portal
```

---

## ROUTES WEB (React Router)

```
/                          Landing page marketing
/tarifs                    Pricing
/login                     Connexion
/register                  Inscription
/register/payment          Paiement Stripe
/onboarding                Setup initial
/forgot-password
/reset-password/:token

/app/dashboard
/app/projects
/app/projects/new
/app/projects/:id                    (tabs: Résumé / Diagnostic / Métrés / Plans / Rapports / AO / CECB)
/app/projects/:id/edit
/app/diagnostic/:id
/app/diagnostic/:id/item/:itemId
/app/plans/:id                       (éditeur plein écran)
/app/reports/:id
/app/buildings
/app/buildings/new
/app/buildings/:id                   (tabs: Vue d'ensemble / Appartements / Projets / Historique)
/app/buildings/:id/apartments/new
/app/buildings/:id/apartments/:aptId
/app/tenders/:id
/app/planning
/app/cecb
/app/settings                        (tabs: Profil / Équipe / CFC / Intégrations / Facturation / Notifications)
/admin/users
/admin/cfc
/admin/stats
```

---

## CONTENU DES PAGES PRINCIPALES

### /app/dashboard
- 4 stat cards : Projets actifs, Priorité I urgents, Budget total CHF, CECB estimés
- Graphique barres budget par mois (12 mois, 2 séries)
- Table projets récents avec barre colorée statut, nom, type, année, badge statut, montant
- Tabs table : Tous / En cours / Diagnostic / AO / Clôturés
- Panel droit : travaux urgents par priorité, barres progression projets, CECB par bâtiment, activité récente

### /app/projects/new — Formulaire 3 étapes
Étape 1 — Informations :
- Adresse (autocomplétion → appel api3.geo.admin.ch pour parcelle + surface terrain)
- Année construction, type bâtiment, nb appartements, nb étages, hauteur étage, nb cages, % honoraires, % réserve

Étape 2 — Métrés :
- Saisie surfaces (plancher, bâtie, façades, terrain, périmètre)
- Calculs automatiques affichés en temps réel :
  - Façade = périmètre × nb étages × hauteur d'étage (si pas de plan)
  - Fenêtres = % façade (slider 10%→60%, défaut 30%)
  - Toiture plate = surface bâtie
  - Toiture pente = surface bâtie × 1.35
  - Échafaudage = (façade + fenêtres) × 1.35
  - Communs = surface plancher × 10%
  - Peinture = cloisons × 2 + façade - fenêtres
  - Carrelage SDB = nb appts × 7m²
  - Carrelage cuisine = nb appts × 12m²
  - Portes palières = nb appts
  - Portes intérieures = nb appts × 4

Étape 3 — Récapitulatif + création

### /app/projects/:id
Tabs :
- Résumé : métrés calculés, progression, localisation
- Diagnostic : liste CFC diagnostiqués filtrables, état + priorité + coût
- Métrés : tableau CFC quantités + prix unitaires + totaux. Sous-total HT + honoraires + réserve + TVA 8.1%
- Plans : grille plans uploadés par type
- Rapports : liste PDFs générés
- AO : appels d'offres avec comparaison devis
- CECB : estimation indicative A–G + demande officielle

### /app/diagnostic/:id
- Arborescence CFC collapsible gauche (Groupe → Élément → Sous-élément), indicateur état coloré si diagnostiqué
- Panneau droit : photos, état (4 boutons visuels), priorité I/II/III, travaux recommandés, année installation, notes, quantité + unité, coût auto calculé
- Tout est modifiable à tout moment → recalcul automatique en cascade
- Récap global : total par priorité + coût global

### /app/plans/:id
- Toolbar : sélection, zone m², longueur ml, volume m³, annotation, cotation
- Plan PDF centré pan+zoom
- Remise à l'échelle (ex: 1:100) avec outil calibration
- Calcul m² automatique au dessin d'une zone
- Panneau droit : paramètres échelle, liste mesures, annotations
- Arborescence en bas : niveaux / façades / coupes
- Export PDF annoté

### /app/buildings/:id
Tabs :
- Vue d'ensemble : stats, état parties communes, CECB
- Appartements : liste (numéro, étage, surface, statut, dernier travaux) + bouton ajout
- Parties communes : façade, toiture, hall, ascenseur
- Projets : projets liés
- Historique : timeline tous travaux

### /app/buildings/:id/apartments/:aptId
- Infos : numéro, étage, surface, pièces, locataire
- Timeline historique travaux (filtrable par année / CFC / montant)
- Chaque entrée : date, description, CFC, coût, entreprise, photos
- Bouton "Ajouter une intervention"

---

## ÉCRANS MOBILES (React Native)

### Auth
- SplashScreen
- LoginScreen
- OnboardingScreen (3 slides swipeables)

### Home
- HomeScreen : projets récents (cards horizontales), bouton "Démarrer une visite", alertes du jour

### Flux diagnostic terrain
1. ProjectSelectScreen : recherche + liste projets
2. DiagnosticStartScreen : récap projet + éléments déjà/restants
3. CFCSelectScreen : arborescence CFC 3 niveaux + recherche + indicateur déjà diagnostiqué
4. PhotoCaptureScreen : caméra plein écran, galerie thumbnails, max 6 photos
5. StateInputScreen : 4 gros boutons état colorés + notes + année
6. ResultScreen : état proposé, priorité, travaux recommandés, coût estimé, bouton modifier ou valider
7. VisitRecapScreen : tous les éléments visités, récap I/II/III, coût total, bouton terminer

### Plans mobile
- PlanListScreen
- PlanViewScreen : pinch-to-zoom, mode mesure tactile, annotation

### Rapport mobile
- ReportPreviewScreen : PDF scrollable + partage

### Settings
- ProfileScreen
- SyncScreen : statut offline/online

---

## LOGIQUE MÉTIER

### packages/utils/formulas.ts
```typescript
export function computeProjectMetrics(input: {
  perimeter: number
  nbFloors: number
  floorHeight: number
  builtArea: number
  floorArea: number
  facadeArea?: number
  windowPct?: number
  nbApartments: number
}) {
  const windowPct = input.windowPct ?? 0.30
  const facade = input.facadeArea ?? (input.perimeter * input.nbFloors * input.floorHeight)
  const windows = facade * windowPct
  return {
    facade,
    windows,
    flatRoof: input.builtArea,
    slopedRoof: input.builtArea * 1.35,
    scaffolding: (facade + windows) * 1.35,
    commons: input.floorArea * 0.10,
    tilesBathrooms: input.nbApartments * 7,
    tilesKitchens: input.nbApartments * 12,
    entranceDoors: input.nbApartments,
    interiorDoors: input.nbApartments * 4,
  }
}
```

### packages/utils/cecb.ts
```typescript
// Estimation basée sur : année construction + état enveloppe diagnostiqué + type chauffage
// Retourne { grade: 'D', label: 'Peu performant', isOfficial: false }
// Toujours afficher "Estimation indicative — non officielle"
```

### Calcul coût diagnostic
```
coût item = cfcItem.priceAvg × quantité
total HT = somme tous items
total final = total HT × (1 + honoraryPct/100) × (1 + reservePct/100) × 1.081
```

### Offline mobile
- Données projet + CFC stockées expo-sqlite
- Diagnostic offline → "pending_sync"
- Photos compressées max 1200px 80% avant upload
- Sync auto à reconnexion réseau
- Indicateur sync visible dans topbar

---

## GÉNÉRATION PDF (packages/pdf-generator)

### Rapport diagnostic
1. Page de garde : logo + entreprise + projet + date
2. Résumé : métrés, total, répartition priorités
3. Par élément CFC : code, état, priorité, photos (2/ligne), travaux, coût
4. Récap travaux par priorité
5. Devis ±15% par CFC
6. Mention "Estimation indicative ±15% — Diagly"

### Rapport devis
- Tableau : code CFC, désignation, unité, quantité, prix unitaire, total
- Sous-totaux par catégorie
- Total HT + honoraires + réserve + TVA 8.1%
- 3 scénarios : Minimum / Standard / Complet énergie

---

## INTÉGRATIONS

### Géoplanet
```
GET https://api3.geo.admin.ch/rest/services/api/SearchServer
  ?searchText={adresse}
  &type=locations
  &sr=2056
→ retourne numéro parcelle + surface terrain
```

### Stripe
```
Plans : STARTER CHF 49/mois, PRO CHF 129/mois, STUDIO CHF 290/mois
Webhooks : checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
```

---

## SEED (prisma/seed.ts)

- User demo : sophie.berger@diagly-demo.ch / Demo1234!
- 5 projets avec statuts variés
- Base CFC 50+ éléments avec prix CHF réalistes
- 2 bâtiments avec 8–12 appartements
- Diagnostics complets avec données fictives

---

## VARIABLES D'ENVIRONNEMENT

```env
DATABASE_URL="postgresql://user:password@localhost:5432/diagly"
JWT_SECRET="min-32-chars"
JWT_REFRESH_SECRET="min-32-chars"
STORAGE_BUCKET="diagly-uploads"
STORAGE_ACCESS_KEY=""
STORAGE_SECRET_KEY=""
STORAGE_ENDPOINT=""
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_STARTER=""
STRIPE_PRICE_PRO=""
STRIPE_PRICE_STUDIO=""
SMTP_HOST=""
SMTP_PORT=587
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="noreply@diagly.ch"
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
```

---

## ORDRE DE DÉVELOPPEMENT

1. Setup monorepo pnpm + structure dossiers
2. Prisma schema + migration + seed
3. API auth + projects CRUD
4. Web : layout + auth + dashboard
5. Module projets
6. Module diagnostic
7. Visualisateur plans (Konva.js)
8. Génération PDF
9. CRM bâtiments + appartements
10. Mobile React Native
11. CECB
12. Appels d'offres
13. Stripe billing
14. Tests (Playwright)
15. Déploiement

---

## COMMANDES

```bash
pnpm install
pnpm dev
pnpm db:migrate
pnpm db:seed
pnpm db:studio
pnpm build
pnpm test
cd apps/mobile && npx expo start
```

---

## RÈGLES GÉNÉRALES

- Aucun emoji dans l'UI
- Icônes Lucide React uniquement
- Tous les textes en français
- Montants : CHF avec séparateur de milliers (ex : 142 000)
- Dates : "9 avril 2026"
- Erreurs formulaires : messages clairs en français
- Diagnostic toujours modifiable — aucune donnée figée
- Chaque page a un état vide (EmptyState) avec CTA
- Chaque liste a skeleton loader pendant le chargement
- Pagination ou infinite scroll sur toutes les listes
- Web optimisé desktop, mobile natif React Native
