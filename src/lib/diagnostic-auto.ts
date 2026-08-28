// Calculs automatiques d'un élément de diagnostic : le diagnostiqueur ne saisit
// que l'état (+ photo) ; travaux, priorité, quantité et coût sont dérivés.

import type { ApiCatalogItem, ElementState, Priority } from './api-types'
import { computeProjectMetrics, type ProjectGeometry } from './formulas'

/** Priorité déduite de l'état (Mauvais = urgent). Modifiable à la main. */
export const STATE_PRIORITY: Record<ElementState, Priority> = {
  MAUVAIS: 'I',
  MOYEN: 'II',
  BON: 'III',
  TRES_BON: 'III',
}

/**
 * HYPOTHÈSES MÉTIER
 *
 * Les quantités que le catalogue exprime en nombre de pièces ne se déduisent pas
 * directement d'une surface : il faut une règle. Elles sont toutes réunies ici pour
 * être relues et ajustées par le métier en un seul endroit, et elles sont reprises
 * telles quelles dans le bloc « hypothèses » du rapport.
 */
export const HYPOTHESES = {
  /** Portes d'entrée d'immeuble : une par cage d'escalier (CFC 221). */
  entreesParCage: 1,
  /** Pièces d'eau par logement : salle de bain + cuisine. */
  piecesDEauParLogement: 2,
  /** Appareils sanitaires par pièce d'eau, d'après le libellé du catalogue (CFC 251). */
  pcesParPieceDEau: 2,
  /** Arbres à prévoir aux abords, d'après le libellé du catalogue (CFC 421). */
  arbresPar100m2Terrain: 2,
} as const

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

// ---------- Contexte de quantités ----------

export interface QuantityContext {
  builtArea: number
  floorArea: number
  terrainArea: number
  perimeter: number
  nbApartments: number
  nbFloors: number
  /** Façade vitrage compris. */
  facade: number
  /** Façade hors vitrage : ravalement, crépi, isolation périphérique. */
  opaqueFacade: number
  windows: number
  /** null tant que le type de toiture n'est pas précisé : aucune présomption. */
  roof: number | null
  scaffolding: number
  commons: number
  staircases: number
  entranceDoors: number
  wetRoomFixtures: number
  trees: number
}

/** Construit le contexte de quantités d'un dossier. Point d'entrée unique de tous les écrans. */
export function buildQuantityContext(project: ProjectGeometry): QuantityContext {
  const m = computeProjectMetrics(project)
  const terrainArea = project.terrainArea ?? 0
  return {
    builtArea: project.builtArea ?? 0,
    floorArea: project.floorArea ?? 0,
    terrainArea,
    perimeter: project.perimeter ?? 0,
    nbApartments: project.nbApartments ?? 0,
    nbFloors: project.nbFloors ?? 0,
    facade: m.facade,
    opaqueFacade: m.opaqueFacade,
    windows: m.windows,
    roof: m.roof,
    scaffolding: m.scaffolding,
    commons: m.commons,
    staircases: m.staircases,
    entranceDoors: m.staircases * HYPOTHESES.entreesParCage,
    wetRoomFixtures: m.wetRooms * HYPOTHESES.pcesParPieceDEau,
    trees: (terrainArea / 100) * HYPOTHESES.arbresPar100m2Terrain,
  }
}

// ---------- Résolution de la quantité ----------

export type QuantityOrigin = 'formule' | 'unite' | 'forfait' | 'manuelle'

export interface QuantityResolution {
  /** undefined = à saisir à la main. */
  quantity: number | undefined
  origin: QuantityOrigin
  /** Grandeur du bâtiment utilisée, pour l'afficher et le justifier dans le rapport. */
  basis: string | null
  /** Pourquoi la saisie reste manuelle, le cas échéant. */
  reason?: string
}

