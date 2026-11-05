import { Calculator, ClipboardCheck, Database, FileText, MessageCircle, Ruler, Smartphone, type LucideIcon } from 'lucide-react'

/**
 * Le contenu du site public qui n'est pas de la mise en page : la
 * navigation, les tarifs et les questions fréquentes.
 *
 * Les tarifs sont des engagements commerciaux, pas du texte de vitrine : ils
 * vivent ici, en un seul endroit, et les sections les lisent. Le modèle du
 * 20 octobre 2026 : le diagnostic à l'unité, deux abonnements qui comprennent
 * des diagnostics chaque mois et facturent les suivants moins cher, et une
 * offre Entreprise sur devis. Pas de diagnostic offert : c'est la démo qui l'est.
 *
 * Depuis le 4 novembre 2026, les tarifs ne sont plus sur le site : ni section
 * sur l'accueil, ni montant dans la FAQ ou les données pour les moteurs. Le
 * tarif est présenté pendant la démo. Les montants restent notés ici.
 */

/** Un outil de Diagly dans le menu déroulant « Fonctionnalités ». */
export interface OutilNav {
  href: string
  label: string
  /** Ce qu'il fait, en quelques mots. */
  detail: string
  icone: LucideIcon
}

/** Le menu déroulant « Fonctionnalités » : chaque outil mène à sa section de la page. */
export const OUTILS_NAV: OutilNav[] = [
  { href: '/fonctionnalites#metres', label: 'Métrés par l’IA', detail: 'Vos plans, lus et mesurés', icone: Ruler },
  { href: '/fonctionnalites#releve', label: 'Relevé guidé', detail: 'Le tour du bâtiment en 7 étapes', icone: ClipboardCheck },
  { href: '/fonctionnalites#base', label: 'Base de prix CFC', detail: 'Vos prix, par ouvrage et par état', icone: Database },
  { href: '/fonctionnalites#chiffrage', label: 'Chiffrage CFC', detail: 'Le coût, ouvrage par ouvrage', icone: Calculator },
  { href: '/fonctionnalites#rapports', label: 'Rapports', detail: 'À l’en-tête de votre bureau', icone: FileText },
  { href: '/fonctionnalites#assistant', label: 'Assistant Diagly', detail: 'Vos dossiers, en questions', icone: MessageCircle },
  { href: '/fonctionnalites#app', label: 'App iPhone et iPad', detail: 'Sur le terrain, même sans réseau', icone: Smartphone },
]

/**
 * Le menu du haut, le même sur toutes les pages du site (LienSite, ui.tsx).
 * Fonctionnalités ouvre la liste des outils (OUTILS_NAV). Le blog n'y figure
 * pas : il sert au référencement, et le pied de page y mène.
 */
export const NAV: { href: string; label: string; outils?: OutilNav[] }[] = [
  { href: '/fonctionnalites', label: 'Fonctionnalités', outils: OUTILS_NAV },
  { href: '/#pros', label: 'Pourquoi Diagly' },
  { href: '/#faq', label: 'FAQ' },
]

/** Le prix d'un diagnostic acheté à l'unité, en CHF. */
export const PRIX_DIAGNOSTIC = 300

/** Un abonnement : un prix par mois, des diagnostics compris, les suivants à prix réduit. */
export interface Abonnement {
  nom: string
  /** CHF par mois. */
  prixMois: number
  /** Diagnostics compris chaque mois. */
  inclus: number
  /** CHF par diagnostic au-delà de ceux compris. */
  prixSuivant: number
}

export const PLUS: Abonnement = { nom: 'Plus', prixMois: 890, inclus: 5, prixSuivant: 180 }
export const PRO: Abonnement = { nom: 'Pro', prixMois: 2490, inclus: 20, prixSuivant: 120 }

/** La durée d'engagement d'un abonnement, en mois : il se souscrit pour un an. */
export const ENGAGEMENT_MOIS = 12

export const CONTACT = 'mailto:contact@diagly.ch'

/**
 * Devenir partenaire : un e-mail déjà préparé. L'annuaire est tenu par
 * l'équipe, qui ajoute chaque partenaire elle-même après vérification.
 */
export const DEVENIR_PARTENAIRE = `${CONTACT}?subject=${encodeURIComponent('Devenir partenaire Diagly')}&body=${encodeURIComponent(
  'Bonjour,\n\nNous aimerions figurer dans l’annuaire des partenaires Diagly.\n\nEntreprise :\nMétier :\nCantons :\nSite web :\nTéléphone :\n\nMerci et à bientôt,',
)}`

/**
 * Les questions qu'un diagnostiqueur pose avant d'essayer. Chaque réponse
 * décrit ce que l'application fait aujourd'hui, rien de plus.
 */
