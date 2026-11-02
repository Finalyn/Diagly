// Récupération automatique d'infos bâtiment/parcelle depuis les services
// fédéraux geo.admin.ch (gratuits, sans clé), à partir des coordonnées LV95.
//
//  - RegBL / GWR (ch.bfs.gebaeude_wohnungs_register) : année de construction,
//    surface au sol, nb d'étages et de logements (ces deux derniers souvent
//    absents du registre).
//  - Cadastre (ch.kantone.cadastralwebmap-farbe) : n° de parcelle, EGRID, et
//    surface de la parcelle (calculée depuis la géométrie).
//
// Un immeuble à plusieurs entrées (Champrilly 16-18-20) compte au RegBL un EGID
// par entrée. Le point de l'adresse ne touche que l'une d'elles : on regroupe
// donc les EGID de la même parcelle dont le centre tombe dans le contour du
// bâtiment cliqué, et la fiche reçoit l'immeuble entier.

import type { GeoData } from './api-types'

const IDENTIFY = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify'
const SEARCH = 'https://api3.geo.admin.ch/rest/services/api/SearchServer'

export interface RegistryInfo {
  egid?: string               // l'entrée trouvée à l'adresse choisie
  yearBuilt?: number
  builtArea?: number          // m² : surface au sol (emprise) du bâtiment
  perimeter?: number          // ml : périmètre du contour du bâtiment
  perimeterEstimated?: boolean // true si déduit de l'emprise faute d'un contour fiable
  floorArea?: number          // m² : surface de plancher (somme logements, EBF ou estimée)
  floorAreaEstimated?: boolean // true si calculée (emprise × étages), false si donnée réelle
  nbFloors?: number
  nbApartments?: number
  buildingType?: string       // type déduit de la classe GWR (LOGEMENT, VILLA, BUREAU…)
  nbStaircases?: number       // une cage par entrée, quand le bâtiment en a plusieurs
  parcelNumber?: string
  egrid?: string
  terrainArea?: number        // m² : surface de la parcelle
  /**
   * Les entrées du bâtiment, quand il en a plusieurs. Les grandeurs ci-dessus
   * sont alors leur cumul : emprise, plancher et logements additionnés, étages
   * du plus haut.
   */
  entrees?: EntreeRegistre[]
}

/** Une entrée au RegBL : un EGID, une adresse. */
export interface EntreeRegistre {
  egid?: string
  adresse?: string
  yearBuilt?: number
  builtArea?: number
  floorArea?: number
  floorAreaEstimated?: boolean
  nbFloors?: number
  nbApartments?: number
  buildingType?: string
}

/** Mappe la classe de bâtiment GWR (gklas, classification EUROSTAT) vers nos types. */
function mapBuildingType(gklas: number | undefined): string | undefined {
  switch (gklas) {
    case 1110: return 'VILLA'                          // maison individuelle (1 logement)
    case 1121: case 1122: case 1130: return 'LOGEMENT' // 2, 3+ logements, habitation collective
    case 1211: case 1212: return 'HOTEL'               // hôtel, hébergement court
    case 1220: return 'BUREAU'                         // bureaux
    case 1230: case 1231: return 'COMMERCIAL'          // commerce, restaurants
    case 1251: case 1252: return 'INDUSTRIEL'          // industrie, dépôts
    case 1263: return 'SCOLAIRE'                        // écoles, recherche
    case undefined: return undefined                   // pas de classe → ne pas imposer
    default: return 'AUTRE'                             // transport, santé, culte, sport…
  }
}

interface IdentifyOpts {
  tolerance?: number
  returnGeometry?: boolean
  geometryFormat?: 'geojson'
}

function identifyUrl(layer: string, east: number, north: number, opts: IdentifyOpts = {}): string {
  const d = 80
  const params = new URLSearchParams({
    geometry: `${east},${north}`,
    geometryType: 'esriGeometryPoint',
    layers: `all:${layer}`,
    mapExtent: `${east - d},${north - d},${east + d},${north + d}`,
    imageDisplay: '100,100,96',
    tolerance: String(opts.tolerance ?? 5),
    sr: '2056',
    returnGeometry: String(opts.returnGeometry ?? false),
    lang: 'fr',
  })
  if (opts.geometryFormat) params.set('geometryFormat', opts.geometryFormat)
  return `${IDENTIFY}?${params.toString()}`
}

type Ring = number[][]

function ringArea(ring: Ring): number {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(sum) / 2
}

