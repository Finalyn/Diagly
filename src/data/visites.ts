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
  icone: 'boussole' | 'dossier' | 'onglets' | 'aide'
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
        texte: 'Cette visite vous montre l’application écran par écran : la fenêtre reste ouverte pendant que vous faites. Commençons par là où vous êtes.',
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
        cible: '[data-visite="aide-visites"]',
        cote: 'bas',
        titre: 'Les visites guidées',
        texte: 'Elles partent toutes d’ici. Chacune ouvre l’écran concerné, entoure le bouton dont elle parle, et vous laisse cliquer dessus en chemin.',
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
        texte: 'C’est votre tableau de bord : les chiffres du moment et les dossiers en cours. Tout le reste part du menu de gauche.',
      },
      {
        cible: '[data-visite="nav-projects"]',
        cote: 'droite',
        titre: 'Vos diagnostics',
        texte: 'Le cœur de l’application. Un diagnostic, c’est un bâtiment : son relevé, son chiffrage, ses rapports.',
      },
      {
        cible: '[data-visite="nouveau"]',
        cote: 'droite',
        titre: 'Créer un dossier',
        texte: 'Ce bouton est accessible de partout. L’adresse suffit pour démarrer : Diagly va chercher seul les données publiques du bâtiment.',
      },
      {
        cible: '[data-visite="nav-cfc"]',
        cote: 'droite',
        titre: 'La base de données',
        texte: 'Votre catalogue d’ouvrages CFC : les prix unitaires, les unités et les textes qui partiront dans vos rapports. Vous pouvez tout y adapter à votre pratique.',
      },
      {
        cible: '[data-visite="nav-buildings"]',
        cote: 'droite',
        titre: 'Le parc immobilier',
        texte: 'La même matière, vue comme un patrimoine plutôt que dossier par dossier. C’est la vue des régies et des propriétaires institutionnels.',
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
    id: 'dossier',
    titre: 'Tout ce que contient un dossier',
    objectif: 'Faire le tour des huit onglets d’un diagnostic, outil Plans compris.',
    duree: '5 min',
    icone: 'onglets',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        titre: 'Le dossier est créé',
        texte: 'Il est maintenant fait de huit onglets, et tout part du relevé. Je vous les montre un par un, puis nous descendrons dans l’outil Plans, qui est le plus riche.',
      },
      {
        route: '/app/projects',
        cible: '[data-visite="liste"]',
        cote: 'haut',
        sauterSi: '[data-visite="onglet-diagnostic"]',
        titre: 'Ouvrez un dossier',
        texte: 'Cliquez sur une ligne de la liste : les huit onglets nous attendent à l’intérieur. Si vous venez d’en créer un, vous y êtes déjà et je passe cette étape.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="onglet-diagnostic"]',
        cote: 'bas',
        titre: 'Diagnostic, le cœur',
        texte: 'C’est ici que le travail se fait : chaque ouvrage, son état parmi quatre, ses photos, sa quantité. Tout le reste de l’application se nourrit de cet onglet.',
      },
      {
        cible: '[data-visite="onglet-photos"]',
        cote: 'bas',
        titre: 'Photos',
        texte: 'Toutes les photos du dossier rassemblées, ouvrage par ouvrage. C’est la matière du reportage photo et du rapport documenté.',
      },
      {
        cible: '[data-visite="onglet-couts"]',
        cote: 'bas',
        titre: 'Coûts',
        texte: 'Le chiffrage avec le détail du calcul : prix unitaire, quantité, indexation sur l’indice suisse, honoraires, réserve, TVA. Rien n’y est saisi, tout s’y ajuste.',
      },
      {
        cible: '[data-visite="onglet-variantes"]',
        cote: 'bas',
        titre: 'Variantes',
        texte: 'Les trois scénarios comparés : maintenance, rénovation, rénovation énergétique. C’est la vue qui sert à la discussion avec le propriétaire.',
      },
      {
        cible: '[data-visite="onglet-rapports"]',
        cote: 'bas',
        titre: 'Rapports',
        texte: 'Huit documents, de l’état des lieux au rapport complet, tous paginés en A4 avec votre logo. Et le lien de partage pour votre client.',
      },
      {
        cible: '[data-visite="onglet-cecb"]',
        cote: 'bas',
        titre: 'Étiquette énergétique',
        texte: 'La performance du bâtiment, et l’import d’un certificat énergétique en PDF : Diagly en extrait les données que vous validez avant application.',
      },
      {
        cible: '[data-visite="onglet-plans"]',
        cote: 'bas',
        titre: 'Plans, et c’est là que ça devient intéressant',
        texte: 'Cliquez sur l’onglet Plans. C’est lui qui transforme un dessin d’architecte en quantités justes dans le diagnostic.',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="plans-ajouter"], [data-visite="plans-vide"]',
        cote: 'gauche',
        titre: 'Importer un plan',
        texte: 'Déposez un PDF ou une image, jusqu’à trente mégaoctets. Un PDF de plusieurs pages est géré tel quel : chaque page garde ses propres mesures et sa propre échelle.',
      },
      {
        cible: '[data-visite="plans-liste"]',
        cote: 'haut',
        titre: 'Vos plans',
        texte: 'Chaque vignette montre le plan, son nombre de pages et le nombre de mesures déjà rattachées à un ouvrage. Un clic l’ouvre dans l’éditeur.',
      },
      {
        cible: '[data-visite="plan-vignette"]',
        cote: 'bas',
        titre: 'Ouvrez un plan',
        texte: 'Cliquez sur une vignette : l’éditeur s’ouvre en plein écran et je vous montre ses outils. Si vous n’avez pas encore de plan, passez à la suite, je vous les décris quand même.',
        avanceAuClic: true,
      },
      {
        titre: 'L’éditeur s’ouvre sur l’étalonnage',
        texte: 'Tant qu’une page n’a pas d’échelle, les outils de mesure restent inaccessibles : une surface relevée sur un plan non étalonné serait fausse sans que rien ne le signale.',
      },
      {
        cible: '[data-outil="calibrate"]',
        cote: 'droite',
        titre: 'Étalonner',
        texte: 'Tracez un trait sur la cote connue la plus longue du plan, puis saisissez sa longueur réelle en mètres, centimètres ou millimètres. Sur un document de plusieurs pages, Diagly propose d’appliquer l’échelle aux autres pages, avec un aperçu de chacune.',
      },
      {
        cible: '[data-outil="measure"]',
        cote: 'droite',
        titre: 'Mesurer',
        texte: 'Une cote entre deux points, affichée en direct. De quoi vérifier une dimension sans sortir le mètre.',
      },
      {
        cible: '[data-outil="hatch"]',
        cote: 'droite',
        titre: 'Tracer une zone',
        texte: 'Au glisser pour un rectangle, point par point pour une forme libre. La surface s’affiche en direct, arrondie au demi mètre carré.',
      },
      {
        titre: 'Rattacher la zone à un ouvrage',
        texte: 'Dès la zone tracée, Diagly propose de la rattacher à un ouvrage du diagnostic. La liste des mesures, à droite de l’éditeur, signale en orange celles qui ne le sont pas : un clic sur la ligne ouvre le choix. Le rattachement est possible avant même que l’ouvrage soit relevé.',
      },
      {
        cible: '[data-outil="reference"]',
        cote: 'droite',
        titre: 'Comparer deux états',
        texte: 'Le calque de référence superpose un second plan en transparence, le projet par-dessus l’existant par exemple. Vous choisissez la page à superposer et vous la faites glisser pour l’aligner.',
      },
      {
        titre: 'Annoter, et revenir en arrière',
        texte: 'Dessiner, flèche et note servent à commenter le plan. Ctrl+Z défait le dernier geste et Ctrl+Maj+Z le rejoue, y compris un déplacement ou un changement de couleur. Échap abandonne le tracé en cours sans rien effacer.',
      },
      {
        cible: '[data-visite="plans-quantites"]',
        cote: 'haut',
        titre: 'Reporter dans le diagnostic',
        texte: 'Les zones et les cotes rattachées à un même ouvrage s’additionnent, à travers tous vos plans et toutes leurs pages. Diagly vous montre ce qu’il a mesuré et ce que cela changerait au coût, et vous validez : une quantité ne change jamais toute seule.',
      },
      {
        titre: 'Voilà le dossier',
        texte: 'Relevez, vérifiez les quantités, contrôlez le chiffrage, comparez les variantes, éditez le rapport. Toutes ces visites restent disponibles dans Aide et support, et la documentation écrite va plus loin sur chaque point.',
      },
    ],
  },

  {
    id: 'creation',
    titre: 'Créer un diagnostic',
    objectif: 'Comprendre l’écran de création, et ce que Diagly remplit tout seul.',
    duree: '2 min',
    icone: 'dossier',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        titre: 'Un dossier commence ici',
        texte: 'Trois écrans à remplir, mais presque rien à saisir : l’adresse suffit à Diagly pour aller chercher ce que les registres publics savent déjà du bâtiment.',
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
        texte: 'Commencez à taper puis choisissez dans la liste : code postal, ville, canton, parcelle, année et surface se remplissent seuls. Diagly identifie le bâtiment au registre fédéral et récupère son EGID.',
      },
      {
        cible: '[data-visite="carte"]',
        cote: 'droite',
        titre: 'Vérifiez le bon bâtiment',
        texte: 'Deux entrées voisines portent souvent le même numéro. La carte répond à la question avant que vous ne vous déplaciez : vérifiez que le repère tombe sur le bâtiment à diagnostiquer.',
      },
      {
        titre: 'Ce que vous n’avez pas à saisir',
        texte: 'Emprise, volume, affectation, sensibilité au bruit, zone radon, classe de sol sismique, patrimoine protégé : tout cela arrive seul des services publics. Les contraintes apparaîtront dans le rapport, ce sont des surcoûts à anticiper.',
      },
      {
        titre: 'Puis les deux écrans suivants',
        texte: 'Les surfaces et la géométrie, qui serviront à estimer les quantités, puis les options du dossier. Validez, et le diagnostic s’ouvre sur son relevé.',
      },
    ],
  },
]

export const visiteParId = (id: string | null): Visite | undefined =>
  VISITES.find((v) => v.id === id)

/** Les visites guidées qui accompagnent un tutoriel écrit. */
export const visitesDuTutoriel = (slug: string): Visite[] =>
  VISITES.filter((v) => v.tutoriel === slug)
