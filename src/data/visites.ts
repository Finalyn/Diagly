/**
 * Les visites guidées : ce qu'elles montrent, et dans quel ordre.
 *
 * Une étape désigne un élément réel de l'application par un attribut
 * `data-visite`, posé sur l'élément lui-même. Un sélecteur de classe se serait
 * cassé à la première retouche de style ; un attribut dédié dit explicitement
 * « cet élément est montré », et se voit en relisant le composant.
 *
 * Quand la cible manque (écran différent, dossier absent), l'étape reste : la
 * bulle se centre et l'étape se dit quand même. Une visite ne doit jamais se
 * terminer sur un écran vide.
 */

import type { CoteSouhaite } from '@/lib/visite'

export interface EtapeVisite {
  /** Sélecteur de l'élément à mettre en lumière. */
  cible?: string
  /** Route à ouvrir avant de montrer, si on n'y est pas déjà. */
  route?: string
  titre: string
  texte: string
  /** Côté préféré pour la bulle. */
  cote?: CoteSouhaite
  /**
   * L'étape attend un clic sur l'élément désigné plutôt qu'un clic sur
   * « Suivant » : c'est ainsi qu'on apprend un geste, en le faisant.
   */
  avanceAuClic?: boolean
  /**
   * Sélecteur dont la présence rend l'étape inutile : elle est alors sautée.
   *
   * Une même visite se lance de deux endroits, et certaines étapes ne servent
   * qu'à l'un d'eux : demander d'ouvrir un dossier n'a pas de sens quand on y
   * est déjà.
   */
  sauterSi?: string
}

export interface Visite {
  id: string
  titre: string
  objectif: string
  duree: string
  /** Icône, résolue à l'affichage. */
  icone: 'boussole' | 'dossier' | 'onglets' | 'aide' | 'releve' | 'agenda'
  etapes: EtapeVisite[]
  /** Tutoriel écrit correspondant, pour qui préfère lire. */
  tutoriel?: string
}