/** Compare deux libellés de catalogue sans se laisser piéger par la casse, les accents ou l'espacement. */
function normalize(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

type Resolver = (ctx: QuantityContext) => { value: number | null; basis: string }

/**
 * Les 9 formules réellement présentes au catalogue, associées une par une à la grandeur
 * qu'elles décrivent. Table exhaustive et volontairement rigide : une formule inconnue
 * n'est jamais devinée, elle tombe en saisie manuelle (voir resolveQuantity).
 */
const FORMULA_TABLE: Record<string, Resolver> = {
  // Façade HORS VITRAGE. Le libellé décrit le calcul de la façade entière (périmètre ×
  // étages × hauteur), mais les éléments qui portent cette formule sont des revêtements
  // de la partie pleine : crépi, maçonnerie, bardage, isolation périphérique, modénature.
  // Les fenêtres ont leur propre formule et leur propre CFC (221) : retenir la façade
  // entière ici reviendrait à facturer deux fois les mêmes mètres carrés.
  "perimetre x (etage x hauteur d'etage)": (c) => ({ value: c.opaqueFacade, basis: 'façade hors vitrage' }),
  // Toiture : le coefficient de pente est porté par le type de toiture du dossier,
  // pas par la formule. Sans type précisé, aucune présomption.
  'surface de batie x 1,35': (c) => ({ value: c.roof, basis: 'surface de toiture' }),
  'surface de batie': (c) => ({ value: c.builtArea, basis: 'emprise au sol' }),
  'm2 de facade x % de fenetre': (c) => ({ value: c.windows, basis: 'surface vitrée' }),
  "nombre d'appartement": (c) => ({ value: c.nbApartments, basis: 'nombre de logements' }),
  "nombre de portes d'entrees": (c) => ({ value: c.entranceDoors, basis: "portes d'entrée (1 par cage)" }),
  "nombre de cage d'escalier": (c) => ({ value: c.staircases, basis: "cages d'escalier" }),
  "2 pce par piece d'eau": (c) => ({ value: c.wetRoomFixtures, basis: "appareils sanitaires (2 par pièce d'eau)" }),
  '(compter 2 arbres pour 100 m2 de terrain)': (c) => ({ value: c.trees, basis: 'arbres (2 pour 100 m² de terrain)' }),
}

/** Unités de prix qui désignent d'elles-mêmes une grandeur, quand aucune formule n'est fournie. */
const UNIT_TABLE: Record<string, Resolver> = {
  'chf/m² fenetres': (c) => ({ value: c.windows, basis: 'surface vitrée' }),
  'chf/m2 fenetres': (c) => ({ value: c.windows, basis: 'surface vitrée' }),
  'chf/m² de toiture': (c) => ({ value: c.roof, basis: 'surface de toiture' }),
  'chf/m2 de toiture': (c) => ({ value: c.roof, basis: 'surface de toiture' }),
  'chf/m² sp': (c) => ({ value: c.floorArea, basis: 'surface de plancher' }),
  'chf/m2 sp': (c) => ({ value: c.floorArea, basis: 'surface de plancher' }),
}

/** Formules rencontrées hors table : signalées une fois pour être ajoutées au catalogue de règles. */
const unknownFormulas = new Set<string>()
export function getUnknownFormulas(): string[] { return [...unknownFormulas] }

/**
 * Détermine la quantité d'un élément et dit d'où elle vient.
 *
 * Ordre : formule du catalogue, puis unité de prix, puis forfait. Tout le reste est
 * une saisie manuelle assumée : le mètre linéaire, la pièce et le m² générique ne
 * désignent aucune grandeur connue du dossier.
 */
export function resolveQuantity(
  item: { quantityFormula?: string | null; unit?: string | null },
  ctx: QuantityContext,
): QuantityResolution {
  const formula = item.quantityFormula?.trim()
  if (formula) {
    const resolver = FORMULA_TABLE[normalize(formula)]
    if (resolver) {
      const { value, basis } = resolver(ctx)
      if (value == null) return { quantity: undefined, origin: 'manuelle', basis, reason: `${basis} inconnue sur ce dossier` }
      if (value <= 0) return { quantity: undefined, origin: 'manuelle', basis, reason: `${basis} non renseignée` }
      return { quantity: Math.round(value), origin: 'formule', basis }
    }
    unknownFormulas.add(formula)
  }

  const unit = item.unit?.trim()
  if (unit) {
    const u = normalize(unit)
    if (u.includes('forfait')) return { quantity: 1, origin: 'forfait', basis: 'prix forfaitaire' }
    const resolver = UNIT_TABLE[u]
    if (resolver) {
      const { value, basis } = resolver(ctx)
      if (value == null) return { quantity: undefined, origin: 'manuelle', basis, reason: `${basis} inconnue sur ce dossier` }
      if (value > 0) return { quantity: Math.round(value), origin: 'unite', basis }
      return { quantity: undefined, origin: 'manuelle', basis, reason: `${basis} non renseignée` }
    }
  }

  return {
    quantity: undefined,
    origin: 'manuelle',
    basis: null,
    reason: formula ? 'formule non reconnue' : 'unité sans grandeur déductible',
  }
}

/** Quantité seule. undefined = saisie manuelle. */
export function computeQuantity(
  item: { quantityFormula?: string | null; unit?: string | null },
  ctx: QuantityContext,
): number | undefined {
  return resolveQuantity(item, ctx).quantity
}

// ---------- Coûts ----------

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

/** Prix unitaire réellement appliqué = prix catalogue × coefficient marché. */
export function appliedUnitPrice(price: string | null | undefined): number | undefined {
  const unit = priceToNumber(price)
  return unit == null ? undefined : Math.round(unit * marketCoeff * 100) / 100
}

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
