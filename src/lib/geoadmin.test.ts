import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchRegistryInfo } from './geoadmin'

// Réponses de geo.admin relevées le 2 novembre 2026 sur Champrilly, Lausanne.
const PARCELLE = 'CH567583458637'
const entree = (egid: string, deinr: string, gkode: number, gkodn: number, garea: number, ganzwhg: number, egrid = PARCELLE) => ({
  attributes: { egid, egrid, deinr, strname: ['Chemin de Champrilly'], gkode, gkodn, garea, gastw: 5, ganzwhg, gbauj: 1951, gklas: 1122 },
})
const C16 = entree('883991', '16', 2536286.811, 1153683.673, 239, 15)
const C18 = entree('883992', '18', 2536288.329, 1153665.75, 242, 15)
const C20 = entree('883993', '20', 2536285.301, 1153701.594, 243, 14)
// Les voisins de l'îlot, sur d'autres parcelles, et l'annexe 16.1.
const C12 = entree('883990', '12', 2536300, 1153600, 248, 15, 'CH488683457511')
const C22 = entree('883994', '22', 2536240.482, 1153646.536, 179, 15, 'CH558683754563')
const C16_1 = entree('280030185', '16.1', 2536290, 1153700, 34, 0)

const CONTOUR = {
  properties: { area: 722.19, perimeter: 140.98 },
  geometry: { type: 'MultiPolygon', coordinates: [[[[2536284.6, 1153714.8], [2536297.0, 1153715.2], [2536298.8, 1153657.2], [2536286.3, 1153656.8], [2536284.6, 1153714.8]]]] },
}

function geoAdmin({ contour = true } = {}) {
  return vi.fn(async (url: string) => {
    const u = new URL(url)
    const couche = u.searchParams.get('layers')
    const enveloppe = u.searchParams.get('geometryType') === 'esriGeometryEnvelope'
    let results: unknown[] = []
    if (couche?.includes('gebaeude_wohnungs_register')) results = enveloppe ? [C12, C20, C18, C22, C16, C16_1] : [C16]
    else if (couche?.includes('vec25-gebaeude')) results = contour ? [CONTOUR] : []
    return { json: async () => ({ results }) } as Response
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('fetchRegistryInfo', () => {
  it("cumule les trois entrées de Champrilly 16-18-20, et garde le périmètre du bloc", async () => {
    vi.stubGlobal('fetch', geoAdmin())
    const info = await fetchRegistryInfo(2536291, 1153685.6)

    expect(info.entrees?.map(e => e.adresse)).toEqual([
      'Chemin de Champrilly 16', 'Chemin de Champrilly 18', 'Chemin de Champrilly 20',
    ])
    expect(info.egid).toBe('883991')
    expect(info.builtArea).toBe(724)
    expect(info.floorArea).toBe(3620)
    expect(info.nbApartments).toBe(44)
    expect(info.nbStaircases).toBe(3)
    expect(info.nbFloors).toBe(5)
    // 722 m² de contour pour 724 m² d'emprise : le contour est bien celui du bloc.
    expect(info.perimeter).toBe(141)
    expect(info.perimeterEstimated).toBeUndefined()
  })

  it("sans contour, décrit l'entrée seule", async () => {
    vi.stubGlobal('fetch', geoAdmin({ contour: false }))
    const info = await fetchRegistryInfo(2536291, 1153685.6)

    expect(info.entrees).toBeUndefined()
    expect(info.builtArea).toBe(239)
    expect(info.nbApartments).toBe(15)
    expect(info.nbStaircases).toBeUndefined()
  })
})