export const VISITES: Visite[] = [
  {
    id: 'aide',
    titre: 'Découvrir le centre d’aide',
    objectif: 'Savoir où chercher une réponse, et comment me demander de vous guider.',
    duree: '1 min',
    icone: 'aide',
    etapes: [
      {
        titre: 'Bienvenue dans l’aide',
        texte: 'Les visites vous montrent l’application écran par écran : la bulle reste ouverte pendant que vous faites. Commençons par là où vous êtes.',
      },
      {
        cible: '[data-visite="aide-recherche"]',
        cote: 'bas',
        titre: 'La recherche, d’abord',
        texte: 'Tapez votre question ici. La recherche passe en même temps par la documentation, les tutoriels et les questions fréquentes, accents ou pas.',
      },
      {
        cible: '[data-visite="aide-onglets"]',
        cote: 'bas',
        titre: 'Quatre portes d’entrée',
        texte: 'La documentation pour comprendre, les tutoriels pour faire, les questions fréquentes pour une réponse courte, et vos demandes au support.',
      },
      {
        cible: '[data-visite="aide-onglet-tuto"]',
        cote: 'bas',
        sauterSi: '[data-visite="aide-visites"]',
        titre: 'Ouvrez les tutoriels',
        texte: 'Cliquez sur Tutoriels : les visites guidées y sont rangées, à côté des tutoriels écrits.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="aide-visites"]',
        cote: 'bas',
        titre: 'Les visites guidées',
        texte: 'Elles partent toutes d’ici. Chacune ouvre l’écran concerné et entoure ce dont elle parle. Quand c’est à vous d’agir, il n’y a pas de bouton Suivant : la visite continue dès que vous avez cliqué.',
      },
      {
        cible: '[data-visite="aide-contact"]',
        cote: 'haut',
        titre: 'Si rien de tout cela ne suffit',
        texte: 'Notre équipe prend le relais, captures d’écran comprises. Vous suivez la réponse depuis l’onglet Mes demandes.',
      },
    ],
  },

  {
    id: 'decouverte',
    titre: 'Faire le tour de Diagly',
    objectif: 'Reconnaître chaque écran de l’application et savoir à quoi il sert.',
    duree: '2 min',
    icone: 'boussole',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        route: '/app/dashboard',
        titre: 'On commence par l’accueil',
        texte: 'Votre tableau de bord : le dernier dossier à reprendre, les accès rapides, vos diagnostics par statut et l’activité récente. Tout le reste part du menu de gauche.',
      },
      {
        cible: '[data-visite="dash-reprendre"]',
        cote: 'bas',
        titre: 'Reprendre où vous en étiez',
        texte: 'Le dernier dossier modifié, avec ses chiffres : relevés, urgents, coût estimé, date de visite. Un clic rouvre son relevé.',
      },
      {
        cible: '[data-visite="nav-projects"]',
        cote: 'droite',
        titre: 'Vos diagnostics',
        texte: 'La liste de vos dossiers. Un diagnostic, c’est un bâtiment : son relevé, son chiffrage, ses rapports. Un dossier s’ouvre directement sur son relevé.',
      },
      {
        cible: '[data-visite="nouveau"]',
        cote: 'droite',
        titre: 'Créer un diagnostic',
        texte: 'Accessible de partout. Quatre départs possibles : avec les plans d’architecte (recommandé), avec les valeurs publiques ou les vôtres à partir de l’adresse, depuis un document (ancien rapport, relevé Excel, Word ou PDF), ou depuis un certificat énergétique cantonal (CECB®).',
      },
      {
        cible: '[data-visite="nav-cfc"]',
        cote: 'droite',
        titre: 'La base de données',
        texte: 'Votre catalogue d’ouvrages CFC : les prix unitaires, les unités et les textes qui partiront dans vos rapports. Vous pouvez tout y adapter à votre pratique.',
      },
      {
        cible: '[data-visite="nav-integrations"]',
        cote: 'droite',
        titre: 'Les intégrations',
        texte: 'Pour relier Diagly à vos autres outils : clés d’API pour un ERP ou une gérance, webhooks, et votre propre assistant IA branché sur vos diagnostics.',
      },
      {
        cible: '[data-visite="nav-buildings"]',
        cote: 'droite',
        titre: 'Le parc immobilier',
        texte: 'La même matière, vue comme un patrimoine plutôt que dossier par dossier. C’est la vue des régies et des propriétaires institutionnels.',
      },
      {
        cible: '[data-visite="nav-partenaires"]',
        cote: 'droite',
        titre: 'Les prestataires',
        texte: 'Pour la suite d’un diagnostic : un expert CECB®, un architecte, une entreprise générale, ou un outil comme Arkia pour les images. Partez de votre besoin, contactez-les avec le dossier joint et suivez chaque demande.',
      },
      {
        cible: '[data-visite="nav-settings"]',
        cote: 'droite',
        titre: 'Les paramètres',
        texte: 'Votre compte et votre sécurité, votre entreprise et l’apparence de vos rapports, et votre équipe : membres, invitations, rôles et droits.',
      },
      {
        cible: '[data-visite="recherche"]',
        cote: 'bas',
        titre: 'La recherche générale',
        texte: 'Un diagnostic, un bâtiment, un code CFC : tapez, c’est le chemin le plus court vers n’importe quoi.',
      },
      {
        cible: '[data-visite="assistant"]',
        cote: 'droite',
        titre: 'L’assistant',
        texte: 'Il répond en langage courant sur vos propres diagnostics : les visites montrent les écrans, lui connaît vos données.',
      },
      {
        cible: '[data-visite="nav-support"]',
        cote: 'droite',
        titre: 'Et le centre d’aide',
        texte: 'La documentation, les tutoriels et toutes les visites se lancent depuis ici. Vous savez maintenant où les retrouver.',
      },
    ],
  },

  {
    id: 'creation',
    titre: 'Créer un diagnostic',
    objectif: 'Choisir comment commencer, et voir ce que Diagly remplit tout seul.',
    duree: '2 min',
    icone: 'dossier',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        route: '/app/projects/new',
        cible: '[data-visite="creation-departs"]',
        cote: 'bas',
        sauterSi: '[data-visite="nom"]',
        titre: 'Quatre façons de commencer',
        texte: 'Avec des plans, avec les valeurs publiques ou les vôtres, depuis un document, ou depuis un certificat énergétique. Quand vous partez d’un fichier, l’assistant Diagly le lit et vous relisez tout avant que le dossier soit créé.',
      },
      {
        cible: '[data-visite="depart-plans"]',
        cote: 'bas',
        sauterSi: '[data-visite="nom"]',
        titre: 'Avec des plans, le départ recommandé',
        texte: 'Les plans d’architecte à l’échelle, en PDF ou en photos. L’assistant y lit l’emprise, le périmètre, les étages, la hauteur d’étage et les vitrages : les métrés partent de mesures, et les plans sont rangés dans le dossier.',
      },
      {
        cible: '[data-visite="depart-document"]',
        cote: 'bas',
        sauterSi: '[data-visite="nom"]',
        titre: 'Depuis un document',
        texte: 'Un ancien rapport, un relevé Excel, un état des lieux Word ou PDF. Le bâtiment et les éléments décrits sont repris avec leur état, rattachés à votre base, prêts à vérifier sur place.',
      },
      {
        cible: '[data-visite="depart-cecb"]',
        cote: 'bas',
        sauterSi: '[data-visite="nom"]',
        titre: 'Depuis un certificat énergétique',
        texte: 'Le certificat donne le bâtiment, l’étiquette énergétique, et les éléments visés par ses mesures recommandées, qui entrent dans le relevé à vérifier.',
      },
      {
        cible: '[data-visite="depart-zero"]',
        cote: 'bas',
        sauterSi: '[data-visite="nom"]',
        titre: 'Partons de l’adresse',
        texte: 'Pour cette visite, cliquez sur Valeurs publiques ou personnelles : c’est le chemin le plus court, l’adresse suffit. Pour un vrai dossier, préférez les plans : les valeurs publiques ne sont que des estimations.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="nom"]',
        cote: 'droite',
        titre: 'Le nom du dossier',
        texte: 'Celui sous lequel vous le retrouverez dans la liste. Le nom de l’immeuble, ou celui du mandat.',
      },
      {
        cible: '[data-visite="adresse"]',
        cote: 'droite',
        titre: 'L’adresse, la seule chose vraiment nécessaire',
        texte: 'Commencez à taper puis choisissez dans la liste : code postal, ville, canton, parcelle, année et surfaces se remplissent seuls. Diagly identifie le bâtiment au registre fédéral et récupère son EGID.',
      },
      {
        cible: '[data-visite="carte"]',
        cote: 'droite',
        titre: 'Vérifiez le bon bâtiment',
        texte: 'Deux entrées voisines portent souvent le même numéro. La carte apparaît avec l’adresse : vérifiez que le repère tombe sur le bâtiment à diagnostiquer.',
      },
      {
        titre: 'Ce que vous n’avez pas à saisir',
        texte: 'Emprise, volume, affectation, sensibilité au bruit, zone radon, classe de sol sismique, patrimoine protégé : tout cela arrive seul des services publics. Les contraintes apparaîtront dans le rapport, ce sont des surcoûts à anticiper.',
      },
      {
        titre: 'Puis deux écrans encore',
        texte: 'Les surfaces et la géométrie, qui servent à estimer les quantités, puis le récapitulatif. Validez : le dossier s’ouvre directement sur son relevé.',
      },
    ],
  },

  {
    id: 'releve',
    titre: 'Faire un relevé',
    objectif: 'Parcourir le bâtiment étape par étape, relever un ouvrage et voir ce que Diagly en calcule.',
    duree: '3 min',
    icone: 'releve',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        titre: 'Le relevé, le cœur du dossier',
        texte: 'Tout le reste se nourrit de lui : coûts, variantes, rapports. On l’ouvre en ouvrant le dossier, et l’on suit le bâtiment dans l’ordre de la visite.',
      },
      {
        route: '/app/projects',
        cible: '[data-visite="liste"]',
        cote: 'haut',
        sauterSi: '[data-visite="onglet-diagnostic"]',
        titre: 'Ouvrez un dossier',
        texte: 'Cliquez sur une ligne de la liste : le dossier s’ouvre sur son relevé. Si vous y êtes déjà, je passe cette étape.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="onglet-diagnostic"]',
        cote: 'droite',
        sauterSi: '[data-visite="releve-avancement"]',
        titre: 'Ouvrez le relevé',
        texte: 'Cliquez sur Relevé, en tête du menu du dossier.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="releve-avancement"]',
        cote: 'bas',
        titre: 'Où vous en êtes',
        texte: 'Le tour du bâtiment et sa progression : combien d’ouvrages relevés sur ceux que le bâtiment compte. Un oubli important (un ouvrage dégradé sans photo) s’y signale.',
      },
      {
        cible: '[data-visite="releve-guide"]',
        cote: 'bas',
        titre: 'Le guide IA',
        texte: 'À la demande, il analyse vos photos quand vous le lui demandez ; toujours, il le fait à chaque photo ; sans guide, il se tait. Il propose, vous décidez.',
      },
      {
        cible: '[data-visite="releve-etapes"]',
        cote: 'droite',
        sauterSi: '[data-visite="releve-categories"], [data-visite="releve-ouvrage"], [data-visite="releve-etat"]',
        titre: 'Les étapes de la visite',
        texte: 'Dans l’ordre où l’on marche : dehors, la cage d’escalier, la structure, les locaux techniques, les logements, les aménagements extérieurs. Chaque étape montre ce qu’il y reste à voir.',
      },
      {
        cible: '[data-visite="releve-etape"]',
        cote: 'droite',
        sauterSi: '[data-visite="releve-categories"], [data-visite="releve-ouvrage"], [data-visite="releve-etat"]',
        titre: 'Entrez dans une étape',
        texte: 'Cliquez sur la première étape pour voir ce qu’elle contient.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="releve-categorie"]',
        cote: 'droite',
        sauterSi: '[data-visite="releve-ouvrage"], [data-visite="releve-etat"]',
        titre: 'Choisissez un ouvrage',
        texte: 'L’étape est rangée par ouvrage : façade, fenêtres, balcons… Cliquez sur le premier.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="releve-ouvrage"]',
        cote: 'droite',
        sauterSi: '[data-visite="releve-etat"]',
        titre: 'Le type que vous avez devant vous',
        texte: 'Cliquez sur le type rencontré : il entre dans le relevé, sans état tant que vous n’en avez pas choisi, et sa fiche s’ouvre à droite. Un type déjà relevé s’ouvre simplement.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="releve-etat"]',
        cote: 'gauche',
        titre: 'L’état, le seul vrai choix',
        texte: 'Très bon, bon, moyen ou mauvais. La priorité, les travaux et le coût en découlent tout seuls.',
      },
      {
        cible: '[data-visite="releve-photos"]',
        cote: 'gauche',
        titre: 'Les photos',
        texte: 'Prenez-en une dès que l’état se discute, c’est-à-dire partout où vous relevez moyen ou mauvais. Elles alimentent le rapport photo, et le guide IA peut les lire.',
      },
      {
        cible: '[data-visite="releve-resultat"]',
        cote: 'gauche',
        titre: 'Ce que Diagly calcule',
        texte: 'Les travaux, la priorité, la quantité tirée du bâtiment et le coût. Une quantité ou un coût repris à la main reste tel quel : il ne suit plus le calcul tant que vous ne le lui rendez pas.',
      },
      {
        titre: 'Et l’ouvrage suivant',
        texte: 'Revenez à la liste et continuez la visite : chaque étape se coche à mesure. Le reste du dossier est dans le menu de gauche, la visite « Tout ce que contient un dossier » vous le montre.',
      },
    ],
  },

  {
    id: 'visite',
    titre: 'Organiser la visite',
    objectif: 'Préparer le rendez-vous, prévenir les bonnes personnes et suivre les mails envoyés.',
    duree: '2 min',
    icone: 'agenda',
    tutoriel: 'organiser-visite',
    etapes: [
      {
        titre: 'Avant d’aller sur place',
        texte: 'L’onglet Visite d’un dossier rassemble ce qu’il faut pour que la visite ait lieu : les interlocuteurs, le rendez-vous, la préparation, et un mail tout prêt pour chaque étape.',
      },
      {
        route: '/app/projects',
        cible: '[data-visite="liste"]',
        cote: 'haut',
        sauterSi: '[data-visite="onglet-visite"]',
        titre: 'Ouvrez un dossier',
        texte: 'Cliquez sur une ligne de la liste. Si vous êtes déjà dans un dossier, je passe cette étape.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="onglet-visite"]',
        cote: 'droite',
        sauterSi: '[data-visite="visite-etapes"]',
        titre: 'Ouvrez Visite',
        texte: 'Cliquez sur Visite, dans le menu du dossier.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="visite-etapes"]',
        cote: 'bas',
        titre: 'Où en est l’organisation',
        texte: 'Cinq étapes, des interlocuteurs à la visite effectuée. Elles se cochent toutes seules d’après ce que vous faites ici.',
      },
      {
        cible: '[data-visite="visite-interlocuteurs"]',
        cote: 'gauche',
        titre: 'Les interlocuteurs',
        texte: 'La gérance, le propriétaire, le concierge, les locataires avec leur logement. Ce sont eux qui reçoivent les mails.',
      },
      {
        cible: '[data-visite="visite-rdv"]',
        cote: 'droite',
        titre: 'Le rendez-vous',
        texte: 'La date, l’heure, la durée, le lieu et qui ouvre les locaux. Enregistré, il entre dans votre calendrier avec un rappel et devient la date de visite du diagnostic. Avant de le fixer, proposez des créneaux.',
      },
      {
        cible: '[data-visite="visite-mails"]',
        cote: 'droite',
        titre: 'Un mail pour chaque étape',
        texte: 'Demande de visite, créneaux, documents, confirmation, avis aux locataires, rappel, report, remerciements. Chacun est pré-rempli avec le dossier ; vous le relisez, puis il part ou s’ouvre dans votre messagerie, et il est noté dans l’historique.',
      },
      {
        cible: '[data-visite="visite-preparation"]',
        cote: 'gauche',
        titre: 'La préparation',
        texte: 'Les documents à obtenir, les locaux à rendre accessibles, le matériel à emporter. Les documents pas encore reçus remplissent d’eux-mêmes les mails qui les demandent.',
      },
    ],
  },

  {
    id: 'dossier',
    titre: 'Tout ce que contient un dossier',
    objectif: 'Faire le tour des outils du menu de gauche, outil Plans compris.',
    duree: '4 min',
    icone: 'onglets',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        titre: 'Le menu du dossier',
        texte: 'Un dossier s’ouvre sur son relevé, et ses outils sont rangés dans le menu de gauche : le bâtiment, l’analyse, les documents. Je vous les montre un par un, puis nous descendrons dans l’outil Plans, qui est le plus riche.',
      },
      {
        route: '/app/projects',
        cible: '[data-visite="liste"]',
        cote: 'haut',
        sauterSi: '[data-visite="onglet-diagnostic"]',
        titre: 'Ouvrez un dossier',
        texte: 'Cliquez sur une ligne de la liste. Si vous êtes déjà dans un dossier, je passe cette étape.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="onglet-diagnostic"]',
        cote: 'droite',
        titre: 'Le relevé, toujours en tête',
        texte: 'C’est ici que le travail se fait, ouvrage par ouvrage. La visite « Faire un relevé » le montre en détail.',
      },
      {
        cible: '[data-visite="onglet-fiche"]',
        cote: 'droite',
        titre: 'Fiche du bâtiment',
        texte: 'L’adresse, les surfaces, les étages, les données publiques et les contraintes du terrain. Les quantités du relevé en dépendent.',
      },
      {
        cible: '[data-visite="onglet-visite"]',
        cote: 'droite',
        titre: 'Visite',
        texte: 'Les interlocuteurs, le rendez-vous, la préparation et les mails de chaque étape, pré-remplis.',
      },
      {
        cible: '[data-visite="onglet-cecb"]',
        cote: 'droite',
        titre: 'Étiquette énergétique',
        texte: 'La performance du bâtiment, et l’import d’un certificat en PDF : Diagly en extrait les données que vous validez avant de les appliquer.',
      },
      {
        cible: '[data-visite="onglet-couts"]',
        cote: 'droite',
        titre: 'Coûts',
        texte: 'Le chiffrage avec le détail du calcul : prix unitaire, quantité, indexation sur l’indice suisse, honoraires, réserve, TVA. Rien n’y est saisi, tout s’y ajuste.',
      },
      {
        cible: '[data-visite="onglet-variantes"]',
        cote: 'droite',
        titre: 'Variantes',
        texte: 'Une variante reprend tout le diagnostic et ne change que ce que vous désignez : l’ouvrage remplacé sort du total, la solution retenue prend sa place. Elles se comparent côte à côte.',
      },
      {
        cible: '[data-visite="onglet-photos"]',
        cote: 'droite',
        titre: 'Photos',
        texte: 'Toutes les photos du dossier rassemblées, ouvrage par ouvrage. C’est la matière du rapport photo et du rapport documenté.',
      },
      {
        cible: '[data-visite="onglet-rapports"]',
        cote: 'droite',
        titre: 'Rapports',
        texte: 'Le document remis au client, du rapport complet au rapport photo, en A4 avec votre logo. Il s’imprime, s’exporte, ou se partage par un lien.',
      },
      {
        cible: '[data-visite="onglet-plans"]',
        cote: 'droite',
        titre: 'Métrés, et c’est là que ça devient intéressant',
        texte: 'Déposez les plans du bâtiment : l’IA lit chaque feuille, pose l’échelle, dessine pièces, façades et fenêtres, et compte les portes. Vous validez ce qu’elle propose, les quantités s’additionnent étage par étage, puis se reportent dans le relevé. L’outil s’ouvre en plein écran.',
      },
      {
        titre: 'Voilà le dossier',
        texte: 'Relevez, vérifiez les quantités, contrôlez le chiffrage, comparez les variantes, éditez le rapport. Toutes ces visites restent disponibles dans Aide et support.',
      },
    ],
  },
]

export const visiteParId = (id: string | null): Visite | undefined =>
  VISITES.find((v) => v.id === id)

/** Les visites guidées qui accompagnent un tutoriel écrit. */
export const visitesDuTutoriel = (slug: string): Visite[] =>
  VISITES.filter((v) => v.tutoriel === slug)
