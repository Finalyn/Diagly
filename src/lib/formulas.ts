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
