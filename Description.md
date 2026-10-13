# Diagly : description produit

## Ce que c'est

Diagly est une plateforme suisse de **diagnostic de bâtiment et de planification de rénovation**, utilisée par des professionnels (directeurs de travaux, régies immobilières, architectes) et des particuliers (propriétaires occupants ou bailleurs).

L'app couvre aujourd'hui cette chaîne :
1. relever l'état d'un bâtiment sur place, étape de visite par étape, ouvrage CFC par ouvrage CFC, photos à l'appui,
2. quantifier les travaux nécessaires et leur coût en CHF à partir de la base CFC du bureau,
3. comparer des variantes de travaux et estimer l'étiquette énergétique,
4. produire les rapports, un export de données et un lien de partage en lecture seule pour le client.

Le suivi des travaux jusqu'à la réception, le parc immobilier et les appels d'offres sont annoncés mais pas construits (écrans « Bientôt disponible »).

Différenciateurs : un assistant IA à la demande (le Guide IA sur la photo, une conversation, la lecture d'un document ou d'un CECB), et un relevé pensé pour le terrain : téléphone, iPad, sans réseau.

Supports : le site (ordinateur, et version de terrain sur téléphone), l'app iPhone et iPad (même front, embarqué par Capacitor).

## Périmètre fonctionnel

### Diagnostics
Unité centrale de l'app. Un dossier est un bâtiment évalué ; il porte un diagnostic (la visite à un instant T) et ses relevés. Il contient :
- les informations générales : adresse, NPA, canton, parcelle, type de bâtiment, années de construction et de rénovation, logements (et leur typologie), étages, hauteur d'étage, cages d'escalier, surfaces (plancher, bâtie, façade, terrain, périmètre, part vitrée) ;
- un enrichissement geo.admin (coordonnées, EGID, EGRID, registre des bâtiments) et, le cas échéant, les données d'un certificat énergétique importé ;
- les relevés : un ouvrage dans une étape, avec état, priorité, notes, photos, quantité et coûts ;
- un statut : Non planifié, Planifié, En cours, En revue, Terminé, Archivé.

Plusieurs bâtiments d'un même chantier se regroupent en **opération**.

**Types de bâtiment** : Logement, Villa, Chalet, Scolaire, Bureau, Administratif, Industriel, Hôtel, Commercial, Autre. Le type adapte les intitulés du parcours (« Salles de classe » devant une école, « Bureaux » devant un immeuble administratif).

**Créer un dossier** : de zéro, ou à partir d'un document (PDF, Word, Excel, CSV, texte) ou d'un CECB en PDF, que l'IA lit pour pré-remplir le formulaire, sans rien créer avant validation. L'adresse se cherche par geo.admin, qui complète les données du registre.

### Base CFC (« Base de données »)
La base du bureau, commune à tous les diagnostiqueurs (base CFC v3, importée du classeur Excel du bureau) :
- la nomenclature CFC (SN 506 500, quatre niveaux) ;
- des articles (A005, N001...) rattachés à un code CFC, avec pour chacun six états : très bon, bon, moyen, mauvais, amélioration, mise aux normes. Chaque état porte son texte de travaux, son prix et son unité (m², ml, pce, forfait) ;
- la base de quantité de chaque article (surface de façade, nombre de logements, saisie manuelle...) et son coefficient ;
- les groupes d'alternatives : des articles qui se partagent une même surface (une façade à moitié crépie, à moitié ventilée) ;
- les postes automatiques du devis : protection des ouvrages, échafaudage de façade, échafaudage de cage, nettoyage.

