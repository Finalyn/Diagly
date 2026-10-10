/**
 * Lecture du classeur de la base CFC : du texte d'Excel vers des valeurs sûres.
 *
 * Tout ce qui vient d'un tableur est du texte, parfois un nombre, parfois rien,
 * et une unité mal lue fausse un devis sans que rien ne le signale. Ce module
 * ne devine jamais : il traduit ce qu'il connaît et refuse le reste, pour que
 * l'import s'arrête sur une ligne précise plutôt que d'écrire une valeur fausse.
 *
 * Il est écrit sans dépendance et sans accès à la base : le script d'import
 * l'appelle depuis le serveur, et les tests le vérifient sans Excel ni MySQL.
 */

export type Unite = 'm2' | 'ml' | 'pce' | 'forfait'

export type EtatArticle = 'tres_bon' | 'bon' | 'moyen' | 'mauvais' | 'amelioration' | 'normes'

export type BaseQuantite =
  | 'surface_plancher' | 'surface_batie' | 'surface_terrain' | 'surface_facade'
  | 'surface_fenetres' | 'facade_moins_fenetres' | 'nombre_logements'
  | 'nombre_pieces_eau' | 'nombre_etages' | 'nombre_cages' | 'nombre_portes_entree'
  | 'forfait' | 'saisie_manuelle'
  | 'regle_stores' | 'regle_eaux_pluviales' | 'regle_sprinklers'

/** Une valeur du classeur que le module refuse de traduire. */
export class ErreurBase extends Error {
  readonly champ: string
  readonly valeur: unknown

  constructor(champ: string, valeur: unknown, raison: string) {
    super(`${champ} : ${raison} (valeur lue : ${JSON.stringify(valeur)})`)
    this.name = 'ErreurBase'
    this.champ = champ
    this.valeur = valeur
  }
}

/**
 * Sans accents, sans ponctuation, espaces réduits : pour comparer des libellés.
 *
 * NFKD et non NFD, parce que « m² » doit donner « m2 » : la forme NFD laisse
 * l'exposant intact, et la ponctuation le mangeait avec le reste.
 */
