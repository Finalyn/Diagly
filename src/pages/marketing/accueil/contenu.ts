/**
 * Le contenu du site public qui n'est pas de la mise en page : la
 * navigation, les tarifs et les questions fréquentes.
 *
 * Les tarifs sont des engagements commerciaux, pas du texte de vitrine : ils
 * vivent ici, en un seul endroit, et les sections les lisent. Le modèle du
 * 19 octobre 2026 : le diagnostic à l'unité, un tarif dégressif dès un
 * certain nombre de diagnostics achetés, et l'abonnement mensuel. Pas de
 * diagnostic offert : c'est la démo qui l'est.
 */

/** Le menu du haut, le même sur toutes les pages du site (LienSite, ui.tsx). */
export const NAV = [
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/fonctionnalites#metres', label: 'Métrés IA' },
  { href: '/fonctionnalites#app', label: 'App' },
  { href: '/#tarifs', label: 'Tarifs' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
]

/** Le prix d'un diagnostic acheté à l'unité, en CHF. */
export const PRIX_DIAGNOSTIC = 300

/** L'abonnement, affiché en CHF par mois. */
export const PRIX_ABONNEMENT = 850

/** La durée d'engagement de l'abonnement, en mois : il se souscrit pour un an. */
export const ENGAGEMENT_MOIS = 12

/** Le nombre de diagnostics achetés à partir duquel le prix devient dégressif. */
export const SEUIL_DEGRESSIF = 10

/** Le nombre de diagnostics par mois à partir duquel l'abonnement coûte moins cher que l'unité. */
export const SEUIL_RENTABLE = Math.ceil(PRIX_ABONNEMENT / PRIX_DIAGNOSTIC)

/** Un montant en francs, à la suisse : 1’234 CHF. */
export function francs(n: number) {
  return `${Math.round(n).toLocaleString('fr-CH').replace(/[\u202f\u00a0 ]/g, '’')}\u00a0CHF`
}

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
    q: 'Combien coûte un diagnostic ?',
    r: `${francs(PRIX_DIAGNOSTIC)} à l’unité, et moins cher à partir de ${SEUIL_DEGRESSIF} diagnostics achetés. L’abonnement, à ${francs(PRIX_ABONNEMENT)} par mois avec un engagement d’un an, donne des diagnostics illimités : il revient moins cher que l’unité dès ${SEUIL_RENTABLE} diagnostics par mois, et comprend une heure de formation la première année.`,
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