L'écran se consulte par tous ; l'écriture est réservée aux responsables (rôle ADMIN, ou OWNER/ADMIN de l'organisation), et chaque modification d'article reste dans son historique, nominativement.

### Le relevé (éditeur du diagnostic)
La visite suit le tour du bâtiment en sept étapes : Façade, Cage d'escalier, Structure, Locaux techniques, Appartements, Aménagements extérieurs, Autres. Un même article peut se relever dans deux étapes (la peinture des murs dans la cage et dans les appartements) : ce sont deux relevés, avec leurs états, quantités et photos propres.

Pour chaque ouvrage :
- boutons d'état (très bon, bon, moyen, mauvais) et de priorité (I, II, III) ;
- la description de ce à quoi ressemble chaque état, et les travaux correspondants ;
- photos, notes, quantité (calculée, ou corrigée à la main), coûts, amélioration et mise aux normes retenues ;
- « Suivant » enchaîne sur l'ouvrage d'après ; s'il n'est pas encore relevé, il demande d'abord s'il est présent ou absent dans le bâtiment, et ne crée rien s'il est absent ;
- un récapitulatif signale les oublis : photo manquante (importante si l'état est moyen ou mauvais), quantité manquante.

Sur téléphone et sur iPad, l'éditeur montre un panneau à la fois (la liste, puis l'ouvrage). Le relevé fonctionne sans réseau : les saisies sont gardées sur l'appareil et envoyées au retour du réseau.

### Coûts
Les postes rangés par priorité, puis la synthèse : total HT, honoraires, réserve pour imprévus, TVA et total. Les taux d'honoraires et de réserve se règlent par dossier. Export PDF et export de données.

### Variantes
Des variantes nommées d'un même dossier (« isoler par l'intérieur plutôt que par l'extérieur »), qui ne portent que les arbitrages : une ligne remplace un ouvrage du diagnostic ou ajoute un travail. Un tableau les compare au diagnostic de base.

### Plans
Dans le dossier : import de plans PDF ou d'images, étalonnage de l'échelle, mesures, dessin, flèches, notes, zones et calque de référence ; une zone peut se rattacher à un ouvrage du relevé pour en donner la quantité. Export du plan seul ou annoté. Les plans se travaillent sur ordinateur ou iPad.

### Étiquette énergétique
Une estimation indicative de la classe (A à G), calculée d'après les ouvrages relevés, à défaut d'après l'année de construction. L'import d'un CECB en PDF, lu par l'IA et validé par l'utilisateur, remplace l'estimation par les valeurs du certificat.

### Visite
L'organisation de la visite : interlocuteurs (gérance, propriétaire, concierge, locataire, entreprise), rendez-vous (recopié dans le calendrier), préparation, et des mails pré-remplis (dont l'avis aux locataires, imprimable), envoyés par le serveur ou par la messagerie de l'utilisateur.