export const QUESTIONS: { q: string; r: string }[] = [
  {
    q: 'L’IA peut-elle se tromper sur un métré ?',
    r: 'Oui, comme toute lecture automatique. C’est pourquoi rien de ce qu’elle dessine n’entre dans les totaux avant votre validation. Chaque forme proposée porte son niveau de confiance et ce que disent les cotes, et l’échelle de chaque feuille est contrôlée sur une cote avant d’être posée.',
  },
  {
    q: 'Quels plans puis-je déposer ?',
    r: 'Des PDF, vectoriels ou scannés, et des images PNG, JPEG ou WebP, jusqu’à 30 Mo par fichier. Un plan papier se photographie depuis Diagly : vous ajustez les quatre coins et il devient un plan à métrer.',
  },
  {
    q: 'Que valent les estimations de coûts ?',
    r: 'Ce sont des estimations indicatives, à plus ou moins 15 %, calculées avec les prix de votre propre base et les quantités du bâtiment. Elles servent à arbitrer et à budgéter. Elles ne remplacent ni le devis d’une entreprise ni une expertise.',
  },
  {
    q: 'Les codes CFC sont-ils respectés ?',
    r: 'Oui. Chaque ouvrage porte son code CFC, son unité et sa quantité, et le rapport comme les exports suivent cette structure.',
  },
  {
    q: 'Sur quels appareils fonctionne Diagly ?',
    r: 'Partout. L’app iPhone et iPad est faite pour le terrain : la navigation d’iOS, son scanner de documents, le relevé hors connexion. Sur Mac et PC, Diagly s’installe comme une application. Et sans rien installer, il fonctionne dans le navigateur.',
  },
  {
    q: 'Et sans réseau, au sous-sol ?',
    r: 'Les relevés se font hors ligne : ils restent sur l’appareil et partent dès que le réseau revient. Préparez le dossier pour le terrain avant la visite pour l’avoir sous la main.',
  },
  {
    q: 'Où sont hébergées mes données ?',
    r: 'En Suisse, chez Infomaniak. Quand vous lancez une analyse par l’IA (photo, plan, document ou question à l’assistant), les éléments concernés sont envoyés à notre fournisseur d’IA, Anthropic, aux États-Unis, pour y être analysés ; vos dossiers restent stockés en Suisse. Le Guide IA des photos peut être réglé sur « Sans guide ».',
  },
  {
    q: 'Puis-je exporter mes données ?',
    r: 'Oui. Les données d’un diagnostic sortent en Excel, CSV ou JSON, les métrés en Excel, les rapports en PDF. Une API en lecture et des webhooks relient Diagly à vos propres outils.',
  },
  {
    q: 'Diagly peut-il m’aider à trouver des mandats ?',
    r: 'C’est l’une de ses meilleures utilisations. Proposé à un propriétaire, une régie ou une PPE, le diagnostic montre l’état du bâtiment et les travaux à prévoir, chiffrés par code CFC : c’est le point de départ naturel du mandat de rénovation, que vous le meniez vous-même ou avec des partenaires de l’annuaire Diagly.',
  },
  {
    q: 'Comment devenir partenaire ?',
    r: 'Écrivez-nous à contact@diagly.ch avec votre métier, vos cantons et vos coordonnées. L’annuaire est tenu par l’équipe Diagly : nous vous y ajoutons après vérification, et le titre d’expert CECB® est contrôlé sur la liste officielle. Les utilisateurs de Diagly vous contactent ensuite depuis leur dossier : leur demande vous arrive par e-mail, avec le résumé du bâtiment et le lien du rapport s’ils les joignent.',
  },
  {
    q: 'Combien coûte Diagly ?',
    r: `Vous payez au diagnostic, à l’unité, ou vous prenez un abonnement. ${PLUS.nom} comprend ${PLUS.inclus} diagnostics chaque mois et ${PRO.nom} en comprend ${PRO.inclus} ; les suivants sont facturés moins cher. Les abonnements se souscrivent pour un an et comprennent une heure de formation la première année. Pour un parc immobilier ou plusieurs équipes, l’offre Entreprise est sur devis. Le tarif adapté à votre volume vous est présenté pendant la démo, qui est offerte.`,
  },
  {
    q: 'Puis-je voir Diagly avant d’acheter ?',
    r: 'Oui. Réservez une démo : nous vous montrons l’outil, du plan au rapport, et répondons à vos questions. Elle est offerte.',
  },
]

/**
 * L'adresse de Diagly sur l'App Store. Vide tant que l'app n'y est pas
 * publiée : le badge s'affiche alors sans mener nulle part, plutôt que vers
 * une page qui n'existe pas.
 */
export const LIEN_APP_STORE = ''

/**
 * La vidéo de présentation, dans l'écran de l'ordinateur du héros. Vide, l'écran
 * montre sa place (« La vidéo arrive bientôt »), sans lecteur.
 *
 * En attente pour la mise en ligne : l'écran montre sa place. Le film
 * « parcours » du 3 novembre 2026 (projet diagly-film, 48 s, réduit pour le
 * web en public/accueil/diagly-presentation.mp4) n'est pas publié.
 */
export const VIDEO_PRESENTATION = ''

/** Vrai quand la vidéo a une bande son : le bouton du son n'apparaît qu'alors. Le film du 3 novembre est muet. */
export const VIDEO_A_DU_SON = false
