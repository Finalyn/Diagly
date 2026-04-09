# Diagly - Etat du projet

## Qu'est-ce que c'est
Maquette frontend (mockup) complete pour **Diagly**, une application SaaS de diagnostic et renovation de batiments pour les professionnels en Suisse (directeurs de travaux, regies immobilieres, architectes).

**Pas de backend, pas de base de donnees** - uniquement du frontend avec des donnees fictives (mock data).

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (avec @theme CSS variables)
- React Router v7 (routing)
- Recharts (graphiques)
- Lucide React (icones)
- Zustand, TanStack Query, Zod (installes mais pas encore utilises - mock data directe)

## Theme
- Couleur primaire : `#3b82f6` (bleu clair)
- Badge "Pro" a cote du logo Diagly
- UI sobre, professionnelle, sans emoji
- Textes en francais (Suisse romande), montants en CHF

## Architecture de la sidebar
La sidebar a 3 etats :
1. **Vue globale** : Tableau de bord en haut, outils globaux en bas (Planning, CFC, CECB, Parc immobilier, Parametres)
2. **Page projets** : Tableau de bord + liste scrollable de tous les projets (15 projets mock) + outils globaux en bas
3. **Dans un projet** : Tableau de bord + outils projet (Resume, Diagnostic, Metres, Plans, Rapports, AO, CECB, Planning) + outils globaux en bas. La liste des projets est masquee.

Chaque outil d'un projet est une **page dediee** (pas des tabs).

## Pages existantes

### Marketing
- `/` - Landing page (style SaaS moderne, hero + mockup dashboard + stats + features + pricing + temoignages + CTA + footer)
- `/tarifs` - Page tarifs (Starter 49 CHF, Pro 129 CHF, Studio 290 CHF)

### Auth
- `/login` - Connexion
- `/register` - Inscription
- `/register/payment` - Paiement Stripe
- `/forgot-password` - Mot de passe oublie
- `/reset-password/:token` - Reinitialisation
- `/onboarding` - Setup initial 3 etapes

### App - Global
- `/app/dashboard` - Tableau de bord (4 stat cards, graphique budget, projets recents, travaux urgents, activite)
- `/app/projects` - Liste des projets (filtrable, tabs)
- `/app/projects/new` - Creation projet 3 etapes (infos, metres avec calculs auto, recap)
- `/app/planning` - Planning global (3 vues : Mois, Semaine, Gantt)
- `/app/cfc` - Editeur CFC avec prix modifiables (arborescence + tableau inline editable)
- `/app/cecb` - Estimations CECB (echelle A-G)
- `/app/buildings` - Liste batiments (CRM)
- `/app/buildings/new` - Creation batiment
- `/app/buildings/:id` - Detail batiment (4 tabs : Vue ensemble, Appartements, Projets, Historique)
- `/app/buildings/:id/apartments/new` - Ajout appartement
- `/app/buildings/:id/apartments/:aptId` - Detail appartement + timeline travaux
- `/app/plans` - Liste tous les plans (grille/liste, filtrable)
- `/app/plans/:id` - Visualisateur plans complet (outils mesure, annotations, calibration, niveaux/facades/coupes)
- `/app/settings` - Parametres (6 tabs : Profil, Equipe, CFC, Integrations, Facturation, Notifications)

### App - Dans un projet
- `/app/projects/:id` - Resume projet (metres calcules, progression, stats)
- `/app/projects/:id/edit` - Edition projet
- `/app/projects/:id/diagnostic` - Page diagnostic (tableau elements CFC)
- `/app/projects/:id/metres` - Devis quantitatif (CFC + totaux HT/honoraires/reserve/TVA)
- `/app/projects/:id/plans` - Plans du projet
- `/app/projects/:id/rapports` - Rapports generes (PDF)
- `/app/projects/:id/ao` - Appels d'offres (comparatif)
- `/app/projects/:id/cecb` - CECB du projet
- `/app/projects/:id/planning` - Planning projet avec Gantt detaille

### Outils
- `/app/diagnostic/:id` - Editeur diagnostic (arborescence CFC a gauche + panneau detail a droite)
- `/app/diagnostic/:id/item/:itemId` - Detail d'un item diagnostic
- `/app/tenders/:id` - Detail appel d'offres (comparatif offres)
- `/app/reports/:id` - Apercu rapport PDF

## Mock data (src/data/mock.ts)
- 15 projets avec statuts varies
- 32 codes CFC avec prix CHF realistes
- 2 diagnostics complets avec items
- 2 batiments avec 12 et 8 appartements
- Activites, tenders, budget chart, stats dashboard

## Formules metier (src/lib/formulas.ts)
- `computeProjectMetrics()` : calcul facade, fenetres, toiture, echafaudage, communs, carrelage, portes
- Cout : `prix_moyen_CFC x quantite`
- Total : `HT x (1 + honoraires%) x (1 + reserve%) x 1.081 (TVA)`

## Ce qui reste a faire
- [ ] Connecter un vrai backend (Node.js + Express + Prisma + PostgreSQL - voir DIAGLY_SPEC.md)
- [ ] Remplacer les mock data par de vrais appels API
- [ ] Ajouter Konva.js pour le dessin sur plans (actuellement c'est du SVG statique)
- [ ] React Native mobile (Expo)
- [ ] Generation PDF reelle (pdf-lib)
- [ ] Auth JWT + Stripe billing
- [ ] Offline-first mobile
- [ ] Tests (Playwright)

## Commandes
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```