function polygonArea(geom: { type?: string; coordinates?: number[][][] | number[][][][] } | undefined): number {
  if (!geom) return 0
  if (geom.type === 'Polygon') {
    const c = geom.coordinates as number[][][]
    return ringArea(c[0]) - c.slice(1).reduce((a, h) => a + ringArea(h), 0)
  }
  if (geom.type === 'MultiPolygon') {
    const c = geom.coordinates as number[][][][]
    return c.reduce((a, poly) => a + ringArea(poly[0]) - poly.slice(1).reduce((s, h) => s + ringArea(h), 0), 0)
  }
  return 0
}

const num = (v: unknown): number | undefined => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/** Ce qu'une fiche RegBL dit d'une entrée. */
function lireEntree(a: Record<string, unknown>): EntreeRegistre {
  const e: EntreeRegistre = {}
  e.egid = a.egid != null ? String(a.egid) : undefined
  const rue = Array.isArray(a.strname) ? a.strname[0] : a.strname
  if (rue) e.adresse = [rue, a.deinr].filter(v => v != null && String(v).trim() !== '').join(' ')
  e.yearBuilt = num(a.gbauj)
  e.builtArea = num(a.garea)       // surface au sol officielle
  e.nbFloors = num(a.gastw)

  // Type de bâtiment depuis la classe GWR.
  const gklas = num(a.gklas)
  e.buildingType = mapBuildingType(gklas)

  // Nombre de logements adapté au type :
  //  - villa → 1 logement par définition
  //  - non résidentiel (bureau, industriel, scolaire…) → 0
  //  - immeuble d'habitation → valeur du registre (ganzwhg), repli 2 si classe « 2 logements »
  const residential = e.buildingType === 'LOGEMENT' || e.buildingType === 'VILLA'
  if (e.buildingType === 'VILLA') {
    e.nbApartments = 1
  } else if (residential) {
    e.nbApartments = num(a.ganzwhg) ?? (gklas === 1121 ? 2 : undefined)
  } else if (e.buildingType) {
    e.nbApartments = 0
  } else {
    e.nbApartments = num(a.ganzwhg)
  }

  // Surface de plancher :
  //  1) emprise au sol × nombre d'étages (méthode principale demandée)
  //  2) sinon somme des surfaces des logements (warea) — donnée réelle
  //  3) sinon surface de référence énergétique officielle (gebf)
  const wareas = Array.isArray(a.warea)
    ? (a.warea as unknown[]).map(Number).filter(v => Number.isFinite(v) && v > 0)
    : []
  const wareaSum = wareas.reduce((s, v) => s + v, 0)
  const gebf = num(a.gebf)
  if (e.builtArea && e.nbFloors) {
    e.floorArea = Math.round(e.builtArea * e.nbFloors)
    e.floorAreaEstimated = true
  } else if (wareaSum > 0) {
    e.floorArea = Math.round(wareaSum)
    e.floorAreaEstimated = false
  } else if (gebf) {
    e.floorArea = gebf
    e.floorAreaEstimated = false
  }
  return e
}

/** Distance du point (x, y) au segment [a, b]. */
function distanceAuSegment(x: number, y: number, [ax, ay]: number[], [bx, by]: number[]): number {
  const dx = bx - ax, dy = by - ay
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

/**
 * Le point est-il dans le contour, à `marge` mètres près ? Le contour VECTOR25
 * est généralisé au 1:25'000 : sur Champrilly 22-24-26, les centres RegBL de 24
 * et 26 tombent à moins d'un mètre hors du bord.
 */
function pointDansContour(x: number, y: number, geom: { type?: string; coordinates?: unknown } | undefined, marge = 3): boolean {
  if (!geom || !Number.isFinite(x) || !Number.isFinite(y)) return false
  const polygones = geom.type === 'Polygon'
    ? [geom.coordinates as number[][][]]
    : geom.type === 'MultiPolygon' ? geom.coordinates as number[][][][] : []
  return polygones.some(([anneau]) => {
    let dedans = false
    for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
      const [xi, yi] = anneau[i], [xj, yj] = anneau[j]
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans
      if (distanceAuSegment(x, y, anneau[i], anneau[j]) <= marge) return true
    }
    return dedans
  })
}

/** L'enveloppe [xmin, ymin, xmax, ymax] d'un contour. */
function enveloppe(geom: { coordinates?: unknown }): [number, number, number, number] | null {
  const pts = (JSON.stringify(geom.coordinates ?? []).match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
  if (pts.length < 4) return null
  const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1)
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
}

