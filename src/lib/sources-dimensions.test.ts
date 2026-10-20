import { describe, it, expect } from 'vitest'
import { miseAJourDepuisPlans, sourcesApresSaisie } from './sources-dimensions'
import type { ApiProject } from './api-types'

const projet = (o: Partial<ApiProject> = {}) => ({
  sources: null, floorArea: 700, builtArea: 200, facadeArea: null, windowPct: 30, roofArea: null, nbFloors: 4,
  perimeter: 60, floorHeight: 2.7, roofType: null, ...o,
}) as ApiProject

describe('les métrés des plans remplacent la fiche', () => {
  it('reporte une mesure plausible, avec la mention de sa source', () => {
    const m = miseAJourDepuisPlans(projet(), { floorArea: 762, builtArea: 220 }, 't')!
    expect(m.patch).toEqual({ floorArea: 762, builtArea: 220 })
    expect(m.sources.floorArea).toEqual({ source: 'plans', valeur: 762, majLe: 't' })
  })

  it('écarte une façade faite d’une seule élévation, et sa part vitrée', () => {
    // 60 ml × 4 étages × 2,7 m = 648 m² ; les plans n'en tracent que 97.
    const m = miseAJourDepuisPlans(projet(), { facadeArea: 97, windowPct: 26.6 }, 't')!
    expect(m.patch).toEqual({})
    expect(m.ecartees).toEqual([{ champ: 'facadeArea', plans: 97, fiche: 648 }])
  })

  it('garde une correction à la main tant que les plans ne changent pas', () => {
    const corrige = projet({ floorArea: 800, sources: sourcesApresSaisie(projet({ sources: { floorArea: { source: 'plans', valeur: 762 } } }), ['floorArea']) })
    expect(miseAJourDepuisPlans(corrige, { floorArea: 762 }, 't')).toBeNull()
    expect(miseAJourDepuisPlans(corrige, { floorArea: 790 }, 't')!.patch).toEqual({ floorArea: 790 })
  })
})
