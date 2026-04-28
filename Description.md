# Diagly — Description produit

## Ce que c'est

Diagly est une plateforme suisse de **diagnostic de bâtiment et de planification de rénovation**, utilisée par des professionnels (directeurs de travaux, régies immobilières, architectes) et des particuliers (propriétaires occupants ou bailleurs).

L'app couvre toute la chaîne :
1. saisir l'état d'un bâtiment, pièce par pièce, élément CFC par élément CFC,
2. quantifier les travaux nécessaires et leur coût en CHF,
3. produire un rapport de diagnostic, un devis ±15%, un calendrier des travaux et un échéancier de paiement,
4. accompagner l'utilisateur dans le suivi des travaux jusqu'à la réception.

Différenciateur : un assistant IA contextuel disponible à chaque étape, et un mode guidé qui rend l'outil utilisable aussi bien par un DT chevronné que par un propriétaire qui n'a jamais entendu parler des codes CFC.

## Périmètre fonctionnel

### Diagnostics
Unité centrale de l'app. Un diagnostic = un bâtiment évalué à un instant T. Contient :
- Informations générales (adresse, NPA, canton, type de bâtiment, année construction, surfaces)
- Liste d'éléments CFC évalués (état, priorité, travaux, photos, coût)
- Statuts : Non planifié → Planifié → En cours → En revue → Terminé → Archivé

**Types de bâtiment** : Logement, Villa, Chalet, École/scolaire, Bureau, Administratif, Industriel, Hôtel, Commercial, Autre. Chaque type définit la liste des pièces à inspecter en mode guidé.

### Catalogue CFC (Code des Frais de Construction suisse)
~32 codes principaux (211 Terrassement, 271 Toiture, 291 Crépi, 311 Fenêtres bois, 411 Peinture intérieure, etc.) avec :
- Prix CHF min/moy/max par unité (m², ml, m³, pce, fft)
- Liste de travaux types par CFC
- **Guide d'évaluation par état** : pour chaque combinaison CFC × état, une description pédagogique (« qu'est-ce qui fait que c'est moyen ? ») et la liste des travaux typiques pour cet état.

### Mode guidé
Visite structurée par **pièces** (cuisine, SDB, chambre, façade, etc.) selon le type de bâtiment. Pour chaque pièce, l'app présente automatiquement les CFC pertinents avec :
- Boutons d'état (très bon / bon / moyen / mauvais)
- Boutons de priorité (I / II / III)
- Description automatique du critère selon l'état choisi
- Suggestions de travaux contextuelles
- Champ notes + photos
- Option « non applicable »

C'est le mode par défaut pour les particuliers, et un raccourci pour les pros qui font une visite rapide.

### Éditeur expert
Mode pro avec arborescence CFC libre, prix unitaires modifiables, calcul instantané des totaux HT/honoraires/réserve/TVA 8.1%.

### Plans
Visualiseur PDF avec outils de mesure (zone m², longueur ml, volume), annotations, calibration d'échelle (1:50, 1:100…), niveaux/façades/coupes, export PDF annoté.

### Calendrier et échéancier
- **Calendrier global** : vues Mois et Semaine, événements multi-diagnostics (visites, travaux, rapports).
- **Calendrier du diagnostic** : échéancier de paiement multi-année (~24 mois) en 5 phases : Diagnostic (10) → Rapport (20) → Appels d'offres (30) → Travaux (40) → Réception (50). Lignes de paiement mensuel honoraires (vert) / travaux (orange) / total. Export Excel.

### Rapports
Génération PDF de :
- **Rapport diagnostic** : photos + état + priorité par CFC, récap travaux, devis ±15%
- **Devis détaillé** : tableau quantitatif par CFC avec sous-totaux et 3 scénarios (Minimum / Standard / Complet énergie)
- **CECB indicatif** : grade A–G estimé d'après l'état de l'enveloppe + chauffage, toujours marqué « non officiel »
- **Rapport parc** : synthèse multi-bâtiments pour régies

### Parc immobilier (CRM)
Pour les régies / propriétaires de plusieurs biens. Bâtiments → appartements → historique des travaux (timeline filtrable date/CFC/montant).

### Appels d'offres
Côté pro : cahier des charges → envoi entreprises → comparaison devis → adjudication.

