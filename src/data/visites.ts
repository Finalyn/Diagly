/**
 * Les visites guidées : ce que Diago montre, et dans quel ordre.
 *
 * Une étape désigne un élément réel de l'application par un attribut
 * `data-visite`, posé sur l'élément lui-même. Un sélecteur de classe se serait
 * cassé à la première retouche de style ; un attribut dédié dit explicitement
 * « cet élément est montré », et se voit en relisant le composant.
 *
 * Quand la cible manque (écran différent, dossier absent), l'étape reste : la
 * bulle se centre et Diago explique quand même. Une visite ne doit jamais se
 * terminer sur un écran vide.
 */

import type { Pose } from '@/components/visite/Mascotte'
import type { CoteSouhaite } from '@/lib/visite'

export interface EtapeVisite {
  /** Sélecteur de l'élément à mettre en lumière. */
  cible?: string
  /** Route à ouvrir avant de montrer, si on n'y est pas déjà. */
  route?: string
  titre: string
  texte: string
  pose?: Pose
  /** Côté préféré pour la bulle. */
  cote?: CoteSouhaite
  /**
   * L'étape attend un clic sur l'élément désigné plutôt qu'un clic sur
   * « Suivant » : c'est ainsi qu'on apprend un geste, en le faisant.
   */
  avanceAuClic?: boolean
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
        titre: 'Bonjour, moi c’est Diago',
        texte: 'Je suis votre guide de chantier. Je vous montre l’application écran par écran, et je reste à côté de vous pendant que vous faites. Commençons par là où vous êtes.',
        pose: 'salue',
      },
      {
        cible: '[data-visite="aide-recherche"]',
        cote: 'bas',
        titre: 'La recherche, d’abord',
        texte: 'Tapez votre question ici. Je cherche en même temps dans la documentation, dans les tutoriels et dans les questions fréquentes, accents ou pas.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="aide-onglets"]',
        cote: 'bas',
        titre: 'Quatre portes d’entrée',
        texte: 'La documentation pour comprendre, les tutoriels pour faire, les questions fréquentes pour une réponse courte, et vos demandes au support.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="aide-visites"]',
        cote: 'bas',
        titre: 'Et moi, je vous guide',
        texte: 'Chaque visite guidée part d’ici. Je vous emmène dans l’application, je désigne les boutons, et vous pouvez cliquer dessus pendant que je parle.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="aide-contact"]',
        cote: 'haut',
        titre: 'Si je ne suffis pas',
        texte: 'Notre équipe prend le relais, captures d’écran comprises. Vous suivez la réponse depuis l’onglet Mes demandes.',
        pose: 'bravo',
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
        texte: 'C’est votre tableau de bord : les chiffres du moment et les dossiers en cours. Tout le reste part du menu de gauche, que je vais vous montrer.',
        pose: 'salue',
      },
      {
        cible: '[data-visite="nav-projects"]',
        cote: 'droite',
        titre: 'Vos diagnostics',
        texte: 'Le cœur de l’application. Un diagnostic, c’est un bâtiment : son relevé, son chiffrage, ses rapports.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="nouveau"]',
        cote: 'droite',
        titre: 'Créer un dossier',
        texte: 'Ce bouton est accessible de partout. L’adresse suffit pour démarrer : Diagly va chercher seul les données publiques du bâtiment.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="nav-cfc"]',
        cote: 'droite',
        titre: 'La base de données',
        texte: 'Votre catalogue d’ouvrages CFC : les prix unitaires, les unités et les textes qui partiront dans vos rapports. Vous pouvez tout y adapter à votre pratique.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="nav-buildings"]',
        cote: 'droite',
        titre: 'Le parc immobilier',
        texte: 'La même matière, vue comme un patrimoine plutôt que dossier par dossier. C’est la vue des régies et des propriétaires institutionnels.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="recherche"]',
        cote: 'bas',
        titre: 'La recherche générale',
        texte: 'Un diagnostic, un bâtiment, un code CFC : tapez, c’est le chemin le plus court vers n’importe quoi.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="assistant"]',
        cote: 'droite',
        titre: 'L’assistant',
        texte: 'Lui, il répond en langage courant sur vos propres diagnostics. Moi je montre les écrans, lui connaît vos données.',
        pose: 'explique',
      },
      {
        cible: '[data-visite="nav-support"]',
        cote: 'droite',
        titre: 'Et le centre d’aide',
        texte: 'La documentation, les tutoriels et toutes mes visites se lancent depuis ici. Vous savez maintenant où me retrouver.',
        pose: 'bravo',
      },
    ],
  },

  {
    id: 'diagnostic',
    titre: 'Créer un diagnostic',
    objectif: 'Ouvrir un dossier et comprendre ce que Diagly remplit tout seul.',
    duree: '2 min',
    icone: 'dossier',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        route: '/app/projects',
        cible: '[data-visite="liste"]',
        cote: 'haut',
        titre: 'La liste de vos dossiers',
        texte: 'Chaque ligne est un bâtiment. Le statut dit où en est le dossier, et les filtres au-dessus retrouvent le bon quand la liste s’allonge.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="nouveau-liste"]',
        cote: 'gauche',
        titre: 'À vous de jouer',
        texte: 'Cliquez sur « Nouveau diagnostic ». Je vous suis : la visite continue sur l’écran de création.',
        pose: 'montre',
        avanceAuClic: true,
      },
      {
        route: '/app/projects/new',
        cible: '[data-visite="formulaire"]',
        cote: 'droite',
        titre: 'L’adresse, d’abord',
        texte: 'C’est la seule chose vraiment nécessaire. À partir d’elle, Diagly identifie le bâtiment au registre fédéral et récupère son EGID, son emprise, son volume et son affectation.',
        pose: 'explique',
      },
      {
        titre: 'Ce que vous n’avez pas à saisir',
        texte: 'Les contraintes aussi arrivent seules : zone radon, sensibilité au bruit, patrimoine protégé. Elles apparaîtront dans le rapport, parce que ce sont des surcoûts à anticiper.',
        pose: 'explique',
      },
      {
        titre: 'Puis le relevé',
        texte: 'Une fois le dossier créé, l’onglet Diagnostic vous fait parcourir les ouvrages un par un. Vous donnez un état, Diagly en déduit la priorité, l’année et le coût.',
        pose: 'bravo',
      },
    ],
  },

  {
    id: 'onglets',
    titre: 'Les onglets d’un dossier',
    objectif: 'Savoir ce que contient chacun des huit onglets d’un diagnostic.',
    duree: '2 min',
    icone: 'onglets',
    tutoriel: 'premier-diagnostic',
    etapes: [
      {
        route: '/app/projects',
        cible: '[data-visite="liste"]',
        cote: 'haut',
        titre: 'Ouvrez un dossier',
        texte: 'Cliquez sur une ligne de la liste. Je vous retrouve à l’intérieur, où les huit onglets nous attendent.',
        pose: 'montre',
        avanceAuClic: true,
      },
      {
        cible: '[data-visite="onglet-diagnostic"]',
        cote: 'bas',
        titre: 'Diagnostic',
        texte: 'C’est ici que le travail se fait : chaque ouvrage, son état, ses photos, sa quantité. Tout le reste de l’application se nourrit de cet onglet.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="onglet-couts"]',
        cote: 'bas',
        titre: 'Coûts',
        texte: 'Le chiffrage, avec le détail du calcul : prix unitaire, quantité, indexation, honoraires, réserve, TVA. Rien n’y est saisi, tout s’y ajuste.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="onglet-variantes"]',
        cote: 'bas',
        titre: 'Variantes',
        texte: 'Les trois scénarios comparés : maintenance, rénovation, rénovation énergétique. C’est la vue qui sert à la discussion avec le propriétaire.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="onglet-plans"]',
        cote: 'bas',
        titre: 'Plans',
        texte: 'Vos plans, leur échelle et vos mesures. Une zone tracée ici se rattache à un ouvrage et lui donne sa quantité exacte.',
        pose: 'montre',
      },
      {
        cible: '[data-visite="onglet-rapports"]',
        cote: 'bas',
        titre: 'Rapports',
        texte: 'Huit documents, de l’état des lieux au rapport complet, et le lien de partage pour votre client. Et voilà le tour du dossier.',
        pose: 'bravo',
      },
    ],
  },
]

export const visiteParId = (id: string | null): Visite | undefined =>
  VISITES.find((v) => v.id === id)

/** Les visites guidées qui accompagnent un tutoriel écrit. */
export const visitesDuTutoriel = (slug: string): Visite[] =>
  VISITES.filter((v) => v.tutoriel === slug)
