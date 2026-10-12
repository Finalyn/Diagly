// Les questions fréquentes du centre d'aide, par catégorie.
// La documentation et les tutoriels vivent dans `documentation.ts`.

export interface FaqItem { q: string; a: string }
export interface FaqCategory {
  id: string
  label: string
  /** Ce que la catégorie couvre, affiché sous son titre. */
  description: string
  /** Clé d'icône, résolue à l'affichage : les données ne connaissent pas React. */
  icone: 'depart' | 'releve' | 'argent' | 'plan' | 'rapport' | 'donnees' | 'compte' | 'partenaires'
  items: FaqItem[]
}

export const FAQ: FaqCategory[] = [
  {
    id: 'demarrage',
    label: 'Démarrage',
    description: "Les premiers pas, et le vocabulaire de l'application.",
    icone: 'depart',
    items: [
      { q: 'Comment créer mon premier diagnostic ?', a: "Cliquez sur « Nouveau diagnostic » et choisissez votre point de départ : de zéro avec l'adresse (les registres fédéraux remplissent le reste), depuis un document, ou depuis un certificat énergétique cantonal (CECB®). Validez : le dossier s'ouvre directement sur son relevé." },
      { q: "Puis-je partir d'un ancien rapport ou d'un tableau Excel ?", a: "Oui : Nouveau diagnostic → Importer un document. Un PDF, un Word (.docx), un Excel (.xlsx) ou un CSV, 12 Mo au plus. L'assistant Diagly en tire le bâtiment et les éléments décrits, rattachés à votre base avec leur état ; vous relisez et corrigez tout avant que le dossier soit créé." },
      { q: "Qu'est-ce qu'un diagnostic dans Diagly ?", a: "Un diagnostic correspond à l'analyse d'un bâtiment : ses éléments (façades, toiture, fenêtres, chauffage…), leur état, les priorités d'intervention, les coûts estimés et le plan de travaux. Un bâtiment = un diagnostic." },
      { q: 'Puis-je regrouper plusieurs bâtiments ?', a: "Oui : un diagnostic « multi-bâtiments » regroupe plusieurs immeubles d'une même opération (utile pour une régie ou une PPE). Les coûts peuvent être agrégés à l'échelle du regroupement." },
      { q: 'Sur quels appareils Diagly fonctionne-t-il ?', a: "Diagly est une application web responsive : ordinateur, tablette et smartphone. Le mode hors-ligne permet de continuer à saisir sur le terrain sans réseau ; les modifications se synchronisent au retour de la connexion." },
    ],
  },
  {
    id: 'diagnostic',
    label: 'Diagnostic',
    description: "Le relevé : états, priorités, codes CFC, photos.",
    icone: 'releve',
    items: [
      { q: 'Comment sont notés les états des éléments ?', a: "Chaque élément reçoit un état parmi quatre : Très bon, Bon, Moyen, Mauvais (fin de vie). L'état détermine automatiquement la priorité et le coût estimé de l'intervention." },
      { q: 'À quoi correspondent les priorités I, II, III ?', a: "Priorité I = intervention urgente (généralement état Mauvais). Priorité II = à moyen terme. Priorité III = à long terme. La priorité alimente l'année d'intervention du plan de travaux." },
      { q: "Qu'est-ce qu'un code CFC ?", a: "Le CFC (Code des Frais de Construction) est la nomenclature suisse normalisée des ouvrages : 221 = fenêtres, 224 = toiture, 226 = façades, 242 = chauffage, etc. Chaque élément diagnostiqué est rattaché à un code CFC." },
      { q: "Puis-je personnaliser les prix et le catalogue d'éléments ?", a: "Oui, dans Base de données, avec un rôle Administrateur ou Propriétaire : prix unitaires par état, unités, travaux, et vos propres articles. Chaque modification d'un article garde son historique." },
      { q: 'Comment organiser la visite avec la gérance ?', a: "Dans l'outil Visite du dossier : enregistrez les interlocuteurs, fixez le rendez-vous (il entre dans votre calendrier) et envoyez les mails pré-remplis de chaque étape, de la demande de visite aux remerciements. Tout ce qui part est gardé dans l'historique." },
      { q: "Comment ajouter des photos et des observations ?", a: "Dans l'éditeur d'un élément, prenez ou importez des photos et saisissez une observation libre. Elles apparaissent dans le rapport documenté et le reportage photo." },
      { q: "L'année d'intervention est-elle modifiable ?", a: "Oui. Par défaut elle est déduite de la priorité (P1 = année de la visite, P2 = +3 ans, P3 = +7 ans), mais vous pouvez la fixer manuellement par élément." },
    ],
  },
  {
    id: 'couts',
    label: 'Coûts & variantes',
    description: "Du prix unitaire au budget, et les variantes.",
    icone: 'argent',
    items: [
      { q: 'Comment le coût d\'un élément est-il calculé ?', a: "Coût = prix unitaire de l'état × quantité, indexé sur un coefficient marché (indice suisse des prix de la construction, OFS). La quantité est estimée depuis la géométrie du bâtiment ou saisie à la main." },
      { q: 'Que contiennent les trois enveloppes ?', a: "Réparation (remise en état de l'existant), Amélioration (montée en gamme, confort) et Mise aux normes (isolation, énergie, mise aux normes). Elles sont chiffrées séparément par élément." },
      { q: 'Comment fonctionnent les honoraires, la réserve et la TVA ?', a: "Total = HT × (1 + honoraires %) × (1 + réserve %) × 1.081 (TVA 8.1 %). Les pourcentages d'honoraires et de réserve sont ajustables par dossier, dans Coûts." },
      { q: 'Comment fonctionnent les variantes ?', a: "Une variante compare une autre façon de faire : isoler par l'intérieur, passer au pellet, etc. Elle reprend tout le diagnostic et ne change que les ouvrages que vous désignez ; corriger le diagnostic met à jour toutes les variantes. Chacune affiche son budget complet, du HT au TTC, à côté du diagnostic de base." },
      { q: 'D\'où vient le coefficient marché ?', a: "De l'indice suisse des prix de la construction (OFS/BFS). Les prix du catalogue sont une base de référence, indexée sur le marché actuel. Le coefficient appliqué est affiché dans la synthèse des coûts." },
    ],
  },
  {
    id: 'energie',
    label: 'Étiquette énergétique',
    description: "Certificat énergétique et classe du bâtiment.",
    icone: 'plan',
    items: [
      { q: 'Comment importer un certificat énergétique ?', a: "Dès la création (Nouveau diagnostic → Partir d'un certificat énergétique), ou plus tard dans Étiquette énergétique, en déposant le PDF. Diagly extrait les données (SRE, classes, agent énergétique, mesures) que vous validez avant application." },
      { q: 'Que signifie la classe énergétique ?', a: "La classe (A à G) qualifie la performance énergétique de l'enveloppe et globale du bâtiment. Elle est reprise dans les rapports." },
    ],
  },
  {
    id: 'batiment',
    label: 'Données du bâtiment',
    description: "EGID, registre fédéral et données publiques.",
    icone: 'donnees',
    items: [
      { q: "Qu'est-ce que l'EGID ?", a: "L'EGID est l'identifiant fédéral unique du bâtiment (registre GWR/RegBL). Il sert de clé de jointure universelle avec les systèmes immobiliers suisses et est inclus dans tous les exports et l'API." },
      { q: 'Comment Diagly récupère-t-il les données géo ?', a: "Depuis les services publics geo.admin.ch : affectation (RDPPF/ÖREB cantonal), sensibilité au bruit, radon, classe de sol sismique, patrimoine protégé (ISOS/UNESCO), emprise et volume GWR. C'est gratuit et automatique." },
      { q: 'Les contraintes patrimoniales sont-elles signalées ?', a: "Oui. Si le bâtiment est en secteur protégé (ISOS, UNESCO, BLN) ou en zone radon élevée, un avertissement apparaît dans le rapport (surcoûts patrimoniaux ou mesures possibles)." },
    ],
  },
  {
    id: 'rapports',
    label: 'Rapports & partage',
    description: "Les documents à éditer et le partage au client.",
    icone: 'rapport',
    items: [
      { q: 'Quels types de rapports puis-je générer ?', a: "Dans Rapports : Complet, Rapport (version resserrée), De l'existant (état des lieux sans chiffrage) et Rapports photo. Tous paginés en A4, imprimables en PDF et partageables par un lien." },
      { q: 'Comment partager un rapport avec mon client ?', a: "Dans Rapports, cliquez sur « Partager » : un lien en lecture seule est généré (sans authentification). Vous pouvez le révoquer à tout moment. Vos informations d'entreprise (logo, coordonnées) apparaissent en en-tête." },
      { q: 'Puis-je personnaliser l\'en-tête des rapports ?', a: "Oui : le logo et la couleur dans Paramètres → Personnalisation, le nom et les coordonnées dans Paramètres → Entreprise. Pour un seul dossier, « Personnaliser » dans Rapports change le logo, la couleur ou l'auteur sans toucher aux autres." },
    ],
  },
  {
    id: 'integrations',
    label: 'Export & intégrations',
    description: "Exports, API, webhooks et assistants.",
    icone: 'donnees',
    items: [
      { q: 'Quels formats d\'export sont disponibles ?', a: "Excel (.xlsx), CSV et JSON, via le bouton « Exporter » (Coûts et Rapports). L'Excel comporte des onglets Bâtiment, Éléments, Plan de travaux, Variantes, Chiffrage. Les colonnes sont configurables et enregistrables comme modèle." },
      { q: 'Comment fonctionne l\'API REST ?', a: "Une API v1 en lecture seule expose vos diagnostics, éléments, coûts, plan de travaux et bâtiments. Authentification par clé d'API. Documentation interactive (OpenAPI) et spécification disponibles dans Intégrations → Clés API." },
      { q: 'Où créer une clé d\'API ?', a: "Dans Intégrations → Clés API : « Créer une clé ». La clé n'est affichée qu'une seule fois, copiez-la. Elle est révocable à tout moment et limitée strictement à vos diagnostics." },
      { q: 'À quoi servent les webhooks ?', a: "Les webhooks notifient vos systèmes tiers en temps réel (diagnostic finalisé, rapport généré, élément modifié, plan de travaux mis à jour). Payload signé HMAC, avec journal des livraisons et rejeu. Configuration dans Intégrations → Webhooks." },
      { q: 'Qu\'est-ce que le serveur MCP ?', a: "Le serveur MCP permet de brancher votre propre assistant IA (Claude, etc.) sur vos diagnostics : il répond en langage naturel (« budget fenêtres en 2028 », « bâtiments en priorité I »). Adresse et outils dans Intégrations → Assistant IA (MCP), authentifié par clé d'API." },
    ],
  },
  {
    id: 'partenaires',
    label: 'Prestataires',
    description: "Les professionnels et les outils qui prennent la suite.",
    icone: 'partenaires',
    items: [
      { q: 'À quoi sert la section Prestataires ?', a: "À trouver qui prendra la suite d'un diagnostic : un expert CECB® pour le certificat énergétique, un architecte pour la rénovation, une entreprise générale pour les offres de travaux, ou un outil comme Arkia pour montrer le bâtiment rénové. Partez de votre besoin : Prestataires → De quoi avez-vous besoin ?" },
      { q: 'Qui choisit les prestataires ?', a: "Finalyn tient l'annuaire : elle sélectionne les prestataires et contrôle leurs certifications. Un expert CECB® n'apparaît comme tel que s'il figure sur la liste officielle de l'Association CECB. L'écusson vert indique ce qui a été vérifié." },
      { q: 'Que reçoit le prestataire quand je le contacte ?', a: "Votre message, à votre nom. Si vous joignez un dossier, il reçoit aussi le résumé du bâtiment : adresse, type, année, nombre d'éléments relevés, priorités et coût estimé. Le rapport complet n'est joint, en lecture seule, que si vous le cochez. Le prestataire vous répond directement par email." },
      { q: 'Comment suivre mes demandes ?', a: "Dans Prestataires → Mes demandes. Chaque demande garde son message et le dossier joint. Notez quand le prestataire a répondu, puis marquez la demande comme terminée." },
      { q: "Comment profiter de l'offre d'un outil ?", a: "Dans Prestataires, « Profiter de l'offre » ouvre le site de l'outil avec l'offre réservée aux utilisateurs de Diagly, par exemple des crédits offerts à l'inscription." },
    ],
  },
  {
    id: 'equipe',
    label: 'Équipe',
    description: "Organisation, membres et rôles.",
    icone: 'compte',
    items: [
      { q: 'Comment créer une organisation ?', a: "Dans Paramètres > Membres, cliquez sur « Créer l'équipe ». Elle porte le nom de votre société. Vos diagnostics actuels deviennent ceux de l'organisation, et vous en êtes le propriétaire." },
      { q: 'Comment inviter un collaborateur ?', a: "Dans Paramètres > Membres (administrateur), saisissez son email et choisissez un rôle. Un email d'invitation est envoyé (ou un lien copiable si l'email n'est pas configuré). Le collaborateur rejoint l'organisation en cliquant sur le lien." },
      { q: 'Quels sont les rôles disponibles ?', a: "Propriétaire (contrôle total), Administrateur (gère membres + diagnostics), Membre (édite les diagnostics), Lecture seule (consulte uniquement, idéal pour un mandant institutionnel). Les membres partagent les mêmes diagnostics." },
      { q: 'Que se passe-t-il si je retire un membre ?', a: "Il repasse en compte solo : il ne voit plus les diagnostics de l'organisation et retrouve uniquement ses propres données." },
      { q: 'Un compte en lecture seule peut-il modifier des données ?', a: "Non. Le rôle « Lecture seule » consulte l'ensemble des diagnostics mais toute tentative de modification est refusée." },
    ],
  },
  {
    id: 'compte',
    label: 'Compte & sécurité',
    description: "Profil, mot de passe et sécurité.",
    icone: 'compte',
    items: [
      { q: 'Comment activer la double authentification (2FA) ?', a: "Dans Paramètres → Sécurité, choisissez la méthode : une application d'authentification (Google Authenticator, Microsoft Authenticator…), dont vous scannez le QR code, ou un code envoyé par email à chaque connexion. Confirmez avec un premier code. Elle est demandée à chaque connexion, y compris avec Google." },
      { q: 'Où sont hébergées mes données ?', a: "Vos données sont hébergées en Suisse (Infomaniak), chiffrées en transit et au repos. Diagly répond aux exigences de résidence des données des appels d'offres publics suisses." },
      { q: 'Puis-je me connecter avec Google ?', a: "Oui, la connexion Google est disponible sur la page de connexion. Le SSO d'entreprise (OIDC : Microsoft Entra ID, Google Workspace) est prévu pour les clients institutionnels." },
      { q: 'Comment changer mon mot de passe ?', a: "Dans Paramètres → Sécurité → Changer le mot de passe. Toutes vos sessions actives sont révoquées après le changement, par sécurité." },
      { q: "J'ai oublié mon mot de passe", a: "Sur la page de connexion, cliquez sur « Mot de passe oublié » et saisissez votre adresse. Vous recevez un lien valable 30 minutes, utilisable une seule fois. Si rien n'arrive, vérifiez vos courriers indésirables." },
    ],
  },
]