export function cle(brut: unknown): string {
  return String(brut ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const UNITES: Record<string, Unite> = {
  'm2': 'm2', 'm²': 'm2', 'metre carre': 'm2', 'metres carres': 'm2',
  'ml': 'ml', 'metre lineaire': 'ml',
  'pce': 'pce', 'piece': 'pce', 'pieces': 'pce', 'u': 'pce',
  'forfait': 'forfait', 'ft': 'forfait',
}

/**
 * Une unité, et l'éventuelle précision entre parenthèses.
 *
 * « pce (par logement) » n'est pas une cinquième unité : c'est « pce » plus une
 * indication de comptage. Garder la liste fermée à quatre est ce qui permet de
 * comparer deux devis.
 */
export function normaliserUnite(brut: unknown, champ = 'Unité'): { unite: Unite; indication: string | null } {
  const texte = String(brut ?? '').trim()
  if (texte === '') throw new ErreurBase(champ, brut, 'unité vide')
  const parentheses = /^(.+?)\s*\((.+)\)\s*$/.exec(texte)
  const base = parentheses ? parentheses[1] : texte
  const unite = UNITES[cle(base)]
  if (!unite) throw new ErreurBase(champ, brut, `unité inconnue, attendu m², ml, pce ou forfait`)
  return { unite, indication: parentheses ? parentheses[2].trim() : null }
}

/** Les bases nommées telles quelles dans le classeur. */
const BASES: Record<string, BaseQuantite> = {
  'surface de plancher sp': 'surface_plancher',
  'surface de plancher': 'surface_plancher',
  'sp': 'surface_plancher',
  'surface batie': 'surface_batie',
  'surface de terrain': 'surface_terrain',
  'surface de facade': 'surface_facade',
  'surface de fenetres': 'surface_fenetres',
  'surface de facade surface de fenetres': 'facade_moins_fenetres',
  'nombre de logements': 'nombre_logements',
  'nombre de pieces d eau': 'nombre_pieces_eau',
  'nombre d etages': 'nombre_etages',
  'nombre de cages d escalier': 'nombre_cages',
  'nombre de portes d entree': 'nombre_portes_entree',
  'forfait': 'forfait',
  'saisie manuelle': 'saisie_manuelle',
}

/**
 * La base de quantité, et l'indication à montrer au diagnostiqueur.
 *
 * Trois règles sont écrites en toutes lettres dans le classeur parce qu'elles
 * ne se ramènent pas à un coefficient : les stores comptés par taille de
 * logement, les eaux pluviales par palier de surface, les sprinklers qui
 * prennent le parking s'il est connu. Elles sont reconnues à leurs mots-clés
 * et non à leur texte exact, qui est appelé à être reformulé.
 */
export function normaliserBase(brut: unknown, champ = 'Base de quantité'): { base: BaseQuantite; indication: string | null } {
  const texte = String(brut ?? '').trim()
  if (texte === '') throw new ErreurBase(champ, brut, 'base de quantité vide')
  const k = cle(texte)

  if (k.startsWith('regle ep') || (k.includes('hauteur') && k.includes('surface batie'))) {
    return { base: 'regle_eaux_pluviales', indication: texte }
  }
  if (k.startsWith('logements') && k.includes('pce par logement')) {
    return { base: 'regle_stores', indication: texte }
  }
  if (k.startsWith('surface batie') && k.includes('parking')) {
    return { base: 'regle_sprinklers', indication: texte }
  }

  const parentheses = /^(.+?)\s*\((.+)\)\s*$/.exec(texte)
  const sansParenthese = parentheses ? parentheses[1] : texte
  const base = BASES[cle(sansParenthese)]
  if (!base) throw new ErreurBase(champ, brut, 'base de quantité inconnue')
  return { base, indication: parentheses ? parentheses[2].trim() : null }
}

/** Un prix : un nombre, ou rien. Une cellule vide vaut « pas de travail chiffré ». */
export function normaliserPrix(brut: unknown, champ = 'Prix'): number | null {
  if (brut === null || brut === undefined || brut === '') return null
  if (typeof brut === 'number') {
    if (!Number.isFinite(brut) || brut < 0) throw new ErreurBase(champ, brut, 'prix négatif ou non fini')
    return brut
  }
  const texte = String(brut).replace(/['’\s]/g, '').replace(',', '.')
  if (texte === '') return null
  const n = Number(texte)
  if (!Number.isFinite(n) || n < 0) throw new ErreurBase(champ, brut, 'prix illisible')
  return n
}

/** Une part, lue en fraction (0,3) ou en pourcent (30 %). */
export function normaliserPart(brut: unknown, champ = 'Part'): number | null {
  if (brut === null || brut === undefined || brut === '') return null
  const n = typeof brut === 'number' ? brut : Number(String(brut).replace('%', '').replace(',', '.').trim())
  if (!Number.isFinite(n)) throw new ErreurBase(champ, brut, 'part illisible')
  const fraction = n > 1 ? n / 100 : n
  if (fraction < 0 || fraction > 1) throw new ErreurBase(champ, brut, 'part hors de 0 à 100 %')
  return fraction
}

/** Un texte, ou rien. Les cellules vides d'Excel arrivent sous trois formes. */
export function normaliserTexte(brut: unknown): string | null {
  const texte = String(brut ?? '').trim()
  return texte === '' ? null : texte
}

/** « Néant » : l'état est décrit, et il n'appelle aucun travail. */
export function aucunTravail(texte: string | null): boolean {
  return texte !== null && cle(texte) === 'neant'
}

/** Oui / Non du classeur. Tout le reste est refusé : « peut-être » n'existe pas. */
export function normaliserOuiNon(brut: unknown, champ = 'Oui/Non'): boolean {
  const k = cle(brut)
  if (k === 'oui' || k === 'o' || k === 'true' || k === '1') return true
  if (k === 'non' || k === 'n' || k === 'false' || k === '0') return false
  throw new ErreurBase(champ, brut, 'attendu Oui ou Non')
}

/** Un code CFC est du texte : « 221.0 » et « 221 » sont deux codes différents. */
export function normaliserCode(brut: unknown, champ = 'Code CFC'): string {
  if (typeof brut === 'number') {
    throw new ErreurBase(champ, brut, 'code lu comme un nombre, le zéro final serait perdu')
  }
  const texte = String(brut ?? '').trim()
  if (!/^\d+(\.\d+)?$/.test(texte)) throw new ErreurBase(champ, brut, 'code CFC mal formé')
  return texte
}