/**
 * Les autres entrées du bâtiment : les EGID de la même parcelle dont le centre
 * tombe dans le contour. La parcelle écarte les voisins mitoyens d'un îlot
 * (VECTOR25 fusionne les bâtiments contigus) ; le contour écarte les annexes
 * et les bâtiments séparés d'une même parcelle.
 */
async function entreesDuContour(
  principale: Record<string, unknown>,
  contour: { type?: string; coordinates?: unknown },
): Promise<Record<string, unknown>[]> {
  const egrid = principale.egrid
  const env = enveloppe(contour)
  const annexe = (a: Record<string, unknown>) => /\.\d+$/.test(String(a.deinr ?? ''))
  if (!egrid || !env || annexe(principale)) return [principale]
  const [x0, y0, x1, y1] = [env[0] - 3, env[1] - 3, env[2] + 3, env[3] + 3]
  const params = new URLSearchParams({
    geometry: `${x0},${y0},${x1},${y1}`,
    geometryType: 'esriGeometryEnvelope',
    layers: 'all:ch.bfs.gebaeude_wohnungs_register',
    mapExtent: `${x0},${y0},${x1},${y1}`,
    imageDisplay: '100,100,96',
    tolerance: '0',
    sr: '2056',
    returnGeometry: 'false',
    lang: 'fr',
  })
  const data = await (await fetch(`${IDENTIFY}?${params.toString()}`)).json()
  const vus = new Set<string>()
  const entrees = ((data.results ?? []) as { attributes?: Record<string, unknown> }[])
    .map(r => r.attributes ?? {})
    .filter(a => a.egrid === egrid && pointDansContour(Number(a.gkode), Number(a.gkodn), contour))
    // « 10.1 » : un bâtiment sans entrée propre (annexe, garage, aile), pas une entrée.
    .filter(a => !annexe(a))
    .filter(a => { const id = String(a.egid); if (vus.has(id)) return false; vus.add(id); return true })
  if (!entrees.some(a => String(a.egid) === String(principale.egid))) entrees.push(principale)
  // Dans l'ordre des numéros : 16, 18, 20.
  return entrees.sort((a, b) => parseFloat(String(a.deinr)) - parseFloat(String(b.deinr)))
}

/**
 * Récupère les infos bâtiment + parcelle pour un point (coordonnées LV95 / EPSG:2056).
 * Tolérant aux pannes : chaque source est interrogée indépendamment, et on
 * renvoie tout ce qui a pu être trouvé (objet vide si rien).
 */
