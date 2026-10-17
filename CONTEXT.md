# Diagly : état du projet

## Qu'est-ce que c'est
Application de diagnostic de bâtiment et de planification de rénovation pour la Suisse romande (directeurs de travaux, régies immobilières, architectes, particuliers). En ligne sur https://diagly.ch, en bêta, avec une app iPhone et iPad distribuée par TestFlight.

Ce n'est plus une maquette : front React, API Express + Prisma sur MySQL, données réelles en production chez Infomaniak.

- Installation locale et bêta : `README.md`
- Produit : `Description.md` ; technique : `DIAGLY_SPEC.md`
- API : `server/README.md` ; app native : `APP-IOS.md` ; mise en ligne : `DEPLOIEMENT.md`

## Stack
- Front : React 19 + TypeScript + Vite, Tailwind CSS v4 (variables `@theme`), React Router 7, TanStack Query (cache persisté), Zustand, Recharts, Leaflet, pdf.js, Lucide React
- Serveur : Node + Express + Prisma + MySQL 8 (`server/`)
- App iPhone/iPad : Capacitor 8 (`ios/`), compilée par GitHub Actions
- IA : API d'Anthropic, appelée par le serveur

## Thème
- Couleur principale presque noire (`#1d1d1f`), bleu Diagly (`#0167ea`) dans l'éditeur du relevé
- Police Inter ; barres en verre sur téléphone
- UI sobre, professionnelle, sans emoji ni tiret cadratin
- Textes en français (Suisse romande), montants en CHF

## Terminologie
- On dit **Diagnostic** (pas « projet »), **Relevé** pour l'éditeur
- On dit **Coûts** (pas « métrés »)
- On dit **Calendrier** (pas « planning »)
- **Base de données** = la base CFC du bureau ; **Étiquette énergétique** = l'écran CECB
- Pas d'appels d'offres (module annoncé, non construit)
- Statuts : Non planifié, Planifié, En cours, En revue, Terminé, Archivé

## Architecture du menu de gauche
Sur ordinateur et iPad (768 px et plus). Le bouton en haut à gauche le replie ou le rouvre ; le choix est retenu (`src/stores/menu-lateral.ts`).

1. **Hors dossier** (`Sidebar.tsx`) : logo, bouton « Nouveau diagnostic », puis Accueil, Diagnostics, Base de données, Intégrations, Parc immobilier, Prestataires, Paramètres, Aide & support ; en bas, le compte et l'Assistant.
2. **Dans un dossier** (`DossierSidebar.tsx`) : le Relevé en tête, puis Bâtiment (Fiche du bâtiment, Visite, Plans, Étiquette énergétique), Analyse (Coûts, Variantes), Documents (Photos, Rapports).
3. **Éditeur du relevé sur iPad** : menu replié d'office, un panneau à la fois ; le rouvrir ne vaut que pour la page en cours.

Cliquer sur le logo ramène à l'accueil.

## Pages existantes
La liste complète des routes est dans `DIAGLY_SPEC.md` (ROUTES WEB). En bref :

### Public
- `/` vitrine (`LandingV3`), `/share/:token` rapport partagé, `/preview` maquette de démonstration, `/bientot`

### Auth
- `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/oauth-callback`, `/onboarding`
- `/register/payment` : écran de paiement sans effet, lié de nulle part

### App
- `/app/dashboard` Accueil : carte « Reprendre », accès rapides (dont Métrés), activité récente
- `/app/metres` Métrés : dépôt d'un jeu de plans (nouveau bâtiment ou dossier existant), liste des métrés ; `/app/metres/:projectId` l'espace de travail plein écran (navigateur des feuilles, éditeur de plan encastré, zones à valider et quantités du jeu), analyse de tout le jeu par lots en tâche de fond (`src/components/metres/moteur.ts`)
- `/app/projects` Diagnostics, `/app/projects/new` création (de zéro, depuis un document ou un CECB)
- Dans un dossier : relevé (`/diagnostic`), fiche, visite, plans, étiquette énergétique (`/cecb`), coûts, variantes, photos, rapports ; `/sommaire` sur téléphone
- `/app/diagnostic/:id` le relevé ouvert seul
- `/app/cfc` Base de données, `/app/assistant`, `/app/settings`, `/app/integrations`, `/app/prestataires`, `/app/support`
- `/app/planning` calendrier global et `/app/projects/:id/calendrier` échéancier : sans entrée dans les menus

### Bientôt disponible
- Parc immobilier (`/app/buildings` et suivantes), `/app/reports/:id`, `/app/tenders/:id` (`/app/plans` mène aux Métrés)

## Navigation
- Ouvrir un dossier mène au relevé
- « Suivant » dans le relevé enchaîne les ouvrages ; devant un ouvrage pas encore relevé, il demande s'il est présent ou absent
- Changement de route : la zone principale revient en haut
- Cloche : les notifications (rappels de visite, priorités urgentes, résumé du lundi, rappels d'absence)
- Visites guidées de l'interface qui se proposent d'elles-mêmes, une fois chacune (hors téléphone)

## Téléphone, iPad, app
- Téléphone (sous 768 px) : version de terrain. Seuls la liste, le dossier (sauf plans et variantes), le relevé, la base de données, l'assistant, les paramètres et l'aide sont ouverts ; le reste ramène à la liste. Barres en verre, barre du bas (native en Liquid Glass dans l'app iPhone sur iOS 26).
- iPad : l'app complète ; l'éditeur du relevé passe à un panneau à la fois.
- Hors ligne : les relevés passent par une file d'envoi sur l'appareil (`src/lib/hors-ligne/`), avec des identifiants créés sur l'appareil et une création idempotente côté serveur.
- Détails : `APP-IOS.md`.

## Commandes
```bash
npm install
npm run dev        # http://localhost:5173
npm run build
npm run build:app  # front de l'app iPhone/iPad
npx vitest run
```
Serveur : voir `README.md` et `server/README.md`.

## Ce qui reste à faire
- [ ] Parc immobilier (bâtiments, appartements, historique des travaux)
- [ ] Appels d'offres
- [ ] Remettre le calendrier dans les menus ; l'échéancier du dossier n'enregistre rien
- [ ] Hors ligne pour les autres écritures (fiche du bâtiment, visite)
- [ ] App : caméra native, partage de fichiers, liens universels, fiche App Store et publication
- [ ] Paiement en ligne
- [ ] Tests de bout en bout
