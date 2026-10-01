import { describe, it, expect } from 'vitest'
import {
  airePolygone, longueurPolyligne, natureDe, mesureDe, natureDeLUnite,
  apportsDesPlans, reportPossible, type PlanMesurable,
} from './plan-quantites'
import type { PlanAnnotation } from './api-types'

const carre = (cote: number) => [
  { x: 0, y: 0 }, { x: cote, y: 0 }, { x: cote, y: cote }, { x: 0, y: cote },
]

const zone = (id: string, cote: number, itemId?: string, text?: string): PlanAnnotation =>
  ({ id, type: 'hatch', points: carre(cote), itemId, text })

const trait = (id: string, longueur: number, itemId?: string): PlanAnnotation =>
  ({ id, type: 'measure', points: [{ x: 0, y: 0 }, { x: longueur, y: 0 }], itemId })

describe('géométrie', () => {
  it('mesure un carré par sa formule du lacet', () => {
    expect(airePolygone(carre(10))).toBe(100)
  })

  it('tourne dans les deux sens sans changer de signe', () => {
    expect(airePolygone([...carre(10)].reverse())).toBe(100)
  })

  it('ne donne pas d’aire à moins de trois points', () => {
    expect(airePolygone([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe(0)
  })

  it('additionne les segments d’une polyligne', () => {
    expect(longueurPolyligne([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }])).toBe(11)
  })
})

describe('ce qu’une annotation sait mesurer', () => {
  it('une zone fermée donne une surface, un trait une longueur', () => {
    expect(natureDe(zone('a', 10))).toBe('surface')
    expect(natureDe(trait('b', 10))).toBe('longueur')
  })

  it('une note, une flèche ou un croquis ne mesurent rien', () => {
    for (const type of ['note', 'arrow', 'draw'] as const) {
      expect(natureDe({ type, points: carre(10) })).toBe('aucune')
    }
  })

  it('une zone à deux points n’est pas une zone', () => {
    expect(natureDe({ type: 'hatch', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })).toBe('aucune')
  })
})

describe('passage des pixels aux mètres', () => {
  it('divise la surface par le carré de l’échelle', () => {
    // 100 px par mètre : un carré de 500 px de côté fait 5 m de côté, donc 25 m².
    expect(mesureDe(zone('a', 500), 100)).toBe(25)
  })

  it('divise la longueur par l’échelle', () => {
    expect(mesureDe(trait('b', 450), 100)).toBe(4.5)
  })

  it('refuse de mesurer un plan non étalonné', () => {
    // Des pixels ne sont pas des mètres : mieux vaut rien que 250 000 « m² ».
    expect(mesureDe(zone('a', 500), null)).toBeNull()
    expect(mesureDe(zone('a', 500), 0)).toBeNull()
  })
})

describe('grandeur attendue par l’unité du catalogue', () => {
  it('reconnaît les surfaces, quelle que soit la précision écrite après', () => {
    for (const u of ['CHF/m²', 'CHF/m² SP', 'CHF/m² fenêtres', 'CHF/m2', 'Forfait / CHF/m² SP']) {
      expect(natureDeLUnite(u)).toBe('surface')
    }
  })

  it('reconnaît le mètre linéaire', () => {
    expect(natureDeLUnite('CHF/ml')).toBe('longueur')
  })

  it('ne chiffre ni la pièce, ni l’étage, ni le forfait', () => {
    for (const u of ['CHF/pce', 'CHF/U', 'CHF/étage', 'Forfait', null, '']) {
      expect(natureDeLUnite(u)).toBe('aucune')
    }
  })
})

describe('apports des plans par ouvrage', () => {
  const plans: PlanMesurable[] = [
    { id: 'p1', name: 'Façades', scalePxPerM: 100, annotations: [zone('z1', 500, 'i1', 'Nord'), zone('z2', 300, 'i1')] },
    { id: 'p2', name: 'Coupe', scalePxPerM: 100, annotations: [zone('z3', 200, 'i1'), trait('t1', 1000, 'i2')] },
  ]

  it('additionne ce qui est tracé sur plusieurs plans', () => {
    // 25 + 9 + 4 m²
    expect(apportsDesPlans(plans).get('i1')!.total).toBe(38)
  })

  it('garde la trace de chaque zone et de son plan', () => {
    const a = apportsDesPlans(plans).get('i1')!
    expect(a.zones.map((z) => z.planName)).toEqual(['Façades', 'Façades', 'Coupe'])
    expect(a.zones[0].label).toBe('Nord')
    expect(a.zones[1].label).toBeNull()
  })

  it('ignore les annotations non liées', () => {
    const sansLien: PlanMesurable[] = [{ id: 'p', name: 'p', scalePxPerM: 100, annotations: [zone('z', 500)] }]
    expect(apportsDesPlans(sansLien).size).toBe(0)
  })

  it('ne mélange pas des mètres carrés et des mètres sur un même ouvrage', () => {
    const melange: PlanMesurable[] = [{
      id: 'p', name: 'p', scalePxPerM: 100,
      annotations: [zone('z', 500, 'i1'), trait('t', 1000, 'i1')],
    }]
    const a = apportsDesPlans(melange).get('i1')!
    expect(a.nature).toBe('surface')
    expect(a.total).toBe(25)
    expect(a.zones).toHaveLength(1)
  })

  it('compte à part les zones d’un plan sans échelle', () => {
    const bancal: PlanMesurable[] = [
      { id: 'p1', name: 'étalonné', scalePxPerM: 100, annotations: [zone('z1', 500, 'i1')] },
      { id: 'p2', name: 'brut', scalePxPerM: null, annotations: [zone('z2', 500, 'i1')] },
    ]
    const a = apportsDesPlans(bancal).get('i1')!
    expect(a.total).toBe(25)
    expect(a.nonEtalonnees).toBe(1)
    expect(a.zones).toHaveLength(2)
  })
})

describe('report dans le diagnostic', () => {
  const apport = apportsDesPlans([
    { id: 'p', name: 'p', scalePxPerM: 100, annotations: [zone('z', 500, 'i1')] },
  ]).get('i1')

  it('reporte une surface sur un ouvrage facturé au mètre carré', () => {
    expect(reportPossible(apport, { unit: 'CHF/m²', area: null })).toEqual({ ok: true, quantite: 25 })
  })

  it('refuse un ouvrage au forfait ou à la pièce', () => {
    // Une surface posée sur un forfait produirait un montant faux sans prévenir.
    expect(reportPossible(apport, { unit: 'Forfait', area: null }))
      .toEqual({ ok: false, raison: 'unite-incompatible' })
    expect(reportPossible(apport, { unit: 'CHF/ml', area: null }))
      .toEqual({ ok: false, raison: 'unite-incompatible' })
  })

  it('ne propose rien quand la quantité est déjà celle du plan', () => {
    expect(reportPossible(apport, { unit: 'CHF/m²', area: 25 }))
      .toEqual({ ok: false, raison: 'deja-a-jour' })
  })

  it('refuse quand rien n’est lié, ou quand le plan n’est pas étalonné', () => {
    expect(reportPossible(undefined, { unit: 'CHF/m²', area: null }))
      .toEqual({ ok: false, raison: 'rien-a-reporter' })
    const brut = apportsDesPlans([
      { id: 'p', name: 'p', scalePxPerM: null, annotations: [zone('z', 500, 'i1')] },
    ]).get('i1')
    expect(reportPossible(brut, { unit: 'CHF/m²', area: null }))
      .toEqual({ ok: false, raison: 'non-etalonne' })
  })
})
