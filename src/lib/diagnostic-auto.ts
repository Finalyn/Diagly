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
  /** Portes palières : une par logement (CFC 273). */
  portesPalieresParLogement: 1,
  /** Pièces d'eau par logement : salle de bain + cuisine. */
  piecesDEauParLogement: 2,
  /** Arbres à prévoir aux abords, d'après le libellé du catalogue (CFC 421). */
  arbresPar100m2Terrain: 2,
  /**
   * Descentes d'eaux pluviales selon l'emprise au sol (retour de visite du 1er sept. 2026).
   * Le métré est ensuite le nombre de descentes × la hauteur du bâtiment.
   */
  descentesEauxPluviales: [
    { jusqua: 400, nombre: 4 },
    { jusqua: 900, nombre: 8 },
    { jusqua: Infinity, nombre: 10 },
  ],
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
  /** Hauteur du bâtiment : étages × hauteur d'étage. */
  buildingHeight: number
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
  /** Portes palières, une par logement : c'est le métré des menuiseries des communs. */
  landingDoors: number
  /** m² de carrelage des salles de bain, déduits du nombre de logements. */
  bathroomTiles: number
  trees: number
  /** Somme des pièces de tous les logements, depuis les typologies saisies. 0 si absentes. */
  apartmentRooms: number
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
    buildingHeight: (project.nbFloors ?? 0) * (project.floorHeight ?? 2.7),
    facade: m.facade,
    opaqueFacade: m.opaqueFacade,
    windows: m.windows,
    roof: m.roof,
    scaffolding: m.scaffolding,
    commons: m.commons,
    staircases: m.staircases,
    entranceDoors: m.staircases * HYPOTHESES.entreesParCage,
    landingDoors: m.landingDoors * HYPOTHESES.portesPalieresParLogement,
    bathroomTiles: m.tilesBathrooms,
    trees: (terrainArea / 100) * HYPOTHESES.arbresPar100m2Terrain,
    apartmentRooms: totalPieces(project.apartmentTypes),
  }
}

/**
 * Somme des pièces de l'immeuble, depuis la répartition par typologie saisie sur
 * la fiche : { "3.5": 5, "4.5": 2 } vaut 5 × 3,5 + 2 × 4,5 = 26,5 pièces.
 * Rend 0 si la répartition n'a pas été renseignée : la formule reste au relevé.
 */
