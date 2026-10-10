/**
 * L'arborescence CFC, telle qu'on navigue dedans.
 *
 * La nomenclature suisse descend sur quatre niveaux : 2 Bâtiment, 22 Gros
 * œuvre 2, 221 Fenêtres et portes extérieures, 221.0 Fenêtres en bois. Les
 * articles s'accrochent au troisième ou au quatrième, selon leur précision.
 *
 * L'arbre s'arrête au troisième niveau et les articles du quatrième remontent
 * à leur parent : descendre d'un cran de plus mettrait souvent un seul article
 * sous un code, et l'on passerait son temps à déplier des branches d'un seul
 * fruit. Le code exact de l'article reste écrit dans le tableau, où il se lit.
 *
 * Par défaut, une branche sans aucun article ne paraît pas : six cent
 * quarante-sept lignes de nomenclature dont cent onze portent un article, ce
 * serait chercher dans du vide. Qui veut la nomenclature entière le demande.
 */

import type { ApiArticle, ApiNoeudCfc } from '../api-types'
import { cle } from './normaliser'

/** Profondeur de l'arbre : au-delà, les articles remontent à leur parent. */
export const PROFONDEUR = 3

export interface NoeudArbre {
  code: string
  libelle: string
  niveau: number
  enfants: NoeudArbre[]
  /** Articles accrochés à ce noeud, le quatrième niveau compris. */
  articles: ApiArticle[]
  /** Articles de ce noeud et de toute sa descendance. */
  total: number
}

/** Le noeud de l'arbre où un article se range : lui-même, ou son parent. */
export function noeudDeLArticle(cfcCode: string, parCode: Map<string, ApiNoeudCfc>): string {
  let noeud = parCode.get(cfcCode)
  // Un code inconnu de la nomenclature se range sous lui-même : il faut qu'il
  // se voie, c'est précisément une anomalie à corriger.
  if (!noeud) return cfcCode
  while (noeud.niveau > PROFONDEUR && noeud.parentCode) {
    const parent = parCode.get(noeud.parentCode)
    if (!parent) break
    noeud = parent
  }
  return noeud.code
}

/**
 * L'arbre des trois premiers niveaux, avec ses articles et ses comptes.
 *
 * `tout` garde les branches vides, pour qui veut voir la nomenclature entière.
 */
export function arborescenceCfc(
  noeuds: ApiNoeudCfc[],
  articles: ApiArticle[],
  tout = false,
): NoeudArbre[] {
  const parCode = new Map(noeuds.map((n) => [n.code, n]))
  const articlesParNoeud = new Map<string, ApiArticle[]>()
  for (const a of articles) {
    const code = noeudDeLArticle(a.cfcCode, parCode)
    if (!articlesParNoeud.has(code)) articlesParNoeud.set(code, [])
    articlesParNoeud.get(code)!.push(a)
  }

  const construire = (n: ApiNoeudCfc): NoeudArbre => {
    const enfants = noeuds
      .filter((x) => x.parentCode === n.code && x.niveau <= PROFONDEUR)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
      .map(construire)
    const propres = (articlesParNoeud.get(n.code) ?? [])
      .slice()
      .sort((a, b) => a.cfcCode.localeCompare(b.cfcCode, undefined, { numeric: true }) || a.id.localeCompare(b.id))
    return {
      code: n.code,
      libelle: n.libelle,
      niveau: n.niveau,
      enfants,
      articles: propres,
      total: propres.length + enfants.reduce((s, e) => s + e.total, 0),
    }
  }

  const racines = noeuds
    .filter((n) => n.parentCode === null)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map(construire)

  return tout ? racines : racines.map(elaguer).filter((n): n is NoeudArbre => n !== null)
}

/** Retire les branches qui ne portent aucun article. */
function elaguer(n: NoeudArbre): NoeudArbre | null {
  if (n.total === 0) return null
  return { ...n, enfants: n.enfants.map(elaguer).filter((e): e is NoeudArbre => e !== null) }
}

/**
 * Le chemin d'un code jusqu'à la racine, pour ouvrir l'arbre au bon endroit.
 *
 * Rendu de la racine vers la feuille : « 2 », « 22 », « 226 ».
 */
export function cheminDuCode(cfcCode: string, noeuds: ApiNoeudCfc[]): string[] {
  const parCode = new Map(noeuds.map((n) => [n.code, n]))
  const chemin: string[] = []
  let courant = parCode.get(noeudDeLArticle(cfcCode, parCode))
  const vus = new Set<string>()
  while (courant && !vus.has(courant.code)) {
    vus.add(courant.code)
    chemin.unshift(courant.code)
    courant = courant.parentCode ? parCode.get(courant.parentCode) : undefined
  }
  return chemin
}

/** Tous les articles d'un noeud et de sa descendance, dans l'ordre du code. */
export function articlesDuNoeud(noeud: NoeudArbre): ApiArticle[] {
  return [...noeud.articles, ...noeud.enfants.flatMap(articlesDuNoeud)]
}

/** L'arbre réduit aux noeuds dont le code ou le libellé répond à la recherche. */
export function filtrerLArbre(arbre: NoeudArbre[], recherche: string): NoeudArbre[] {
  const q = cle(recherche.trim())
  if (!q) return arbre
  const garder = (n: NoeudArbre): NoeudArbre | null => {
    const moi = cle(n.code).includes(q) || cle(n.libelle).includes(q)
    const enfants = n.enfants.map(garder).filter((e): e is NoeudArbre => e !== null)
    if (!moi && enfants.length === 0) return null
    // Un noeud retenu pour lui-même garde toute sa descendance : on cherchait
    // la branche, pas une feuille.
    return moi ? n : { ...n, enfants }
  }
  return arbre.map(garder).filter((n): n is NoeudArbre => n !== null)
}
