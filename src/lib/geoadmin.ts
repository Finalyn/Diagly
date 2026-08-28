// Récupération automatique d'infos bâtiment/parcelle depuis les services
// fédéraux geo.admin.ch (gratuits, sans clé), à partir des coordonnées LV95.
//
//  - RegBL / GWR (ch.bfs.gebaeude_wohnungs_register) : année de construction,
//    surface au sol, nb d'étages et de logements (ces deux derniers souvent
//    absents du registre).
//  - Cadastre (ch.kantone.cadastralwebmap-farbe) : n° de parcelle, EGRID, et
//    surface de la parcelle (calculée depuis la géométrie).

import type { GeoData } from './api-types'

const IDENTIFY = 'https://api3.geo.admin.ch/rest/services/all/MapServer/identify'
const SEARCH = 'https://api3.geo.admin.ch/rest/services/api/SearchServer'

export interface RegistryInfo {
  yearBuilt?: number
  builtArea?: number          // m² — surface au sol (emprise) du bâtiment
  perimeter?: number          // ml — périmètre du contour du bâtiment
  perimeterEstimated?: boolean // true si déduit de l'emprise faute d'un contour fiable
  floorArea?: number          // m² — surface de plancher (somme logements, EBF ou estimée)
  floorAreaEstimated?: boolean // true si calculée (emprise × étages), false si donnée réelle
  nbFloors?: number
  nbApartments?: number
  buildingType?: string       // type déduit de la classe GWR (LOGEMENT, VILLA, BUREAU…)
  parcelNumber?: string
  egrid?: string
  terrainArea?: number        // m² — surface de la parcelle
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

/**
 * Récupère les infos bâtiment + parcelle pour un point (coordonnées LV95 / EPSG:2056).
 * Tolérant aux pannes : chaque source est interrogée indépendamment, et on
 * renvoie tout ce qui a pu être trouvé (objet vide si rien).
 */
export async function fetchRegistryInfo(east: number, north: number): Promise<RegistryInfo> {
  const info: RegistryInfo = {}

  // --- RegBL / GWR : bâtiment ---
  try {
    const res = await fetch(identifyUrl('ch.bfs.gebaeude_wohnungs_register', east, north, { tolerance: 10 }))
    const data = await res.json()
    const results: { attributes?: Record<string, unknown> }[] = data.results ?? []
    // On retient le bâtiment dont le centre est le plus proche du point cliqué
    // (et non la plus grosse annexe voisine).
    let best: Record<string, unknown> | undefined
    let bestDist = Infinity
    for (const r of results) {
      const a = r.attributes ?? {}
      const gx = Number(a.gkode), gy = Number(a.gkodn)
      const dist = Number.isFinite(gx) && Number.isFinite(gy)
        ? (gx - east) ** 2 + (gy - north) ** 2
        : Infinity
      if (dist < bestDist) { bestDist = dist; best = a }
    }
    const a = best ?? results[0]?.attributes
    if (a) {
      info.yearBuilt = num(a.gbauj)
      info.builtArea = num(a.garea)       // surface au sol officielle
      info.nbFloors = num(a.gastw)

      // Type de bâtiment depuis la classe GWR.
      const gklas = num(a.gklas)
      info.buildingType = mapBuildingType(gklas)

      // Nombre de logements adapté au type :
      //  - villa → 1 logement par définition
      //  - non résidentiel (bureau, industriel, scolaire…) → 0
      //  - immeuble d'habitation → valeur du registre (ganzwhg), repli 2 si classe « 2 logements »
      const residential = info.buildingType === 'LOGEMENT' || info.buildingType === 'VILLA'
      if (info.buildingType === 'VILLA') {
        info.nbApartments = 1
      } else if (residential) {
        info.nbApartments = num(a.ganzwhg) ?? (gklas === 1121 ? 2 : undefined)
      } else if (info.buildingType) {
        info.nbApartments = 0
      } else {
        info.nbApartments = num(a.ganzwhg)
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
      if (info.builtArea && info.nbFloors) {
        info.floorArea = Math.round(info.builtArea * info.nbFloors)
        info.floorAreaEstimated = true
      } else if (wareaSum > 0) {
        info.floorArea = Math.round(wareaSum)
        info.floorAreaEstimated = false
      } else if (gebf) {
        info.floorArea = gebf
        info.floorAreaEstimated = false
      }
    }
  } catch { /* réseau / CORS : on ignore */ }

  // --- Empreinte bâtiment (VECTOR25) : périmètre + surface au sol du contour ---
  //
  // Attention : VECTOR25 est au 1:25'000, où les bâtiments contigus sont fusionnés en
  // un seul îlot. Reprendre son périmètre tel quel donnait des façades démesurées en
  // centre-ville (relevé : contour de 2017 m² et 346 ml pour un bâtiment de 708 m²).
  // On ne retient donc le périmètre que si le contour correspond bien AU bâtiment,
  // c'est-à-dire si sa surface est proche de l'emprise officielle du RegBL.
  try {
    const res = await fetch(identifyUrl('ch.swisstopo.vec25-gebaeude', east, north, { tolerance: 1 }))
    const data = await res.json()
    const a = (data.results ?? [])[0]?.attributes
    if (a) {
      const per = num(a.perimeter)
      const contourArea = num(a.area)
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
  } catch { /* réseau / CORS : on ignore */ }

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