function totalPieces(types: Record<string, number> | null | undefined): number {
  if (!types) return 0
  let total = 0
  for (const [typologie, nombre] of Object.entries(types)) {
    const pieces = Number(String(typologie).replace(',', '.'))
    if (Number.isFinite(pieces) && Number.isFinite(nombre)) total += pieces * nombre
  }
  return total
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

type Resolver = (ctx: QuantityContext) => {
  value: number | null
  basis: string
  /** Renseigné quand la grandeur ne se déduit pas du dossier : la saisie reste au relevé. */
  reason?: string
}

/**
 * Les 9 formules réellement présentes au catalogue, associées une par une à la grandeur
 * qu'elles décrivent. Table exhaustive et volontairement rigide : une formule inconnue
 * n'est jamais devinée, elle tombe en saisie manuelle (voir resolveQuantity).
 */
/**
 * Descentes d'eaux pluviales : leur nombre dépend de l'emprise au sol, leur longueur
 * de la hauteur du bâtiment. Le métré est donc en mètres courants de descente.
 */
function descentesEauxPluviales(c: QuantityContext): Resolved {
  if (!c.builtArea || !c.buildingHeight) {
    return { value: null, basis: 'descentes EP', reason: "emprise au sol ou hauteur du bâtiment non renseignée" }
  }
  const palier = HYPOTHESES.descentesEauxPluviales.find((t) => c.builtArea <= t.jusqua)!
  return {
    value: palier.nombre * c.buildingHeight,
    basis: `${palier.nombre} descentes × ${Math.round(c.buildingHeight)} m de hauteur`,
  }
}

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
  // Le nombre d'appareils sanitaires ne se déduit pas du nombre de logements : il dépend
  // de la typologie de chaque appartement. Déduire « 2 par pièce d'eau » donnait un métré
  // faux (retour de visite du 1er septembre 2026) : on le laisse au relevé.
  "2 pce par piece d'eau": () => ({
    value: null,
    basis: 'appareils sanitaires',
    reason: 'à compter sur place, le nombre dépend de la typologie des logements',
  }),
  // Descentes d'eaux pluviales : leur nombre dépend de l'emprise au sol, leur longueur
  // de la hauteur du bâtiment. Le métré est donc en mètres courants de descente.
  'descentes ep : 4/8/10 selon surface batie x hauteur': (c) => descentesEauxPluviales(c),
  '(compter 2 arbres pour 100 m2 de terrain)': (c) => ({ value: c.trees, basis: 'arbres (2 pour 100 m² de terrain)' }),

  // La surface de plancher est la grandeur la plus utilisée du catalogue : elle sert
  // de base à tous les revêtements intérieurs et aux installations techniques.
  'surface de plancher': (c) => ({ value: c.floorArea, basis: 'surface de plancher' }),
  sp: (c) => ({ value: c.floorArea, basis: 'surface de plancher' }),
  'surface de fenetres': (c) => ({ value: c.windows, basis: 'surface vitrée' }),
  "nombre d'etage": (c) => ({ value: c.nbFloors, basis: "nombre d'étages" }),
  "nombre d'appartements": (c) => ({ value: c.nbApartments, basis: 'nombre de logements' }),
  'nombre de piece par appartement': (c) => ({ value: c.apartmentRooms, basis: 'pièces de l\'immeuble (depuis les typologies)' }),

  // Portes palières plus portes de garage : les premières se déduisent du nombre de
  // logements, les secondes non. On rend la part connue en le disant.
  'portes palieres + portes de garage': (c) => ({
    value: c.landingDoors,
    basis: 'portes palières (1 par logement), portes de garage à ajouter au relevé',
  }),

  // Ces deux-là ne désignent aucune grandeur du dossier : elles appellent un relevé.
  pce: () => ({ value: null, basis: 'quantité', reason: 'à relever sur place' }),
  'a definir': () => ({ value: null, basis: 'quantité', reason: 'à définir sur place' }),

  // Le nombre de salles d'eau dépend de la typologie des logements, et la règle qui
  // relie l'une à l'autre n'est pas arrêtée. Tant qu'elle ne l'est pas, on relève.
  "25 m2 par salle d'eau": () => ({
    value: null,
    basis: "salles d'eau",
    reason: "le nombre de salles d'eau par logement n'est pas encore fixé",
  }),
}

/**
 * Formules paramétrées : la même règle s'écrit avec un nombre différent d'un
 * ouvrage à l'autre. Les reconnaître par motif évite d'ajouter une entrée au
 * tableau chaque fois que le bureau change un coefficient.
 */
const FORMULA_PATTERNS: { motif: RegExp; resolve: (m: RegExpMatchArray, c: QuantityContext) => Resolved }[] = [
  // « 20% de la surface de plancher », « 60% de la surface de plancher »
  {
    motif: /^(\d+(?:[.,]\d+)?)\s*% de la surface de plancher$/,
    resolve: (m, c) => {
      const part = Number(m[1].replace(',', '.')) / 100
      return { value: c.floorArea * part, basis: `${m[1]} % de la surface de plancher` }
    },
  },
  // « 10 ml / appartement », « 1.5 ml / appartement »
  {
    motif: /^(\d+(?:[.,]\d+)?)\s*ml\s*\/\s*appartements?$/,
    resolve: (m, c) => {
      const parLogement = Number(m[1].replace(',', '.'))
      return { value: c.nbApartments * parLogement, basis: `${m[1]} ml par logement` }
    },
  },
  // « 1 pce / appartement »
  {
    motif: /^(\d+(?:[.,]\d+)?)\s*pce\s*\/\s*appartements?$/,
    resolve: (m, c) => {
      const parLogement = Number(m[1].replace(',', '.'))
      return { value: c.nbApartments * parLogement, basis: `${m[1]} par logement` }
    },
  },
  // Descentes d'eaux pluviales, écrites en toutes lettres dans le tableau.
  {
    motif: /surface de b[ai]tie est entre 100 et 400/,
    resolve: (_m, c) => descentesEauxPluviales(c),
  },
]

