/**
 * Communs ou logements : où l'ouvrage a été relevé.
 *
 * La note générale du classeur (Feuil2, ligne 90) pose une règle que le modèle
 * ne savait pas tenir :
 *
 *   « Tous ces articles sont les mêmes pour les communs et l'intérieur des
 *     appartements par ailleurs il faut qu'ils soient séparés pour pouvoir
 *     sélectionner des articles différents entre les communs et les appartement. »
 *
 * Autrement dit, le chapitre « INTÉRIEUR : » du classeur n'est pas une liste
 * d'ouvrages mais une grille qu'on remplit deux fois : une fois dans la cage
 * d'escalier, une fois dans les logements. La peinture des murs de la cage peut
 * être en fin de vie quand celle des appartements est neuve, et l'inverse arrive
 * tout autant. Un seul relevé par article obligeait à choisir, donc à perdre la
 * moitié du constat.
 *
 * La localisation n'est pas une propriété de l'article — le catalogue reste
 * intact, aucun CFC ne bouge — mais du relevé : c'est l'étape de la visite qui
 * la donne, la cage d'escalier pour les communs, les surfaces principales pour
 * les logements. Les autres étapes (façade, toiture, locaux techniques, abords)
 * ne sont ni l'un ni l'autre et n'en portent pas.
 */

export type Localisation = 'COMMUNS' | 'LOGEMENTS'

/**
 * Catégories du chapitre « INTÉRIEUR : » du classeur, dans son ordre.
 *
 * Ce sont les articles que la note déclare communs aux deux localisations : ils
 * apparaissent donc dans la cage d'escalier *et* dans les logements, et s'y
 * relèvent séparément. L'ordre sert à les présenter pareil des deux côtés, quel
 * que soit le rang que le catalogue leur donne.
 */
export const CATEGORIES_INTERIEUR = [
  'Revêtement de murs',
  'Revêtement de plafonds',
  'Revêtement de sols',
  '272.2 Ouvrages métalliques courants',
  '273 Menuiserie',
] as const

/** L'article se relève-t-il des deux côtés (communs et logements) ? */
export function estArticleInterieur(category: string | null | undefined): boolean {
  return !!category && (CATEGORIES_INTERIEUR as readonly string[]).includes(category)
}

/** Rang de présentation d'une catégorie intérieure ; +∞ pour les autres. */
export function rangCategorieInterieure(category: string | null | undefined): number {
  const i = (CATEGORIES_INTERIEUR as readonly string[]).indexOf(category ?? '')
  return i === -1 ? Number.POSITIVE_INFINITY : i
}

export const LIBELLE_LOCALISATION: Record<Localisation, string> = {
  COMMUNS: 'Communs',
  LOGEMENTS: 'Logements',
}

/**
 * Clé d'unicité d'un relevé.
 *
 * L'éditeur reconnaissait un ouvrage déjà relevé à son seul article de
 * catalogue ; il n'en acceptait donc qu'un. C'est cette clé, et elle seule, qui
 * permet le double relevé demandé par la note.
 */
export function cleReleve(catalogItemId: number, localisation?: Localisation | null): string {
  return `${catalogItemId}:${localisation ?? ''}`
}

/** Suffixe à accoler à un libellé pour le situer, vide si l'ouvrage n'est ni l'un ni l'autre. */
export function suffixeLocalisation(localisation?: Localisation | null): string {
  return localisation ? ` — ${LIBELLE_LOCALISATION[localisation].toLowerCase()}` : ''
}