## Assistant IA transversal

L'IA n'est pas un module séparé — elle est **disponible partout, à la demande de l'utilisateur**, accessible via une icône d'assistant ou un raccourci clavier. Pattern Copilot contextuel : l'utilisateur garde la main, l'IA assiste.

### Cas d'usage par contexte

**À la création du diagnostic**
- Pré-remplir les surfaces et caractéristiques à partir d'une adresse + photo extérieure
- Suggérer le type de bâtiment et l'année de construction probable

**Pendant la visite (mobile, mode guidé)**
- Analyser une photo et proposer un état + des travaux probables (l'utilisateur valide ou corrige)
- Reconnaître automatiquement le type d'élément (« ceci est une fenêtre PVC double vitrage des années 90 »)
- Suggérer la pièce suivante à inspecter selon l'avancement
- Saisie vocale en langage naturel restructurée par l'IA (« la peinture du salon est jaunie avec des fissures sur le plafond » → CFC 411, état moyen, travaux : remise en peinture + traitement des fissures)

**Sur la fiche d'un élément**
- Reformuler les notes en langage technique
- Proposer une fourchette de coûts ajustée au canton et à la difficulté du chantier
- Détecter les incohérences (état très bon mais travaux importants suggérés)

**Sur les rapports**
- Générer la synthèse exécutive
- Rédiger les recommandations en langage clair pour le client final
- Adapter le ton (rapport pro technique vs synthèse particulier vulgarisée)

**Sur le calendrier / échéancier**
- Proposer un séquencement réaliste des travaux selon dépendances métier (toiture avant intérieur, etc.)
- Lisser l'échéancier de paiement selon la trésorerie cible

**Sur la conversation libre**
- Q&A : « est-ce que ma toiture vaut la peine d'être isolée vu son état ? », « combien ça coûte de remplacer l'ascenseur dans un immeuble des années 70 ? »
- Recherche dans les diagnostics passés, les CFC, les guides d'état

### Garde-fous
- L'IA ne valide jamais seule un diagnostic : tout passe par une confirmation utilisateur
- Les estimations IA sont toujours marquées comme telles et accompagnées de la fourchette CFC officielle
- Pour les particuliers, recommandation systématique de faire valider par un pro Diagly avant engagement de gros travaux

## Modèle de données (essentiel)

```
User { role: DT | REGIE | ARCHITECT | PARTICULIER | ADMIN, ... }

Project (= Diagnostic projet)
  ├ address, postalCode, city, canton, parcelNumber
  ├ buildingType, yearBuilt
  ├ surfaces (floorArea, builtArea, facadeArea, perimeter, windowPct…)
  ├ honoraryPct, reservePct
  ├ status
  └ Diagnostic[]
       └ DiagnosticItem[]
            ├ cfcCode, cfcLabel
            ├ state (TRES_BON | BON | MOYEN | MAUVAIS)
            ├ priority (I | II | III)
            ├ photos, notes, works[]
            ├ area, unit, yearInstalled
            └ estimatedCost (calculé)

CFCItem { code, label, unit, priceMin/Avg/Max, category, works[], stateGuide }
StateGuide { criteria, works[] }  ← par état CFC

Building (CRM) → Apartment[] → WorkHistory[]
ProjectPlan { type: FLOOR/FACADE/SECTION, fileUrl, scale, annotations, measurements }
Report { type: DIAGNOSTIC/DEVIS/CECB/PARC, pdfUrl }
Tender → TenderCompany[]
```

Référentiels statiques :
- `roomBlocks: Record<BuildingType, string[]>` — pièces par type
- `blockCfcCodes: Record<string, string[]>` — CFC par pièce
- `buildingTypeLabels`, `stateLabels`, `statusLabels`, `priorityColors`

## Stack technique

**Frontend web** : React 19 + TypeScript strict + Vite + Tailwind v4 (CSS variables `@theme`) + React Router 7 + Zustand + Recharts + Lucide React. Composants UI maison (`Card`, `Button`, `Badge`, `Tabs`, `Table`, `Dialog`, `Progress`…).

**Mobile** : React Native + Expo, monorepo partagé avec le web, offline-first (expo-sqlite + sync auto), expo-camera pour la capture terrain, photos compressées 1200px/80% avant upload.

**Backend** : Node.js + Express + TypeScript + Prisma + PostgreSQL. JWT (access 15min + refresh 7j). Multer/Sharp pour les uploads, pdf-lib pour la génération PDF, Nodemailer.

**IA** : appels backend → provider LLM/vision. Cache résultats vision sur les photos. Logs des prompts/réponses pour amélioration continue.

**Infra** : monorepo pnpm workspaces — `apps/web`, `apps/mobile`, `packages/ui`, `packages/db`, `packages/api-client`, `packages/utils`, `packages/pdf-generator`, `packages/ai`.

**Intégrations** :
- `api3.geo.admin.ch` : autocomplétion adresse + récupération parcelle/surface terrain

## Principes UX

**Vocabulaire** : on dit *Diagnostic* (jamais "projet"), *Coûts* (jamais "métrés"), *Calendrier* (jamais "planning").

**Design system**
- Couleur primaire `#3b82f6` (bleu clair), badge "Pro" à côté du logo
- UI sobre, professionnelle, **aucun emoji**, icônes Lucide React uniquement
- Textes 100% français (Suisse romande), montants CHF avec séparateur d'apostrophe (1'234'567), dates « 9 avril 2026 »
- Couleurs sémantiques : Priorité I = rouge, II = orange, III = vert ; Mauvais = rouge, Moyen = orange, Bon = vert clair, Très bon = vert
- Mobile-first responsive : drawer sidebar < lg, cards au lieu de tableaux < md

**Layout sidebar** (3 états)
1. Vue globale : liste scrollable des diagnostics + outils globaux (Tableau de bord, Calendrier, CFC/Prix, Parc immobilier, Paramètres)
2. Dans un diagnostic : outils du diagnostic (Résumé, Diagnostic, Coûts, Plans, Rapports, CECB, Calendrier) + outils globaux en bas
3. Réduite : icônes seulement + bouton « + »

**Tableau de bord** : raccourcis (pas de stats globales) + diagnostics récents + activité récente + derniers éléments diagnostiqués. Les stats détaillées vivent dans la page Diagnostic.

**Mode guidé** : chemin par défaut pour les nouveaux utilisateurs, accessible aussi en raccourci pour les experts.

**État vide** : chaque page vide a un EmptyState avec CTA. Chaque liste a un skeleton loader.

**Diagnostic toujours modifiable** : aucune donnée n'est jamais figée, recalcul automatique en cascade.

## Workflows clés

### Visite terrain (mobile, mode guidé)
1. Sélectionner ou créer le diagnostic
2. Récap projet + pièces à visiter
3. Pour chaque pièce : pour chaque CFC suggéré → photo → état → priorité → notes (IA assiste à chaque étape sur demande)
4. Récap visite : tous les éléments visités, totaux par priorité, coût total
5. Sync auto à la reconnexion réseau

### Production rapport
1. Diagnostic clôturé déclenche la disponibilité des rapports
2. Choix du type (Diagnostic / Devis / CECB / Parc)
3. IA peut rédiger l'exécutif et reformuler pour audience cible
4. Génération PDF côté serveur, stockage objet, lien partageable

### Suivi travaux et paiement
1. Calendrier du diagnostic affiche échéancier ~24 mois
2. Phases 10–50 avec barres vertes (honoraires) / orange (travaux)
3. Lignes mensuelles paiement Travaux + Honoraires + Total
4. Export Excel pour communication client / banque

## Calculs métier

```
Surface façade = périmètre × nb étages × hauteur étage  (si pas mesuré sur plan)
Surface fenêtres = façade × windowPct  (slider 10%→60%, défaut 30%)
Toiture plate = surface bâtie
Toiture pente = surface bâtie × 1.35
Échafaudage = (façade + fenêtres) × 1.35
Communs = surface plancher × 10%
Carrelage SDB = nb appts × 7 m²
Carrelage cuisine = nb appts × 12 m²
Portes palières = nb appts
Portes intérieures = nb appts × 4

Coût item = cfcItem.priceAvg × quantité
Total HT = somme tous items
Total final = total HT × (1 + honorary%) × (1 + reserve%) × 1.081  (TVA 8.1%)
```
