import { describe, it, expect } from 'vitest'
import { dureeVieDeReference, dureeVieResiduelle, phraseDureeVie, bonEtatSuspect } from './duree-vie'

const EN = { anneeCourante: 2026 }

describe('durée de vie de référence', () => {
  it('se lit sur la position CFC à 3 chiffres, pas sur le code complet', () => {
    expect(dureeVieDeReference('221.1')).toBe(30)
    expect(dureeVieDeReference('226.2')).toBe(35)
  })

  it('ne devine rien pour un ouvrage hors table', () => {
    expect(dureeVieDeReference('999.9')).toBeUndefined()
    expect(dureeVieDeReference(null)).toBeUndefined()
  })
})

describe('prestations de chantier', () => {
  it("ne donne pas de durée de vie à un échafaudage, malgré la maçonnerie de sa position", () => {
    expect(dureeVieDeReference('211')).toBe(80)     // la maçonnerie, elle, en a une
    expect(dureeVieDeReference('211.1')).toBeUndefined() // l'échafaudage, non
    expect(dureeVieDeReference('211.0')).toBeUndefined() // ni l'installation de chantier
  })

  it("n'en donne pas non plus au nettoyage, aux protections, aux démolitions et aux terrassements", () => {
    for (const code of ['287', '287.0', '121', '112.1', '101', '151.0']) {
      expect(dureeVieDeReference(code)).toBeUndefined()
    }
  })

  it('en donne en revanche aux canalisations enterrées, qui sont un ouvrage', () => {
    expect(dureeVieDeReference('152.0')).toBe(50)
  })

  it('ne calcule aucune durée résiduelle pour une prestation, même avec une année', () => {
    expect(dureeVieResiduelle({ cfcCode: '211.1', yearInstalled: 2020 }, EN)).toBeUndefined()
  })

  it('le rapport n’écrit donc rien pour un échafaudage', () => {
    const d = dureeVieResiduelle({ cfcCode: '211.1', yearInstalled: 2020 }, EN)
    expect(phraseDureeVie(d)).toBeNull()
  })
})

describe('durée de vie résiduelle', () => {
  it("compte les années restantes depuis l'année de pose", () => {
    const d = dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: 2010 }, EN)!
    expect(d.reference).toBe(30)      // fenêtres : 30 ans
    expect(d.residuelle).toBe(14)     // 2010 + 30 − 2026
    expect(d.depassement).toBe(0)
    expect(d.poseEstimee).toBe(false)
  })

  it('signale le dépassement au lieu de rendre une durée négative', () => {
    const d = dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: 1983 }, EN)!
    expect(d.residuelle).toBe(0)
    expect(d.depassement).toBe(13)    // 1983 + 30 = 2013, dépassé depuis 13 ans
    expect(d.usure).toBe(1)           // bornée, jamais au-delà de 100 %
  })

  it("ne reprend pas l'année de construction quand la pose n'est pas relevée", () => {
    // Des fenêtres PVC « posées en 1934 », « dépassées de 62 ans » : l'aberration du premier rapport.
    expect(dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: null }, { ...EN, yearBuilt: 1934 })).toBeUndefined()
  })

  it('soupçonne un bon état dont la durée de vie est dépassée de beaucoup', () => {
    const vieux = dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: 1960 }, EN)
    expect(bonEtatSuspect('BON', vieux)).toBe(true)
    expect(bonEtatSuspect('MAUVAIS', vieux)).toBe(false)
    const recent = dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: 2015 }, EN)
    expect(bonEtatSuspect('BON', recent)).toBe(false)
  })

  it('préfère toujours la pose relevée à l’année de construction', () => {
    const d = dureeVieResiduelle({ cfcCode: '226.2', yearInstalled: 2005 }, { ...EN, yearBuilt: 1934 })!
    expect(d.anneePose).toBe(2005)
    expect(d.poseEstimee).toBe(false)
  })

  it('ne calcule rien sans aucune année, plutôt que de supposer', () => {
    expect(dureeVieResiduelle({ cfcCode: '226.2', yearInstalled: null }, EN)).toBeUndefined()
  })

  it('ne calcule rien pour un ouvrage sans durée de référence', () => {
    expect(dureeVieResiduelle({ cfcCode: '999', yearInstalled: 2000 }, EN)).toBeUndefined()
  })

  it('calcule la part de durée de vie consommée', () => {
    const d = dureeVieResiduelle({ cfcCode: '242.0', yearInstalled: 2016 }, EN)!
    expect(d.reference).toBe(20)      // production de chaleur : 20 ans
    expect(d.usure).toBeCloseTo(0.5)  // 10 ans sur 20
  })
})

describe('phrase du rapport', () => {
  it('énonce pose, durée de référence et reste', () => {
    const d = dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: 2010 }, EN)
    expect(phraseDureeVie(d)).toBe('Posé en 2010 · durée de vie de référence 30 ans · durée de vie résiduelle 14 ans')
  })

  it('dit que l’année de pose n’est pas relevée, sans calculer de durée restante', () => {
    const d = dureeVieResiduelle({ cfcCode: '221.1', yearInstalled: null }, { ...EN, yearBuilt: 1983 })
    expect(phraseDureeVie(d, '221.1')).toBe('Année de pose non relevée · durée de vie de référence 30 ans')
  })

  it('ne dit rien quand il n’y a rien à dire', () => {
    expect(phraseDureeVie(undefined)).toBeNull()
  })
})
