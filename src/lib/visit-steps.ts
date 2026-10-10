// Parcours de visite : l'ordre dans lequel on relève un immeuble sur le terrain,
// et non l'ordre de la nomenclature CFC.
//
// Deux de ces étapes — la cage d'escalier et les surfaces principales — sont des
// « intérieurs » au sens du classeur et partagent la même grille d'articles ; voir
// localisation.ts.
//
// On commence dehors par la façade, on entre, on monte, on redescend au sous-sol,
// on finit par la toiture et les annexes. C'est l'ordre demandé par le bureau et
// il est appliqué au catalogue par server/scripts/reorder-catalogue.mjs, qui
// écrit displayOrder = numéro d'étape × 1000 + rang. Les deux listes doivent
// rester identiques : si l'une change, l'autre aussi.

import type { ApiCatalogItem, BuildingType } from './api-types'
import { groupItemsByCategory, type CategoryGroup } from './cfc'
import { estArticleInterieur, rangCategorieInterieure, type Localisation } from './localisation'
// Les intitules des surfaces principales vivent desormais avec la base v3, qui
// tient les etapes de visite. Deux tables qui disent la meme chose finissent par
// se contredire.
import { SURFACES_PRINCIPALES } from './base-cfc/catalogue'

export const VISIT_STEPS = [
  'Façade',
  "Cage d'escalier",
  'Locaux techniques',
  'Toiture',
  'Appartements',
  'Abords et extérieurs',
] as const


/** Rang, dans VISIT_STEPS, de l'étape dont l'intitulé suit l'affectation. */
const RANG_SURFACES = VISIT_STEPS.indexOf('Appartements') + 1

/** Rang de la cage d'escalier : ce que le classeur appelle « les communs ». */
const RANG_COMMUNS = VISIT_STEPS.indexOf("Cage d'escalier") + 1

/**
 * Localisation d'une étape, au sens de la note générale du classeur.
 *
 * Seules deux étapes sont un « intérieur » : la cage d'escalier est les communs,
 * les surfaces principales sont les logements. La façade, la toiture, les locaux
 * techniques et les abords ne sont ni l'un ni l'autre — un ouvrage relevé là ne
 * se relève qu'une fois et ne porte pas de localisation.
 */
export function localisationDeLetape(step: number | null): Localisation | null {
  if (step === RANG_COMMUNS) return 'COMMUNS'
  if (step === RANG_SURFACES) return 'LOGEMENTS'
  return null
}

/**
 * Intitulé d'une étape pour un bâtiment donné.
 * Seule l'étape des surfaces principales change ; les autres se disent pareil
 * partout — une façade est une façade, une cage d'escalier aussi.
 */
export function visitStepLabel(step: number | null, buildingType?: BuildingType | null): string {
  if (step == null) return 'Autres'
  if (step === RANG_SURFACES && buildingType) return SURFACES_PRINCIPALES[buildingType] ?? 'Appartements'
  return VISIT_STEPS[step - 1] ?? 'Autres'
}

/** Numéro d'étape (1..6) d'un item, ou null s'il n'a pas encore été rangé. */
export function visitStepOf(item: { displayOrder: number }): number | null {
  const n = Math.floor((item.displayOrder ?? 0) / 1000)
  return n >= 1 && n <= VISIT_STEPS.length ? n : null
}

export interface VisitStepGroup {
  /** 1..6, ou null pour les items non rangés. */
  step: number | null
  /** « 1. Façade », ou « Autres ». */
  label: string
  categories: CategoryGroup[]
  count: number
  /** Communs, logements, ou null : sous quelle localisation on relève ici. */
  localisation: Localisation | null
}

/**
 * Groupe les items par étape de visite, puis par catégorie à l'intérieur.
 *
 * Les étapes vides ne sont pas rendues : une étape sans item au catalogue ne doit
 * pas occuper l'écran en visite.
 *
 * Un article du chapitre « INTÉRIEUR : » du classeur sort ici **deux fois**, une
 * par étape intérieure. Le catalogue, lui, ne bouge pas : un article y garde son
 * rang unique et son CFC. C'est le relevé qui se dédouble, comme le veut la note
 * générale — la même grille remplie dans la cage d'escalier et dans les logements.
 */
export function groupItemsByVisitStep(
  items: ApiCatalogItem[],
  buildingType?: BuildingType | null,
): VisitStepGroup[] {
  const paquets = new Map<number | null, ApiCatalogItem[]>()
  const ajouter = (s: number | null, it: ApiCatalogItem) => {
    if (!paquets.has(s)) paquets.set(s, [])
    paquets.get(s)!.push(it)
  }

  for (const it of items) {
    const s = visitStepOf(it)
    // Les articles du chapitre « INTÉRIEUR : » se relèvent des deux côtés. Leur
    // rang au catalogue les range d'un seul ; on les sert donc aux deux étapes
    // intérieures, sans rien changer au catalogue lui-même.
    if (estArticleInterieur(it.category)) {
      ajouter(RANG_COMMUNS, it)
      ajouter(RANG_SURFACES, it)
      continue
    }
    ajouter(s, it)
  }

  const groupes: VisitStepGroup[] = []
  VISIT_STEPS.forEach((_, i) => {
    const liste = paquets.get(i + 1)
    if (!liste?.length) return
    groupes.push({
      step: i + 1,
      label: `${i + 1}. ${visitStepLabel(i + 1, buildingType)}`,
      categories: ordonnerCategories(groupItemsByCategory(liste)),
      count: liste.length,
      localisation: localisationDeLetape(i + 1),
    })
  })
  const restes = paquets.get(null)
  if (restes?.length) {
    groupes.push({
      step: null,
      label: 'Autres',
      categories: groupItemsByCategory(restes),
      count: restes.length,
      localisation: null,
    })
  }
  return groupes
}

/**
 * Remet les catégories intérieures dans l'ordre du classeur, en tête de l'étape.
 *
 * Sans cela, la cage d'escalier montrerait ses revêtements après sa menuiserie,
 * au seul motif que le catalogue les avait rangés dans les logements : deux
 * étapes qui présentent la même grille doivent la présenter pareil.
 */
function ordonnerCategories(categories: CategoryGroup[]): CategoryGroup[] {
  const interieures = categories
    .filter((g) => estArticleInterieur(g.category))
    .sort((a, b) => rangCategorieInterieure(a.category) - rangCategorieInterieure(b.category))
  if (!interieures.length) return categories
  return [...interieures, ...categories.filter((g) => !estArticleInterieur(g.category))]
}
