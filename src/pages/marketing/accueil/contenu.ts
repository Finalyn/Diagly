/**
 * Le contenu de la page d'accueil qui n'est pas de la mise en page : la
 * navigation, les plans tarifaires et les questions fréquentes.
 *
 * Les plans et leurs prix sont repris tels quels de la version précédente de
 * la page : ce sont des engagements commerciaux, pas du texte de vitrine. On
 * ne les change pas ici sans que l'offre ait changé.
 */

export const NAV = [
  { href: '#fonctionnalites', label: 'Fonctionnalités' },
  { href: '#metres', label: 'Métrés IA' },
  { href: '#app', label: 'App' },
  { href: '#tarifs', label: 'Tarifs' },
  { href: '#faq', label: 'FAQ' },
]

export interface Plan {
  nom: string
  mensuel: number | null
  annuel: number | null
  gratuit?: boolean
  surDevis?: boolean
  accroche: string
  points: string[]
  cta: string
  phare?: boolean
}

export const PLANS: Plan[] = [
  {
    nom: 'Découverte', mensuel: 0, annuel: 0, gratuit: true,
    accroche: 'Pour voir ce que donne un rapport sur votre propre immeuble.',
    points: ['1 diagnostic offert', 'Rapport PDF avec filigrane', '1 utilisateur'],
    cta: 'Commencer',
  },
  {
    nom: 'Starter', mensuel: 49, annuel: 490,
    accroche: 'Pour un indépendant, quelques immeubles par mois.',
    points: ['5 diagnostics par mois', 'Rapports PDF sans filigrane', 'Lien de partage au client'],
    cta: 'Choisir Starter',
  },
  {
    nom: 'Pro', mensuel: 149, annuel: 1490, phare: true,
    accroche: 'Pour un bureau qui en fait son outil de relevé.',
    points: ['20 diagnostics par mois', '3 utilisateurs', 'Export Excel et rapports à votre logo'],
    cta: 'Choisir Pro',
  },
  {
    nom: 'Entreprise', mensuel: null, annuel: null, surDevis: true,
    accroche: 'Pour une régie ou un groupe qui gère un parc.',
    points: ['Diagnostics illimités', 'Utilisateurs illimités', 'API et connecteurs'],
    cta: 'Nous écrire',
  },
]

export const CONTACT = 'mailto:contact@finalyn.com'

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
    q: 'Faut-il l’app pour relever sur le terrain ?',
    r: 'Non. Diagly fonctionne dans le navigateur de l’iPad, de l’iPhone et de l’ordinateur. L’app iPhone et iPad, en test, arrivera bientôt sur l’App Store : elle ajoute la barre de navigation native d’iOS et son scanner de documents.',
  },
  {
    q: 'Et sans réseau, au sous-sol ?',
    r: 'Les relevés se font hors ligne : ils restent sur l’appareil et partent dès que le réseau revient. Préparez le dossier pour le terrain avant la visite pour l’avoir sous la main.',
  },
  {
    q: 'Où sont hébergées mes données ?',
    r: 'En Suisse, chez Infomaniak. Quand vous lancez une analyse par l’IA (photo, plan, document ou question à l’assistant), les éléments concernés sont transmis à notre fournisseur d’IA, Anthropic, hors de Suisse. Le Guide IA des photos peut être réglé sur « Sans guide ».',
  },
  {
    q: 'Puis-je exporter mes données ?',
    r: 'Oui. Les données d’un diagnostic sortent en Excel, CSV ou JSON, les métrés en Excel, les rapports en PDF. Une API en lecture et des webhooks relient Diagly à vos propres outils.',
  },
  {
    q: 'Puis-je arrêter quand je veux ?',
    r: 'Oui. Les plans sont sans engagement et résiliables sans préavis.',
  },
]