export async function fetchRegistryInfo(east: number, north: number): Promise<RegistryInfo> {
  const info: RegistryInfo = {}

  // --- RegBL / GWR : bâtiment ---
  let principale: Record<string, unknown> | undefined
  try {
    const res = await fetch(identifyUrl('ch.bfs.gebaeude_wohnungs_register', east, north, { tolerance: 10 }))
    const data = await res.json()
    const results: { attributes?: Record<string, unknown> }[] = data.results ?? []
    // On retient le bâtiment dont le centre est le plus proche du point cliqué
    // (et non la plus grosse annexe voisine).
    let bestDist = Infinity
    for (const r of results) {
      const a = r.attributes ?? {}
      const gx = Number(a.gkode), gy = Number(a.gkodn)
      const dist = Number.isFinite(gx) && Number.isFinite(gy)
        ? (gx - east) ** 2 + (gy - north) ** 2
        : Infinity
      if (dist < bestDist) { bestDist = dist; principale = a }
    }
    principale ??= results[0]?.attributes
    if (principale) {
      const e = lireEntree(principale)
      info.egid = e.egid
      info.yearBuilt = e.yearBuilt
      info.builtArea = e.builtArea
      info.nbFloors = e.nbFloors
      info.buildingType = e.buildingType
      info.nbApartments = e.nbApartments
      info.floorArea = e.floorArea
      info.floorAreaEstimated = e.floorAreaEstimated
    }
  } catch { /* réseau / CORS : on ignore */ }

  // --- Empreinte bâtiment (VECTOR25) : contour, périmètre + surface au sol ---
  let contour: { type?: string; coordinates?: unknown; area?: number; perimeter?: number } | undefined
  try {
    const res = await fetch(identifyUrl('ch.swisstopo.vec25-gebaeude', east, north, {
      tolerance: 1, returnGeometry: true, geometryFormat: 'geojson',
    }))
    const feature = ((await res.json()).results ?? [])[0]
    if (feature) {
      const p = feature.properties ?? feature.attributes ?? {}
      contour = { ...feature.geometry, area: num(p.area), perimeter: num(p.perimeter) }
    }
  } catch { /* réseau / CORS : on ignore */ }

  // --- Les autres entrées du même bâtiment ---
  if (principale && contour) {
    try {
      const entrees = (await entreesDuContour(principale, contour)).map(lireEntree)
      if (entrees.length > 1) {
        const somme = (k: 'builtArea' | 'floorArea' | 'nbApartments') => {
          const vals = entrees.map(e => e[k]).filter((v): v is number => v != null)
          return vals.length ? vals.reduce((s, v) => s + v, 0) : undefined
        }
        const etages = entrees.map(e => e.nbFloors).filter((v): v is number => v != null)
        info.entrees = entrees
        info.builtArea = somme('builtArea')
        info.floorArea = somme('floorArea')
        info.floorAreaEstimated = entrees.some(e => e.floorAreaEstimated)
        info.nbApartments = somme('nbApartments')
        info.nbFloors = etages.length ? Math.max(...etages) : info.nbFloors
        info.nbStaircases = entrees.length
      }
    } catch { /* réseau / CORS : on garde l'entrée seule */ }
  }

  // Périmètre. Attention : VECTOR25 est au 1:25'000, où les bâtiments contigus sont
  // fusionnés en un seul îlot. Reprendre son périmètre tel quel donnait des façades
  // démesurées en centre-ville (relevé : contour de 2017 m² et 346 ml pour un bâtiment
  // de 708 m²). On ne retient donc le périmètre que si le contour correspond bien AU
  // bâtiment, c'est-à-dire si sa surface est proche de l'emprise officielle du RegBL,
  // toutes entrées comprises.
  if (contour) {
    const per = contour.perimeter
    const contourArea = contour.area
    const ratio = contourArea && info.builtArea ? contourArea / info.builtArea : null

    if (per && (ratio == null || ratio <= 1.3)) {
      info.perimeter = Math.round(per) // contour du bâtiment seul : exploitable
    } else if (info.builtArea) {
      // Contour d'îlot : on estime le périmètre depuis l'emprise plutôt que de
      // propager une valeur fausse. 4,3 × √surface correspond à un bâtiment
      // rectangulaire un peu allongé, l'ordre de grandeur courant en immeuble.
      info.perimeter = Math.round(4.3 * Math.sqrt(info.builtArea))
      info.perimeterEstimated = true
    }

    // Surface bâtie : on garde la valeur officielle GWR ; vec25 ne sert de repli que
    // si son contour ne couvre visiblement qu'un bâtiment.
    if (info.builtArea == null && contourArea) info.builtArea = Math.round(contourArea)
  }

  // --- Cadastre : parcelle ---
  try {
    const res = await fetch(identifyUrl('ch.kantone.cadastralwebmap-farbe', east, north, {
      tolerance: 1, returnGeometry: true, geometryFormat: 'geojson',
    }))
    const data = await res.json()
    const feature = (data.results ?? [])[0]
    if (feature) {
      const p = feature.properties ?? {}
      if (p.number != null) info.parcelNumber = String(p.number)
      if (p.egris_egrid) info.egrid = String(p.egris_egrid)
      const area = polygonArea(feature.geometry)
      if (area > 0) info.terrainArea = Math.round(area)
    }
  } catch { /* réseau / CORS : on ignore */ }

  return info
}

// ---------- Enrichissement géographique (contraintes) ----------

/** Géocode une adresse en coordonnées LV95 (EPSG:2056). En sr=2056, attrs.y = est, attrs.x = nord. */
export async function geocodeLV95(query: string): Promise<{ east: number; north: number } | null> {
  try {
    const url = `${SEARCH}?type=locations&origins=address&limit=1&sr=2056&searchText=${encodeURIComponent(query)}`
    const data = await (await fetch(url)).json()
    const a = data?.results?.[0]?.attrs
    if (a && Number.isFinite(a.y) && Number.isFinite(a.x)) return { east: Number(a.y), north: Number(a.x) }
  } catch { /* ignore */ }
  return null
}

/** Premier objet d'attributs renvoyé par identify pour une couche (null si rien / panne). */
async function identifyAttrs(layer: string, east: number, north: number, opts: IdentifyOpts = {}): Promise<Record<string, unknown> | null> {
  try {
    const data = await (await fetch(identifyUrl(layer, east, north, opts))).json()
    return (data.results ?? [])[0]?.attributes ?? null
  } catch {
    return null
  }
}

