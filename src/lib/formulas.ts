import type { RoofType } from './api-types'

/**
 * Surface de toiture selon le type. null si type non précisé (on ne présume pas)
 * ou si la surface bâtie est inconnue.
 *  - plate : surface bâtie
 *  - en pente : surface bâtie × 1.35
 *  - mixte : moyenne des deux
 */
export function roofSurface(roofType: RoofType | null | undefined, builtArea: number | null | undefined): number | null {
  if (!builtArea || builtArea <= 0) return null
  switch (roofType) {
    case 'PLATE': return Math.round(builtArea)
    case 'PENTE': return Math.round(builtArea * 1.35)
    case 'MIXTE': return Math.round(builtArea * 1.175)
    default: return null
  }
}

export function computeProjectMetrics(input: {
  perimeter: number
  nbFloors: number
  floorHeight: number
  builtArea: number
  floorArea: number
  facadeArea?: number
  windowPct?: number
  nbApartments: number
}) {
  const windowPct = input.windowPct ?? 0.30
  const facade = input.facadeArea ?? (input.perimeter * input.nbFloors * input.floorHeight)
  const windows = facade * windowPct
  return {
    facade,
    windows,
    flatRoof: input.builtArea,
    slopedRoof: input.builtArea * 1.35,
    scaffolding: (facade + windows) * 1.35,
    commons: input.floorArea * 0.10,
    tilesBathrooms: input.nbApartments * 7,
    tilesKitchens: input.nbApartments * 12,
    entranceDoors: input.nbApartments,
    interiorDoors: input.nbApartments * 4,
  }
}
