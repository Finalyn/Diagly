// Calculs automatiques d'un élément de diagnostic : le diagnostiqueur ne saisit
// que l'état (+ photo) ; travaux, priorité, quantité et coût sont dérivés.

import type { ApiCatalogItem, ElementState, Priority } from './api-types'

/** Priorité déduite de l'état (Mauvais = urgent). Modifiable à la main. */
export const STATE_PRIORITY: Record<ElementState, Priority> = {
  MAUVAIS: 'I',
  MOYEN: 'II',
  BON: 'III',
  TRES_BON: 'III',
}

/** Convertit un prix catalogue ("45", "1'234.50", "12,5") en nombre. null si c'est une formule/texte. */
export function priceToNumber(s: string | null | undefined): number | undefined {
  if (!s) return undefined
  const c = String(s).replace(/['’\s]/g, '').replace(',', '.')
  return /^[0-9]+(\.[0-9]+)?$/.test(c) ? parseFloat(c) : undefined
}

/** Travaux suggérés pour un état donné. */
export function workForState(item: ApiCatalogItem, state: ElementState): string | null {
  switch (state) {
    case 'TRES_BON': return item.workTbe
    case 'BON':      return item.workBon
    case 'MOYEN':    return item.workMoyen
    case 'MAUVAIS':  return item.workMauvais
  }
}

/** Prix unitaire (string catalogue) pour un état. */
export function priceForState(item: ApiCatalogItem, state: ElementState): string | null {
  switch (state) {
    case 'TRES_BON': return item.priceTbe
    case 'BON':      return item.priceBon
    case 'MOYEN':    return item.priceMoyen
    case 'MAUVAIS':  return item.priceMauvais
  }
}

export interface QuantityContext {
  builtArea: number
  floorArea: number
  terrainArea: number
  perimeter: number
  nbApartments: number
  nbFloors: number
  facade: number
  windows: number
  /** Surface de toiture selon le type (0 si non précisé → quantité manuelle). */
  roof: number
  scaffolding: number
  commons: number
}

/** Quantité depuis la formule texte (ex. « Surface de bâtie x 1,35 »). */
function quantityFromFormula(formula: string | null | undefined, ctx: QuantityContext): number | undefined {
  if (!formula) return undefined
  const f = formula.toLowerCase()
  const mul = f.match(/[x×*]\s*([0-9]+(?:[.,][0-9]+)?)/)
  const mult = mul ? parseFloat(mul[1].replace(',', '.')) : 1

  let base: number | undefined
  if (/appartement|logement/.test(f)) base = ctx.nbApartments
  else if (/toiture|toit/.test(f)) base = ctx.roof
  else if (/fa[cç]ade/.test(f)) base = ctx.facade
  else if (/fen[eê]tre|vitrine/.test(f)) base = ctx.windows
  else if (/[eé]chafaud/.test(f)) base = ctx.scaffolding
  else if (/commun/.test(f)) base = ctx.commons
  else if (/plancher/.test(f)) base = ctx.floorArea
  else if (/terrain/.test(f)) base = ctx.terrainArea
  else if (/p[eé]rim[eè]tre/.test(f)) base = ctx.perimeter
  else if (/b[aâ]ti|au sol|emprise/.test(f)) base = ctx.builtArea
  else if (/[eé]tage/.test(f)) base = ctx.nbFloors

  if (base == null || base <= 0) return undefined
  const q = base * mult
  return q > 0 ? Math.round(q) : undefined
}

/** Quantité déduite de l'unité (ex. « CHF/m² SP », « CHF/m² fenêtres », « Forfait »). */
function quantityFromUnit(unit: string | null | undefined, ctx: QuantityContext): number | undefined {
  if (!unit) return undefined
  const u = unit.toLowerCase()
  if (/forfait/.test(u)) return 1 // prix forfaitaire : le prix EST le total
  let base: number | undefined
  if (/toiture|toit/.test(u)) base = ctx.roof
  else if (/fa[cç]ade/.test(u)) base = ctx.facade
  else if (/fen[eê]tre|vitrine/.test(u)) base = ctx.windows
  else if (/[eé]chafaud/.test(u)) base = ctx.scaffolding
  else if (/\bsp\b|plancher/.test(u)) base = ctx.floorArea
  // « CHF/ml », « CHF/U », « CHF/m² » générique : non déterminable → saisie manuelle
  if (base == null || base <= 0) return undefined
  return Math.round(base)
}

/**
 * Estime la quantité : d'abord via la formule du catalogue, sinon via l'unité
 * (surface de plancher, façade, toiture, fenêtres, forfait…). undefined si rien
 * n'est exploitable (mètre linéaire, pièces, m² générique) → saisie manuelle.
 */
export function computeQuantity(
  item: { quantityFormula?: string | null; unit?: string | null },
  ctx: QuantityContext,
): number | undefined {
  return quantityFromFormula(item.quantityFormula, ctx) ?? quantityFromUnit(item.unit, ctx)
}

/**
 * Coefficient marché appliqué à tous les coûts. Les prix du catalogue sont une
 * base de référence ; ce coefficient les indexe sur le marché suisse actuel
 * (indice des prix de la construction OFS). 1 = base de référence. Il est
 * chargé au démarrage depuis /api/market/index (voir setMarketCoeff), donc
 * ajustable côté serveur sans redéployer le front.
 */
let marketCoeff = 1
export function setMarketCoeff(v: number | null | undefined) {
  if (typeof v === 'number' && isFinite(v) && v > 0) marketCoeff = v
}
export function getMarketCoeff(): number { return marketCoeff }

/** Coût estimé = prix unitaire de l'état × quantité × coefficient marché (si le prix est numérique). */
export function computeCost(
  catalog: ApiCatalogItem | null | undefined,
  state: ElementState,
  quantity: number | null | undefined,
): number | undefined {
  if (!catalog || !quantity) return undefined
  const unit = priceToNumber(priceForState(catalog, state))
  if (unit == null) return undefined
  return Math.round(unit * quantity * marketCoeff)
}

/** Coût générique = prix unitaire catalogue (string) × quantité × coefficient marché. Sert à l'amélioration / remise aux normes. */
export function computeCostFromPrice(
  price: string | null | undefined,
  quantity: number | null | undefined,
): number | undefined {
  if (!quantity) return undefined
  const unit = priceToNumber(price)
  if (unit == null) return undefined
  return Math.round(unit * quantity * marketCoeff)
}
