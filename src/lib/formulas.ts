import type { RoofType } from './api-types'

/**
 * Géométrie du bâtiment : une seule source pour tout ce qui se déduit des saisies
 * du dossier (façade, fenêtres, toiture, échafaudage, communs, portes, pièces d'eau).
 * Les écrans Résumé, Éditeur, Rapports et le wizard consomment tous ces valeurs :
 * elles ne doivent être calculées qu'ici.
 */

/** Coefficients de surface de toiture selon la pente. Doivent rester en phase avec le serveur. */
export const ROOF_COEFF = { PLATE: 1, PENTE: 1.35, MIXTE: 1.175 } as const

/**
 * Surface de toiture selon le type. null si le type n'est pas précisé (on ne présume
 * pas une pente) ou si la surface bâtie est inconnue.
 */
export function roofSurface(roofType: RoofType | null | undefined, builtArea: number | null | undefined): number | null {
  if (!builtArea || builtArea <= 0) return null
  const coeff = roofType ? ROOF_COEFF[roofType] : undefined
  return coeff ? Math.round(builtArea * coeff) : null
}

export interface ProjectGeometry {
  perimeter?: number | null
  nbFloors?: number | null
  floorHeight?: number | null
  builtArea?: number | null
  floorArea?: number | null
  terrainArea?: number | null
  /** Surface de façade relevée. Utilisée seulement si le périmètre ne permet pas de la déduire. */
  facadeArea?: number | null
  windowPct?: number | null
  roofType?: RoofType | null
  nbApartments?: number | null
  nbStaircases?: number | null
  /** Répartition des logements par typologie : { "3.5": 5, "4.5": 2 }. */
  apartmentTypes?: Record<string, number> | null
}

const n = (v: number | null | undefined, d = 0) => (typeof v === 'number' && isFinite(v) && v > 0 ? v : d)

/**
 * Surface de façade = périmètre × étages × hauteur d'étage.
 *
 * La valeur relevée (`facadeArea`) ne sert que de repli : elle était autrefois écrite
 * automatiquement à la création du dossier, si bien qu'une correction du périmètre ne
 * changeait plus rien. Le calcul prime donc dès que ses trois entrées sont connues.
 */
export function facadeSurface(g: ProjectGeometry): number {
  const perimeter = n(g.perimeter)
  const nbFloors = n(g.nbFloors)
  const floorHeight = n(g.floorHeight, 2.7)
  if (perimeter > 0 && nbFloors > 0) return perimeter * nbFloors * floorHeight
  return n(g.facadeArea)
}

export interface ProjectMetrics {
  /** Surface de façade, fenêtres comprises. */
  facade: number
  /** Surface vitrée = façade × part vitrée. */
  windows: number
  /** Façade hors vitrage : c'est elle qu'on isole, ravale ou crépit. */
  opaqueFacade: number
  flatRoof: number
  slopedRoof: number
  /** Surface de toiture retenue, null tant que le type de toiture n'est pas précisé. */
  roof: number | null
  /** Échafaudage : la façade est déjà vitrage compris, on ne le recompte pas. */
  scaffolding: number
  commons: number
  tilesBathrooms: number
  tilesKitchens: number
  /** Portes palières : celle de chaque logement, sur le palier. */
  landingDoors: number
  /** Portes intérieures aux logements (hors porte palière). */
  interiorDoors: number
  staircases: number
  /** Pièces d'eau : une salle de bain + une cuisine par logement. */
  wetRooms: number
}

/** Débord et retours d'échafaudage autour de la façade (échafaudage > façade). */
const SCAFFOLDING_COEFF = 1.1

export function computeProjectMetrics(g: ProjectGeometry): ProjectMetrics {
  const facade = facadeSurface(g)
  const windowPct = g.windowPct == null ? 0.3 : g.windowPct > 1 ? g.windowPct / 100 : g.windowPct
  const windows = facade * windowPct
  const builtArea = n(g.builtArea)
  const floorArea = n(g.floorArea)
  const nbApartments = n(g.nbApartments)
  return {
    facade,
    windows,
    opaqueFacade: Math.max(facade - windows, 0),
    flatRoof: builtArea * ROOF_COEFF.PLATE,
    slopedRoof: builtArea * ROOF_COEFF.PENTE,
    roof: roofSurface(g.roofType, g.builtArea),
    scaffolding: facade * SCAFFOLDING_COEFF,
    commons: floorArea * 0.1,
    tilesBathrooms: nbApartments * 7,
    tilesKitchens: nbApartments * 12,
    landingDoors: nbApartments,
    interiorDoors: nbApartments * 4,
    staircases: n(g.nbStaircases),
    wetRooms: nbApartments * 2,
  }
}

/**
 * Contrôle de vraisemblance du périmètre au regard de l'emprise au sol.
 *
 * Le rapport périmètre / racine de la surface vaut 4 pour un carré, environ 4,5 pour un
 * rectangle deux fois plus long que large. Bien au-delà, le contour ne peut pas être
 * celui d'un seul bâtiment : c'est en général un îlot entier ou une somme de parcelles.
 * Renvoie null quand tout est cohérent, sinon le message à afficher sous le champ.
 */
export function perimeterWarning(
  perimeter: number | null | undefined,
  builtArea: number | null | undefined,
): string | null {
  if (!perimeter || !builtArea || perimeter <= 0 || builtArea <= 0) return null
  const minimum = 2 * Math.sqrt(Math.PI * builtArea) // périmètre du cercle de même surface
  if (perimeter < minimum * 0.98) {
    return `Périmètre trop court pour une emprise de ${Math.round(builtArea)} m² (minimum théorique ${Math.round(minimum)} ml).`
  }
  const compactness = perimeter / Math.sqrt(builtArea)
  if (compactness > 8) {
    const estimation = Math.round(4.3 * Math.sqrt(builtArea))
    return `Périmètre inhabituel pour une emprise de ${Math.round(builtArea)} m² : environ ${estimation} ml attendus. La donnée du registre couvre peut-être plusieurs bâtiments contigus.`
  }
  return null
}

/** Même contrôle sur le nombre d'étages, au regard des surfaces de plancher et d'emprise. */
export function floorsWarning(
  nbFloors: number | null | undefined,
  floorArea: number | null | undefined,
  builtArea: number | null | undefined,
): string | null {
  if (!nbFloors || !floorArea || !builtArea || builtArea <= 0) return null
  const deduits = floorArea / builtArea
  if (deduits >= nbFloors * 1.8) {
    return `La surface de plancher suggère plutôt ${Math.round(deduits)} niveaux.`
  }
  return null
}