const pickStr = (a: Record<string, unknown> | null, keys: string[]): string | undefined => {
  if (!a) return undefined
  for (const k of keys) { const v = a[k]; if (v != null && String(v).trim() !== '') return String(v) }
  return undefined
}

export interface TerrainResult {
  egid?: string
  egrid?: string
  data: GeoData
}

/**
 * Récupère les contraintes & données géographiques publiques (geo.admin) pour un point LV95.
 * Chaque couche est interrogée indépendamment ; on renvoie tout ce qui a été trouvé.
 */
export async function fetchTerrainConstraints(east: number, north: number): Promise<TerrainResult> {
  const data: GeoData = { heritage: {} }
  let egid: string | undefined
  let egrid: string | undefined

  // RegBL / GWR : EGID (+ emprise au sol) du bâtiment LE PLUS PROCHE du point
  // (et non la première annexe voisine renvoyée).
  try {
    const res = await fetch(identifyUrl('ch.bfs.gebaeude_wohnungs_register', east, north, { tolerance: 10 }))
    const results: { attributes?: Record<string, unknown> }[] = (await res.json()).results ?? []
    let best: Record<string, unknown> | undefined
    let bestDist = Infinity
    for (const r of results) {
      const a = r.attributes ?? {}
      const gx = Number(a.gkode), gy = Number(a.gkodn)
      const dist = Number.isFinite(gx) && Number.isFinite(gy) ? (gx - east) ** 2 + (gy - north) ** 2 : Infinity
      if (dist < bestDist) { bestDist = dist; best = a }
    }
    const a = best ?? results[0]?.attributes
    if (a) {
      egid = pickStr(a, ['egid'])
      egrid = pickStr(a, ['egrid'])
      const foot = num(a.garea)
      if (foot) data.footprintArea = Math.round(foot)
      const vol = num(a.gvol)
      if (vol) data.volume = Math.round(vol)
    }
  } catch { /* ignore */ }

  // Cadastre : n° de parcelle (+ EGRID de repli)
  try {
    const res = await fetch(identifyUrl('ch.kantone.cadastralwebmap-farbe', east, north, { tolerance: 1, returnGeometry: true, geometryFormat: 'geojson' }))
    const feature = ((await res.json()).results ?? [])[0]
    const p = feature?.properties ?? {}
    if (p.number != null) data.parcelNumber = String(p.number)
    if (!egrid && p.egris_egrid) egrid = String(p.egris_egrid)
  } catch { /* ignore */ }

  // Affectation harmonisée
  const zone = await identifyAttrs('ch.are.bauzonen', east, north, { tolerance: 5 })
  data.affectation = pickStr(zone, ['ch_bez_f', 'ch_bez_d', 'label'])

  // Radon
  const radon = await identifyAttrs('ch.bag.radonkarte', east, north, { tolerance: 10 })
  if (radon) { const p = num(radon.probability_prozent); if (p != null) data.radonPct = p }

  // Patrimoine protégé
  const isos = await identifyAttrs('ch.bak.bundesinventar-schuetzenswerte-ortsbilder', east, north, { tolerance: 5 })
  data.heritage!.isos = pickStr(isos, ['name', 'label'])
  data.heritage!.isosCategory = pickStr(isos, ['siedlungskategorie'])
  const unesco = await identifyAttrs('ch.bak.schutzgebiete-unesco_weltkulturerbe', east, north, { tolerance: 5 })
  data.heritage!.unesco = pickStr(unesco, ['name_fr', 'name', 'label'])
  const bln = await identifyAttrs('ch.bafu.bundesinventare-bln', east, north, { tolerance: 5 })
  data.heritage!.bln = pickStr(bln, ['name_fr', 'name', 'label'])

  // Aléa sismique (classe de sol de fondation, SIA 261)
  const seismic = await identifyAttrs('ch.bafu.gefahren-baugrundklassen', east, north, { tolerance: 5 })
  data.seismic = pickStr(seismic, ['bgk', 'label'])

  // Dangers naturels : pas de valeur ponctuelle au fédéral -> lien vers la carte officielle
  const e = Math.round(east), n = Math.round(north)
  data.hazardsMapUrl = `https://map.geo.admin.ch/?lang=fr&E=${e}&N=${n}&zoom=10&crosshair=marker&bgLayer=ch.swisstopo.pixelkarte-farbe&layers=ch.bafu.aquaprotect_100,ch.bafu.silvaprotect-hangmuren,ch.bafu.silvaprotect-lawinen`

  return { egid, egrid, data }
}
