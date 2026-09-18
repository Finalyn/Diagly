/**
 * Constantes partagées par les rapports.
 *
 * Séparées des composants : un fichier qui exporte à la fois des composants et des
 * valeurs casse le rafraîchissement à chaud de Vite (règle react-refresh).
 */
import type { ElementState } from '@/lib/api-types'

// La TVA vit avec le calcul du devis : deux définitions divergeraient en silence.
export { TVA } from '@/lib/devis'

/** Montant d'un champ décimal servi en texte par l'API. */
export const toNum = (v: string | null | undefined) => (v ? Number(v) : 0)

export const ETATS: ElementState[] = ['TRES_BON', 'BON', 'MOYEN', 'MAUVAIS']

/** Chapitres du rapport, dans l'ordre de lecture, par groupe CFC. */
export const CHAPITRES: { titre: string; groupes: string[] }[] = [
  { titre: 'Enveloppe / thermique', groupes: ['21', '22'] },
  { titre: 'Techniques CVSE', groupes: ['23', '24', '25', '26'] },
  { titre: 'Aménagements intérieurs', groupes: ['27', '28'] },
  { titre: 'Abords et extérieurs', groupes: ['4', '41', '42', '46'] },
]

/**
 * Géométrie de la page A4 du rapport, en millimètres.
 *
 * `largeur` et `hauteur` sont la zone utile : A4 (210 × 297) moins les marges
 * d'impression déclarées dans `@page` (14 mm sur les côtés, 16 mm en haut et en
 * bas). Les bandeaux d'en-tête et de pied sont de hauteur fixe, parce que la
 * pagination compte dessus pour savoir ce qui reste au contenu.
 */
export const PAGE = {
  largeur: 182,
  hauteur: 265,
  entete: 14,
  pied: 7,
} as const

/** Hauteur disponible pour le contenu d'une page. */
export const HAUTEUR_CONTENU = PAGE.hauteur - PAGE.entete - PAGE.pied