### Rapports
Quatre rapports à l'écran, imprimables en PDF par l'impression du navigateur (ou la feuille d'impression d'iOS dans l'app) : Complet, Rapport, De l'existant, Rapports photo. Le logo, la couleur et la raison sociale se personnalisent par dossier. Un lien de partage public, révocable, donne au client une version en lecture seule.

### Photos
Toutes les photos des relevés du dossier, par poste, avec visionneuse et téléchargement (une photo, ou toutes en ZIP).

### Calendrier
Un calendrier global (vue mois, événements par catégorie : visite, réunion, travaux, échéance, appel, autre, rattachables à un dossier) et un échéancier indicatif par dossier en cinq phases (diagnostic, rapport, appel d'offres, travaux, réception). Ni l'un ni l'autre n'a aujourd'hui d'entrée dans les menus.

### Prestataires
Un annuaire tenu par Finalyn (architectes, experts CECB, ingénieurs, et des outils en ligne avec leur offre), et des demandes de mise en relation, dossier joint si on le souhaite.

### Équipe et intégrations
- Organisations : membres aux rôles OWNER, ADMIN, MEMBER, VIEWER (lecture seule), invitations par lien.
- Intégrations : clés d'API pour une API publique en lecture seule, webhooks signés, serveur MCP.
- Export de données d'un dossier en Excel, CSV ou JSON, avec des modèles de colonnes.

### Annoncés, pas construits
Parc immobilier (bâtiments, appartements, historique des travaux), appels d'offres, détail d'un rapport hors dossier, liste globale des plans.

## Assistant IA

L'IA n'est pas un module séparé : elle se propose là où elle sert, à la demande de l'utilisateur, qui garde la main.

**À la création du dossier**
- Lire un document ou un CECB et pré-remplir le bâtiment, ses surfaces, ses données énergétiques et ses premiers relevés.

**Pendant la visite (le Guide IA)**
- Analyser les photos d'un ouvrage et proposer un état, une priorité, une justification et une note ; dire s'il faut une photo de plus.
- Vérifier que la photo montre bien l'ouvrage choisi.
- Refuser d'évaluer une photo inutilisable (capture d'écran, photo d'un écran ou d'un document, sujet sans rapport, image floue ou sombre, autre ouvrage que celui choisi) : aucun état n'est proposé, la raison est dite, et l'app propose de supprimer la photo en cause.
- Discuter l'analyse : l'utilisateur conteste, l'IA peut réviser.
- Trois réglages : analyse automatique à la première photo, à la demande, ou désactivée.

**Sur l'étiquette énergétique**
- Lire un CECB en PDF et en extraire les valeurs, que l'utilisateur valide.

**Conversation libre (page Assistant)**
- Questions sur un ou plusieurs dossiers joints (jusqu'à cinq) et sur le parc, avec photos jointes.

### Garde-fous
- L'IA ne valide jamais seule : l'état, la note ou les suggestions ne s'appliquent que par un bouton de l'utilisateur.
- Une photo inutilisable ne repart jamais avec un état, même si le modèle en propose un : le serveur l'efface.
- Sans clé configurée, l'assistant se dit indisponible et le reste de l'app fonctionne.
- Les demandes sont limitées par personne (40 par tranche de 10 minutes).

## Modèle de données (essentiel)

```
User { role: DT | REGIE | ARCHITECT | PARTICULIER | ADMIN, préférences, 2FA, connexion Apple }
  └ Organization (membres OWNER | ADMIN | MEMBER | VIEWER, invitations)

Operation (plusieurs bâtiments d'un chantier)
Project (= dossier, un bâtiment)
  ├ adresse, NPA, canton, parcelle, coordonnées, EGID, EGRID
  ├ buildingType, yearBuilt, renovationYear, logements, étages, surfaces, windowPct
  ├ honoraryPct, reservePct, status, données énergétiques, apparence des rapports
  ├ shareToken (partage en lecture seule), visitPlan
  ├ ProjectContact[], ProjectMail[] (visite), Plan[], Event[], ProjectVariant[] → VariantLine[]
  └ Diagnostic[]
       └ DiagnosticItem[] (relevé)
            ├ articleId + etapeNumero (identité du relevé), localisation (communs | logements)
            ├ state (TRES_BON | BON | MOYEN | MAUVAIS), priority (I | II | III)
            ├ photos, notes, works, area, unit, yearInstalled, interventionYear
            └ estimatedCost, improvement(Cost), norms(Cost), costIndex

Base CFC v3 : CfcNomenclature, Article → ArticleEtat (six états), EtapeVisite, ArticleEtape,
              PosteAutomatique, ArticleHistorique
Ancien catalogue (seed) : CfcCatalogEntry, CatalogItem
Notification, PushSubscription (navigateur), AppareilPush (iPhone/iPad)
Partner, PartnerRequest ; SupportTicket, SupportMessage
ApiKey, ApiAccessLog, WebhookEndpoint, WebhookDelivery
```

## Stack technique

**Front** : React 19 + TypeScript + Vite + Tailwind v4 (variables CSS `@theme`) + React Router 7 + TanStack Query (cache persisté sur l'appareil) + Zustand + Recharts + Leaflet (carte) + pdf.js (plans) + jsPDF + Lucide React. Composants UI maison.

**App iPhone et iPad** : le même front, embarqué par Capacitor 8, avec des plugins Swift maison (impression, connexion Apple et Google, barre du bas native). Compilée et envoyée sur TestFlight par GitHub Actions (voir `APP-IOS.md`).

**Hors ligne** : file d'envoi des relevés sur l'appareil (fichiers de l'app sur iOS, IndexedDB sur le web), identifiants de relevé créés sur l'appareil, création idempotente côté serveur.

**Back** : Node.js + Express + TypeScript + Prisma + MySQL 8. JWT (accès 15 min, rafraîchissement 7 jours, renouvelé à chaque usage), 2FA par application ou par email, Nodemailer, Web Push et APNs. Photos des relevés en data URL dans le relevé, plans en fichiers sur le disque, servis par lien signé.

**IA** : appels du serveur à l'API d'Anthropic (modèle réglable par `ANTHROPIC_MODEL`).

**Hébergement** : Infomaniak (hébergement Node.js), le même service servant l'API et le site construit (voir `DEPLOIEMENT.md`).

**Intégrations** :
- `api3.geo.admin.ch` : autocomplétion d'adresse, registre des bâtiments, parcelle ;
- cadastres RDPPF de Vaud et de Genève : affectation de la parcelle ;
- fonds de carte CARTO.

## Principes UX

**Vocabulaire** : on dit *Diagnostic* (jamais « projet »), *Relevé* pour l'éditeur, *Coûts* (jamais « métrés »), *Calendrier* (jamais « planning »), *Base de données* pour la base CFC, *Étiquette énergétique* pour l'écran CECB.

**Design system**
- Couleur principale presque noire (`#1d1d1f`) ; l'éditeur du relevé passe au bleu Diagly (`#0167ea`), celui de la coche du logo. Police Inter.
- UI sobre, professionnelle, **aucun emoji**, icônes Lucide React (SF Symbols dans la barre native de l'iPhone).
- Textes 100% français (Suisse romande), montants en CHF au format suisse romand (milliers séparés par une espace), dates « 9 avril 2026 ».
- Couleurs sémantiques : Priorité I = rouge, II = orange, III = vert ; Mauvais = rouge, Moyen = orange, Bon = vert clair, Très bon = vert.
- Téléphone (sous 768 px) : version de terrain, barres en verre, une barre en bas ; au-dessus, l'app complète avec son menu de gauche, repliable.

**Menu de gauche**
1. Hors dossier : Nouveau diagnostic, puis Accueil, Diagnostics, Base de données, Intégrations, Parc immobilier, Prestataires, Paramètres, Aide & support ; en bas, le compte et l'Assistant.
2. Dans un dossier : le Relevé en tête, puis Bâtiment (Fiche du bâtiment, Visite, Plans, Étiquette énergétique), Analyse (Coûts, Variantes), Documents (Photos, Rapports).

**Accueil** : la carte « Reprendre » sur le dernier dossier modifié, des accès rapides et l'activité récente.

**Diagnostic toujours modifiable** : aucune donnée n'est figée ; une quantité ou un coût saisi à la main n'est plus recalculé.

## Workflows clés

### Visite terrain (téléphone, iPad)
1. Ouvrir le dossier ; « Préparer pour le terrain » le met sur l'appareil avant de partir.
2. Le relevé s'ouvre sur les étapes de visite, dans l'ordre du tour du bâtiment.
3. Pour chaque ouvrage : présent ou absent, photo, état, priorité, notes ; le Guide IA propose sur demande.
4. Le récapitulatif signale les oublis.
5. Les saisies faites sans réseau partent d'elles-mêmes au retour du réseau.

### Production du rapport
1. Choisir le rapport (Complet, Rapport, De l'existant, Photos).
2. Personnaliser logo et couleur pour ce dossier si besoin.
3. Imprimer en PDF, exporter les données, ou partager un lien en lecture seule.

## Calculs métier

```
Quantité d'un ouvrage = valeur de sa base × coefficient de l'article
  (une quantité corrigée à la main l'emporte)
Surface façade        = périmètre × nb étages × hauteur d'étage (2,7 m par défaut),
                        à défaut la surface de façade saisie
Surface fenêtres      = façade × part vitrée
Façade sans fenêtres  = façade − fenêtres
Pièces d'eau          = nb logements × 2
Portes d'entrée       = nb cages
Stores, eaux pluviales, sprinklers : règles nommées du classeur

Prix unitaire          = prix de l'état retenu ; pour l'état moyen,
                         part fixe + part × prix de l'état mauvais
Montant d'un ouvrage   = quantité × prix unitaire
Postes automatiques    = protection des ouvrages, échafaudage de façade
                         (si un ouvrage à échafauder est chiffré), échafaudage de cage
                         (murs ou plafonds de la cage en mauvais état), nettoyage

Honoraires = total HT × honoraires %
Réserve    = (HT + honoraires) × réserve %
TVA        = (HT + honoraires + réserve) × 8,1 %
Total      = HT + honoraires + réserve + TVA

Année d'intervention (si non saisie) : priorité I = année de la visite,
  II = +5 ans, III = +10 ans (horizons « 0 à 5 ans », « 5 à 10 ans », « au-delà de 10 ans »)
Coefficient marché = indice courant / indice de base (1 par défaut) ;
  la réindexation d'un dossier l'applique aux coûts qui n'ont pas été forcés à la main
```

L'amélioration est une option, chiffrée à part et hors du total principal du devis ; la mise aux normes y entre. Les défauts d'un nouveau dossier : honoraires 12 %, réserve 10 %, part vitrée 30 %.
