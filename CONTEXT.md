# Diagly - Etat du projet

## Qu'est-ce que c'est
Maquette frontend (mockup) complete pour **Diagly**, une application SaaS de diagnostic de batiments pour les professionnels en Suisse (directeurs de travaux, regies immobilieres, architectes).

**Pas de backend, pas de base de donnees** - uniquement du frontend avec des donnees fictives (mock data).

**App mobile** : maquette separee dans le repo Diagly-Mobile (https://github.com/Finalyn/Diagly-Mobile)

## Stack
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (avec @theme CSS variables)
- React Router v7
- Recharts (graphiques)
- Lucide React (icones)
- Zustand (store pour contexte projet actif)

## Theme
- Couleur primaire : `#3b82f6` (bleu clair)
- Badge "Pro" a cote du logo Diagly
- UI sobre, professionnelle, sans emoji
- Textes en francais (Suisse romande), montants en CHF
- **Responsive** : mobile-first, sidebar drawer sur mobile, cards au lieu de tableaux sur petit ecran

## Terminologie
- On dit **Diagnostic** (pas "projet")
- On dit **Couts** (pas "metres")
- On dit **Calendrier** (pas "planning")
- Pas d'appels d'offres (AO) - Diagly = diagnostic uniquement
- CECB uniquement dans le contexte d'un diagnostic (pas en global)
- Statuts : Non planifie, Planifie, En cours, En revue, Termine, Archive

## Architecture de la sidebar
La sidebar a 3 etats :

1. **Vue globale** (dashboard, etc.) : liste scrollable des diagnostics en haut + outils globaux en bas (Tableau de bord, Calendrier, CFC/Prix, Parc immobilier, Parametres)
2. **Dans un diagnostic** : outils du diagnostic en haut (Resume, Diagnostic, Couts, Plans, Rapports, CECB, Calendrier) + spacer + outils globaux colles en bas
3. **Version reduite** : icones seulement + bouton "+" pour nouveau diagnostic

Cliquer sur "Diagly" en haut a gauche ramene au tableau de bord.
Cliquer sur "Diagnostics" ramene a la liste.
Cliquer sur un diagnostic dans la liste va directement sur sa page Diagnostic.
Bouton "Nouveau diagnostic" en bas de la sidebar.

## Pages existantes

### Marketing
- `/` - Landing page (style SaaS moderne : hero + mockup dashboard + stats + features + how it works + pricing + temoignages + CTA + footer)
- `/tarifs` - Page tarifs (Starter 49 CHF, Pro 129 CHF, Studio 290 CHF)

### Auth
- `/login` - Connexion
- `/register` - Inscription
- `/register/payment` - Paiement Stripe
- `/forgot-password` - Mot de passe oublie
- `/reset-password/:token` - Reinitialisation
- `/onboarding` - Setup initial 3 etapes

### App - Global
- `/app/dashboard` - Tableau de bord avec selecteur de diagnostic (global ou par diagnostic), stats inline, couts par priorite, elements couteux cliquables, alertes priorite I cliquables, progression, activite recente
- `/app/projects` - Liste des diagnostics (filtrable, tabs : Tous/En cours/Diagnostic/Rapports/Clotures)
- `/app/projects/new` - Creation diagnostic 3 etapes
- `/app/planning` - Calendrier global (3 vues : Mois, Semaine, Gantt) - evenements diagnostic/visite/rapport/travaux
- `/app/cfc` - Editeur CFC avec prix modifiables (arborescence + tableau inline editable)
- `/app/buildings` - Liste batiments (CRM)
- `/app/buildings/new` - Creation batiment
- `/app/buildings/:id` - Detail batiment (4 tabs)
- `/app/buildings/:id/apartments/new` - Ajout appartement
- `/app/buildings/:id/apartments/:aptId` - Detail appartement + timeline travaux
- `/app/plans` - Liste tous les plans (grille/liste, filtrable)
- `/app/plans/:id` - Visualisateur plans complet (outils mesure, annotations, calibration, niveaux/facades/coupes)
- `/app/settings` - Parametres (6 tabs)

### App - Dans un diagnostic
- `/app/projects/:id` - Resume (surfaces calculees, progression, stats)
- `/app/projects/:id/edit` - Edition diagnostic
- `/app/projects/:id/diagnostic` - Page diagnostic (tableau elements CFC, cards sur mobile)
- `/app/projects/:id/couts` - Couts et devis (CFC + totaux HT/honoraires/reserve/TVA)
- `/app/projects/:id/plans` - Plans du diagnostic
- `/app/projects/:id/rapports` - Rapports generes (PDF)
- `/app/projects/:id/cecb` - CECB du diagnostic
- `/app/projects/:id/calendrier` - Calendrier diagnostic avec Gantt detaille

### Outils
- `/app/diagnostic/:id` - Editeur diagnostic (arborescence CFC a gauche + panneau detail a droite)
- `/app/diagnostic/:id/item/:itemId` - Detail d'un item diagnostic
- `/app/tenders/:id` - Detail appel d'offres (legacy, peut etre retire)
- `/app/reports/:id` - Apercu rapport PDF

## Navigation
- Bouton retour (fleche) = `window.history.back()` partout (revient a la page precedente, pas toujours au resume)
- Store Zustand `projectStore` garde le `activeProjectId` pour maintenir le contexte projet meme sur `/app/diagnostic/:id` ou `/app/plans/:id`
- Changement de route = scroll automatique en haut
- Notification (cloche) -> Parametres > Notifications
- Avatar profil -> Parametres

## Mock data (src/data/mock.ts)
- 15 diagnostics avec statuts varies (NON_PLANIFIE, PLANIFIE, EN_COURS, EN_REVUE, TERMINE, ARCHIVE)
- 32 codes CFC avec prix CHF realistes
- 2 diagnostics complets avec items
- 2 batiments avec 12 et 8 appartements
- Activites, tenders, budget chart, stats dashboard

## Responsive
- Sidebar : drawer overlay sur mobile (< lg), bouton hamburger dans la TopBar
- TopBar : nom utilisateur cache sur mobile, recherche reduite a icone
- Tableaux : remplaces par des cards sur mobile (< md)
- Grilles : 1 colonne mobile, 2-4 colonnes desktop
- Boutons : pleine largeur sur mobile
- Stats dashboard : grille 2x2 sur mobile, ligne sur desktop

## Commandes
```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

## Ce qui reste a faire
- [ ] Connecter un vrai backend (Node.js + Express + Prisma + PostgreSQL)
- [ ] Remplacer les mock data par de vrais appels API
- [ ] Ajouter Konva.js pour le dessin sur plans
- [ ] React Native mobile (Expo) - maquette web dispo dans Diagly-Mobile
- [ ] Generation PDF reelle (pdf-lib)
- [ ] Auth JWT + Stripe billing
- [ ] Offline-first mobile
- [ ] Tests (Playwright)