/**
 * Règles par code CFC, pour les items que le catalogue laisse sans formule.
 *
 * Le tableau de référence ne porte une formule que sur une partie des lignes ; les
 * revêtements intérieurs, par exemple, n'en ont aucune et restaient donc sans métré.
 * Règle métier : tout ce qui habille l'intérieur se compte à la surface de plancher,
 * sauf la faïence, qui ne concerne que les pièces d'eau.
 */
const CFC_RULES: { code: RegExp; unit?: RegExp; description?: RegExp; resolve: Resolver }[] = [
  // Menuiseries intérieures des communs (CFC 273.0) : une porte palière par logement.
  // Elles se comptent à la pièce, pas au mètre carré (retour de visite du 1er sept. 2026).
  {
    code: /^273\.0/,
    resolve: (c) => ({ value: c.landingDoors, basis: 'portes palières (1 par logement)' }),
  },
  // Faïence : uniquement les salles de bain, pas toute la surface de plancher.
  {
    code: /^28/, description: /faience|faïence/i,
    resolve: (c) => ({ value: c.bathroomTiles, basis: 'carrelage des salles de bain' }),
  },
  // Revêtements intérieurs : sols (281), murs (282), plafonds (283), au m² de plancher.
  {
    code: /^28/, unit: /^chf\s*\/?\s*m[²2]$/i,
    resolve: (c) => ({ value: c.floorArea, basis: 'surface de plancher' }),
  },
  // Cloisons et parois intérieures (272) : idem, rapportées à la surface de plancher.
  {
    code: /^272/, unit: /^chf\s*\/?\s*m[²2]$/i,
    resolve: (c) => ({ value: c.floorArea, basis: 'surface de plancher' }),
  },
]

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
  item: { quantityFormula?: string | null; unit?: string | null; cfcCode?: string | null; description?: string | null },
  ctx: QuantityContext,
): QuantityResolution {
  const formula = item.quantityFormula?.trim()
  if (formula) {
    const cle = normalize(formula)
    const parMotif = FORMULA_PATTERNS.map((p) => {
      const m = cle.match(p.motif)
      return m ? () => p.resolve(m, ctx) : null
    }).find(Boolean)
    const resolver = FORMULA_TABLE[cle] ?? (parMotif ? () => parMotif() : undefined)
    if (resolver) {
      const { value, basis, reason } = resolver(ctx)
      if (value == null) return { quantity: undefined, origin: 'manuelle', basis, reason: reason ?? `${basis} inconnue sur ce dossier` }
      if (value <= 0) return { quantity: undefined, origin: 'manuelle', basis, reason: reason ?? `${basis} non renseignée` }
      return { quantity: Math.round(value), origin: 'formule', basis }
    }
    unknownFormulas.add(formula)
  }

  const code = item.cfcCode?.trim()
  const unitRaw = item.unit?.trim() ?? ''
  if (code) {
    const rule = CFC_RULES.find(
      (r) => r.code.test(code)
        && (!r.unit || r.unit.test(unitRaw))
        && (!r.description || r.description.test(item.description ?? '')),
    )
    if (rule) {
      const { value, basis } = rule.resolve(ctx)
      if (value == null || value <= 0) {
        return { quantity: undefined, origin: 'manuelle', basis, reason: `${basis} non renseignée` }
      }
      return { quantity: Math.round(value), origin: 'formule', basis }
    }
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
  item: { quantityFormula?: string | null; unit?: string | null; cfcCode?: string | null; description?: string | null },
  ctx: QuantityContext,
): number | undefined {
  return resolveQuantity(item, ctx).quantity
}

// ---------- Coûts ----------

/**
 * Indexation des coûts sur le marché suisse. Les prix du catalogue sont une base
 * de référence ; l'indice OFS des prix de la construction les ramène au marché du
 * moment. Chargé au démarrage depuis /api/market/index (endpoint public, donc
 * disponible aussi sur le rapport partagé), ajustable côté serveur sans
 * redéployer le front : un diagnostic chiffré aujourd'hui suit les publications
 * suivantes de l'OFS sans qu'on touche au catalogue.
 */
export interface MarketInfo {
  coeff: number
  base: number
  index: number
  /** Période de l'indice courant, au format AAAA-MM. */
  indexDate: string
  source: string
}

let market: MarketInfo = { coeff: 1, base: 100, index: 100, indexDate: '', source: '' }

export function setMarketInfo(m: Partial<MarketInfo> | null | undefined) {
  if (!m || typeof m.coeff !== 'number' || !isFinite(m.coeff) || m.coeff <= 0) return
  market = {
    coeff: m.coeff,
    base: typeof m.base === 'number' ? m.base : market.base,
    index: typeof m.index === 'number' ? m.index : market.index,
    indexDate: m.indexDate ?? '',
    source: m.source ?? '',
  }
}

/** Ne renseigne que le coefficient (tests, appels historiques). */
export function setMarketCoeff(v: number | null | undefined) {
  if (typeof v === 'number' && isFinite(v) && v > 0) market = { ...market, coeff: v }
}
export function getMarketCoeff(): number { return market.coeff }
export function getMarketInfo(): MarketInfo { return market }

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « avril 2025 » à partir de « 2025-04 ». Rend la valeur telle quelle si le format diffère. */
export function marketPeriodLabel(d: string = market.indexDate): string {
  const m = /^(\d{4})-(\d{2})$/.exec(d ?? '')
  if (!m) return d ?? ''
  return MOIS[Number(m[2]) - 1] ? `${MOIS[Number(m[2]) - 1]} ${m[1]}` : d
}

const nb = (v: number, dec: number) =>
  v.toLocaleString('fr-CH', { minimumFractionDigits: dec, maximumFractionDigits: dec })

/**
 * Mention de la base de prix, à afficher partout où un montant est lu : écran,
 * rapport, rapport partagé, PDF, export. Une seule formulation pour tout le
 * produit, qui suit l'indice servi par le serveur.
 */
export function priceBasisNote(): string {
  const fin = " Estimation indicative, elle ne remplace pas un devis d'entreprise."
  // Coefficient à 1 : les prix du catalogue sont déjà ceux du marché, on n'indexe pas.
  if (market.coeff === 1) {
    const base = market.source || 'Prix du catalogue, sans indexation'
    return (base.endsWith('.') ? base : base + '.') + fin
  }
  const periode = marketPeriodLabel()
  const de = /^[aeiouàâéèêîôû]/i.test(periode) ? "d'" : 'de '
  return "Prix de référence indexés sur l'indice suisse des prix de la construction (OFS)"
    + `, indice ${nb(market.index, 1)}${periode ? ` ${de}${periode}` : ''}`
    + `, coefficient ×${nb(market.coeff, 3)}.` + fin
}

/** Version courte, pour les endroits où la place manque. */
export function priceBasisShort(): string {
  if (market.coeff === 1) return 'prix du catalogue, sans indexation'
  const periode = marketPeriodLabel()
  return `indice OFS ${nb(market.index, 1)}${periode ? ` (${periode})` : ''}, ×${nb(market.coeff, 3)}`
}

/** Prix unitaire réellement appliqué = prix catalogue × coefficient marché. */
export function appliedUnitPrice(price: string | null | undefined): number | undefined {
  const unit = priceToNumber(price)
  return unit == null ? undefined : Math.round(unit * market.coeff * 100) / 100
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
  return Math.round(unit * quantity * market.coeff)
}

/** Coût générique = prix unitaire catalogue (string) × quantité × coefficient marché. Sert à l'amélioration / remise aux normes. */
export function computeCostFromPrice(
  price: string | null | undefined,
  quantity: number | null | undefined,
): number | undefined {
  if (!quantity) return undefined
  const unit = priceToNumber(price)
  if (unit == null) return undefined
  return Math.round(unit * quantity * market.coeff)
}
