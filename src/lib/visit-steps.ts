// Parcours de visite : l'ordre dans lequel on relève un immeuble sur le terrain,
// et non l'ordre de la nomenclature CFC.
//
// On commence dehors par la façade, on entre, on monte, on redescend au sous-sol,
// on finit par la toiture et les annexes. C'est l'ordre demandé par le bureau et
// il est appliqué au catalogue par server/scripts/reorder-catalogue.mjs, qui
// écrit displayOrder = numéro d'étape × 1000 + rang. Les deux listes doivent
// rester identiques : si l'une change, l'autre aussi.

import type { ApiCatalogItem } from './api-types'
import { groupItemsByCategory, type CategoryGroup } from './cfc'

export const VISIT_STEPS = [
  'Façade',
  'Porte extérieure',
  'Boîte aux lettres',
  "Communs / cage d'escalier",
  'Installations techniques',
  'Buanderie / Cave',
  'Toitures',
  'Structure',
  'Appartements',
  'Fenêtres',
  'Annexe',
] as const

/** Numéro d'étape (1..11) d'un item, ou null s'il n'a pas encore été rangé. */
export function visitStepOf(item: { displayOrder: number }): number | null {
  const n = Math.floor((item.displayOrder ?? 0) / 1000)
  return n >= 1 && n <= VISIT_STEPS.length ? n : null
}

export interface VisitStepGroup {
  /** 1..11, ou null pour les items non rangés. */
  step: number | null
  /** « 1. Façade », ou « Autres ». */
  label: string
  categories: CategoryGroup[]
  count: number
}

/**
 * Groupe les items par étape de visite, puis par catégorie à l'intérieur.
 * Les étapes vides ne sont pas rendues : une étape sans item au catalogue
 * (la boîte aux lettres aujourd'hui) ne doit pas occuper l'écran en visite.
 */
export function groupItemsByVisitStep(items: ApiCatalogItem[]): VisitStepGroup[] {
  const paquets = new Map<number | null, ApiCatalogItem[]>()
  for (const it of items) {
    const s = visitStepOf(it)
    if (!paquets.has(s)) paquets.set(s, [])
    paquets.get(s)!.push(it)
  }

  const groupes: VisitStepGroup[] = []
  VISIT_STEPS.forEach((nom, i) => {
    const liste = paquets.get(i + 1)
    if (!liste?.length) return
    groupes.push({
      step: i + 1,
      label: `${i + 1}. ${nom}`,
      categories: groupItemsByCategory(liste),
      count: liste.length,
    })
  })
  const restes = paquets.get(null)
  if (restes?.length) {
    groupes.push({ step: null, label: 'Autres', categories: groupItemsByCategory(restes), count: restes.length })
  }
  return groupes
}
