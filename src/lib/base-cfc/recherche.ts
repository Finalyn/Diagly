/**
 * Chercher et filtrer dans la base.
 *
 * La recherche porte sur le code, le nom et les textes de travaux, parce qu'on
 * cherche souvent un ouvrage par ce qu'il faut y faire plutôt que par son nom.
 * Elle ignore les accents et la casse : on tape « crepi » d'une main, l'autre
 * tenant une tablette, et « Crépis » doit sortir.
 *
 * Les filtres se cumulent, et un filtre vide ne filtre rien : c'est ce qui
 * permet de les combiner sans écrire une condition par cas.
 */

import type { ApiArticle } from '../api-types'
import { cle } from './normaliser'
import type { Controle, RaisonControle } from './controles'

export interface FiltresDeLaBase {
  recherche?: string
  /** Code CFC, à n'importe quel niveau : « 22 » retient 221, 226.1, etc. */
  groupeCfc?: string | null
  etapeNumero?: number | null
  domaineRapport?: string | null
  groupeAlternatives?: string | null
  /** true = seulement ceux qui demandent un échafaudage. */
  echafaudage?: boolean | null
  /** false par défaut : les articles retirés du catalogue restent cachés. */
  inactifs?: boolean
  /** Ne garder que les articles qui portent ce défaut. */
  controle?: RaisonControle | null
}

/** Le texte où la recherche va voir. */
function texteDeLArticle(a: ApiArticle): string {
  return cle([
    a.cfcCode, a.id, a.nom, a.domaineRapport, a.groupeAlternatives ?? '',
    ...a.etats.map((e) => e.travaux ?? ''),
  ].join(' '))
}

/**
 * Les articles qui répondent aux filtres, dans l'ordre du code CFC.
 *
 * `controles` sert au filtre par défaut ; sans lui, ce filtre ne retient rien
 * plutôt que de prétendre que la base est saine.
 */
export function chercherDansLaBase(
  articles: ApiArticle[],
  filtres: FiltresDeLaBase,
  controles: Controle[] = [],
): ApiArticle[] {
  const q = cle((filtres.recherche ?? '').trim())
  const avecDefaut = filtres.controle
    ? new Set(controles.filter((c) => c.raison === filtres.controle).map((c) => c.articleId))
    : null

  return articles
    .filter((a) => (filtres.inactifs ? true : a.actif))
    .filter((a) => (q ? texteDeLArticle(a).includes(q) : true))
    .filter((a) => (filtres.groupeCfc ? a.cfcCode.startsWith(filtres.groupeCfc) : true))
    .filter((a) => (filtres.etapeNumero == null ? true : a.etapes.some((e) => e.etapeNumero === filtres.etapeNumero)))
    .filter((a) => (filtres.domaineRapport ? a.domaineRapport === filtres.domaineRapport : true))
    .filter((a) => (filtres.groupeAlternatives ? a.groupeAlternatives === filtres.groupeAlternatives : true))
    .filter((a) => (filtres.echafaudage == null ? true : a.echafaudage === filtres.echafaudage))
    .filter((a) => (avecDefaut ? avecDefaut.has(a.id) : true))
    .sort((a, b) => a.cfcCode.localeCompare(b.cfcCode, undefined, { numeric: true }) || a.id.localeCompare(b.id))
}

/** Les valeurs qui existent vraiment, pour ne proposer que des filtres utiles. */
export interface ValeursDeFiltre {
  domaines: string[]
  groupes: string[]
}

export function valeursDeFiltre(articles: ApiArticle[]): ValeursDeFiltre {
  const domaines = new Set<string>()
  const groupes = new Set<string>()
  for (const a of articles) {
    if (a.domaineRapport) domaines.add(a.domaineRapport)
    if (a.groupeAlternatives) groupes.add(a.groupeAlternatives)
  }
  return {
    domaines: [...domaines].sort((a, b) => a.localeCompare(b, 'fr')),
    groupes: [...groupes].sort((a, b) => a.localeCompare(b, 'fr')),
  }
}

/** Vrai quand un filtre est posé : de quoi proposer « tout afficher ». */
export function filtresPosés(f: FiltresDeLaBase): boolean {
  return Boolean(
    (f.recherche ?? '').trim() || f.groupeCfc || f.etapeNumero != null || f.domaineRapport
    || f.groupeAlternatives || f.echafaudage != null || f.inactifs || f.controle,
  )
}
