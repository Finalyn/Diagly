// Les questions fréquentes du centre d'aide, par catégorie.
// La documentation et les tutoriels vivent dans `documentation.ts`.

export interface FaqItem { q: string; a: string }
export interface FaqCategory {
  id: string
  label: string
  /** Ce que la catégorie couvre, affiché sous son titre. */
  description: string
  /** Clé d'icône, résolue à l'affichage : les données ne connaissent pas React. */
  icone: 'depart' | 'releve' | 'argent' | 'plan' | 'rapport' | 'donnees' | 'compte'
  items: FaqItem[]
}

export const FAQ: FaqCategory[] = [
  {
    id: 'demarrage',
    label: 'Démarrage',
    description: "Les premiers pas, et le vocabulaire de l'application.",
    icone: 'depart',
    items: [
      { q: 'Comment créer mon premier diagnostic ?', a: "Depuis l'onglet Diagnostics, cliquez sur « Nouveau diagnostic », renseignez l'adresse et les caractéristiques du bâtiment, puis validez. Vous pouvez ensuite ouvrir l'onglet Diagnostic pour évaluer les éléments un par un." },
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
      { q: "Puis-je personnaliser les prix et le catalogue d'éléments ?", a: "Oui, dans Base de données. Vous pouvez modifier les prix unitaires, unités, travaux et descriptions par état. Vos modifications ne concernent que votre compte (ou votre organisation) ; « Réinitialiser » restaure le catalogue par défaut." },
      { q: "Comment ajouter des photos et des observations ?", a: "Dans l'éditeur d'un élément, prenez ou importez des photos et saisissez une observation libre. Elles apparaissent dans le rapport documenté et le reportage photo." },
      { q: "L'année d'intervention est-elle modifiable ?", a: "Oui. Par défaut elle est déduite de la priorité (P1 = année de la visite, P2 = +3 ans, P3 = +7 ans), mais vous pouvez la fixer manuellement par élément." },
    ],
  },
  {
    id: 'couts',
    label: 'Coûts & variantes',
    description: "Du prix unitaire au budget, et les trois scénarios.",
    icone: 'argent',
    items: [
      { q: 'Comment le coût d\'un élément est-il calculé ?', a: "Coût = prix unitaire de l'état × quantité, indexé sur un coefficient marché (indice suisse des prix de la construction, OFS). La quantité est estimée depuis la géométrie du bâtiment ou saisie à la main." },
      { q: 'Que contiennent les trois enveloppes ?', a: "Réparation (remise en état de l'existant), Amélioration (montée en gamme, confort) et Mise aux normes (isolation, énergie, mise aux normes). Elles sont chiffrées séparément par élément." },
      { q: 'Comment fonctionnent les honoraires, la réserve et la TVA ?', a: "Total = HT × (1 + honoraires %) × (1 + réserve %) × 1.081 (TVA 8.1 %). Les pourcentages d'honoraires et de réserve sont ajustables par projet dans l'onglet Coûts." },
      { q: 'Que sont les 3 variantes de rénovation ?', a: "Trois scénarios comparés : Maintenance (réparation), Rénovation (+ rénovation intérieure estimée) et Rénovation énergétique (+ isolation de l'enveloppe). Chaque variante affiche son budget complet (HT → TTC). Les enveloppes V2/V3 sont estimées depuis la géométrie." },
      { q: 'D\'où vient le coefficient marché ?', a: "De l'indice suisse des prix de la construction (OFS/BFS). Les prix du catalogue sont une base de référence, indexée sur le marché actuel. Le coefficient appliqué est affiché dans la synthèse des coûts." },
    ],
  },
  {
    id: 'energie',
    label: 'Étiquette énergétique',
    description: "Certificat énergétique et classe du bâtiment.",
    icone: 'plan',
    items: [
      { q: 'Comment importer un certificat énergétique ?', a: "Dans l'onglet Étiquette énergétique, cliquez sur « Importer un certificat énergétique » et déposez le PDF. Diagly extrait automatiquement les données (SRE, classes, agent énergétique, mesures) que vous validez avant application." },
      { q: 'Que signifie la classe énergétique ?', a: "La classe (A à G) qualifie la performance énergétique de l'enveloppe et globale du bâtiment. Elle est reprise dans les rapports et sert de référence à la variante « Rénovation énergétique »." },
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
      { q: 'Quels types de rapports puis-je générer ?', a: "Dans l'onglet Variantes : Sommaire, Détaillé, Documenté (avec photos) et Par scénario. Dans l'onglet Rapports : le rapport de diagnostic et le reportage photo. Tous imprimables en PDF." },
      { q: 'Comment partager un rapport avec mon client ?', a: "Dans Rapports, cliquez sur « Partager » : un lien en lecture seule est généré (sans authentification). Vous pouvez le révoquer à tout moment. Vos informations d'entreprise (logo, coordonnées) apparaissent en en-tête." },
      { q: 'Puis-je personnaliser l\'en-tête des rapports ?', a: "Oui, dans Paramètres → Entreprise : nom, adresse, logo, couleur d'accent. Ils sont repris sur les rapports et le partage client." },
    ],
  },
  {
    id: 'integrations',
    label: 'Export & intégrations',
    description: "Exports, API, webhooks et assistants.",
    icone: 'donnees',
    items: [
      { q: 'Quels formats d\'export sont disponibles ?', a: "Excel (.xlsx), CSV et JSON, via le bouton « Exporter » (onglets Coûts, Variantes). L'Excel comporte des onglets Bâtiment, Éléments, Plan de travaux, Variantes, Chiffrage. Les colonnes sont configurables et enregistrables comme modèle." },
      { q: 'Comment fonctionne l\'API REST ?', a: "Une API v1 en lecture seule expose vos diagnostics, éléments, coûts, plan de travaux et bâtiments. Authentification par clé d'API. Documentation interactive (OpenAPI) et spécification disponibles dans Intégrations → Clés API." },
      { q: 'Où créer une clé d\'API ?', a: "Dans Intégrations → Clés API : « Créer une clé ». La clé n'est affichée qu'une seule fois, copiez-la. Elle est révocable à tout moment et limitée strictement à vos diagnostics." },
      { q: 'À quoi servent les webhooks ?', a: "Les webhooks notifient vos systèmes tiers en temps réel (diagnostic finalisé, rapport généré, élément modifié, plan de travaux mis à jour). Payload signé HMAC, avec journal des livraisons et rejeu. Configuration dans Intégrations → Webhooks." },
      { q: 'Qu\'est-ce que le serveur MCP ?', a: "Le serveur MCP permet de brancher votre propre assistant IA (Claude, etc.) sur vos diagnostics : il répond en langage naturel (« budget fenêtres en 2028 », « bâtiments en priorité I »). Adresse et outils dans Intégrations → Assistant IA (MCP), authentifié par clé d'API." },
    ],
  },
  {
    id: 'equipe',
    label: 'Gestion d\'équipe',
    description: "Organisation, membres et rôles.",
    icone: 'compte',
    items: [
      { q: 'Comment créer une organisation ?', a: "Dans Gestion d'équipe, cliquez sur « Créer votre organisation ». Vos diagnostics actuels deviennent ceux de l'organisation, et vous en êtes le propriétaire (OWNER)." },
      { q: 'Comment inviter un collaborateur ?', a: "Dans Gestion d'équipe (administrateur), saisissez son email et choisissez un rôle. Un email d'invitation est envoyé (ou un lien copiable si l'email n'est pas configuré). Le collaborateur rejoint l'organisation en cliquant sur le lien." },
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
      { q: 'Comment activer la double authentification (2FA) ?', a: "Dans Paramètres → Sécurité, activez la 2FA : scannez le QR code avec votre application d'authentification (Google Authenticator, etc.) et confirmez avec un premier code. Elle sera demandée à chaque connexion par mot de passe." },
      { q: 'Où sont hébergées mes données ?', a: "Vos données sont hébergées en Suisse (Infomaniak), chiffrées en transit et au repos. Diagly répond aux exigences de résidence des données des appels d'offres publics suisses." },
      { q: 'Puis-je me connecter avec Google ?', a: "Oui, la connexion Google est disponible sur la page de connexion. Le SSO d'entreprise (OIDC : Microsoft Entra ID, Google Workspace) est prévu pour les clients institutionnels." },
      { q: 'Comment changer mon mot de passe ?', a: "Dans Paramètres → Sécurité → Changer le mot de passe. Toutes vos sessions actives sont révoquées après le changement, par sécurité." },
    ],
  },
]
