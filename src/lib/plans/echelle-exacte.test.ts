import { describe, it, expect } from 'vitest'
import {
  ECART_TOLERE, denominateurDe, ecartRelatif, metresParPixel, proposerEchelle, pxParMetreDeCote, pxParMetreImprime,
} from './echelle-exacte'
import { A3_PAYSAGE, FACADE_SUD, PLAN_REZ, versCanevas } from './plans-de-test'

describe('l’échelle exacte d’une page PDF', () => {
  it('se déduit de la taille de la feuille et du dénominateur', () => {
    // Une feuille A3 de 420 mm, rendue sur 1600 px, au 1:100 : 42 m sur 1600 px.
    expect(metresParPixel(A3_PAYSAGE.largeur, 1600, 100)).toBeCloseTo(42 / 1600, 12)
    expect(pxParMetreImprime(A3_PAYSAGE.largeur, 1600, 100)).toBeCloseTo(1600 / 42, 9)
    // Au 1:50, deux fois plus de pixels par mètre.
    expect(pxParMetreImprime(A3_PAYSAGE.largeur, 1600, 50)).toBeCloseTo(1600 / 21, 9)
    // Une feuille A4 portrait (210 mm) au 1:100 : 21 m sur 1600 px.
    expect(pxParMetreImprime(595.2756, 1600, 100)).toBeCloseTo(1600 / 21, 3)
  })

  it('reconnaît les écritures courantes de l’échelle', () => {
    expect(denominateurDe('1:100')).toBe(100)
    expect(denominateurDe('Échelle 1 : 50')).toBe(50)
    expect(denominateurDe('1/200')).toBe(200)
    expect(denominateurDe("1:1'000")).toBe(1000)
    expect(denominateurDe('100')).toBeNull()
    expect(denominateurDe(null)).toBeNull()
  })

  it('mesure une cote sur le canevas', () => {
    expect(pxParMetreDeCote({ x: 0, y: 0 }, { x: 300, y: 400 }, 10)).toBe(50)
    expect(pxParMetreDeCote({ x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toBeNull()
    expect(pxParMetreDeCote({ x: 0, y: 0 }, { x: 10, y: 0 }, 0)).toBeNull()
  })
})

describe('la proposition d’échelle', () => {
  // La cote totale de la façade de test, aux croisements de sa ligne de cote.
  const coteFacade = {
    texte: '12.40', longueurM: 12.4,
    p1: versCanevas(FACADE_SUD, 0, -1.6), p2: versCanevas(FACADE_SUD, 12.4, -1.6),
  }

  it('retient l’échelle imprimée quand la cote la confirme', () => {
    const p = proposerEchelle({
      largeurPagePt: FACADE_SUD.largeurPt, largeurCanevasPx: 1600,
      echelleImprimee: '1:100', ouEchelle: 'cartouche', cote: coteFacade,
    })
    expect(p.statut).toBe('verifiee')
    expect(p.exacte).toBe(true)
    expect(p.pxParM).toBeCloseTo(1600 / 42, 9)
    expect(p.ecart).toBeLessThan(1e-6)
    expect(p.resume).toBe('1:100 au cartouche, vérifiée sur la cote 12,40 m (écart 0,0 %)')
  })

  it('n’applique rien d’office quand l’échelle imprimée et la cote divergent de plus de 2 %', () => {
    // Le même dessin imprimé « ajusté à la page » : le cartouche dit 1:100,
    // le dessin est au 1:125, et la cote le trahit.
    const reduit = { ...coteFacade, p2: { x: coteFacade.p1.x + (coteFacade.p2.x - coteFacade.p1.x) * 0.8, y: coteFacade.p2.y } }
    const p = proposerEchelle({
      largeurPagePt: FACADE_SUD.largeurPt, largeurCanevasPx: 1600,
      echelleImprimee: '1:100', ouEchelle: 'cartouche', cote: reduit,
    })
    expect(p.statut).toBe('conflit')
    expect(p.pxParM).toBeNull()
    expect(p.ecart).toBeCloseTo(0.2, 6)
    expect(p.imprimee?.pxParM).toBeCloseTo(1600 / 42, 9)
    expect(p.cote?.pxParM).toBeCloseTo((1600 / 42) * 0.8, 6)
    expect(p.resume).toContain('ne concordent pas (écart 20,0 %)')
  })

  it('tient la limite de 2 % : en deçà vérifiée, au-delà en conflit', () => {
    const avec = (facteur: number) => proposerEchelle({
      largeurPagePt: FACADE_SUD.largeurPt, largeurCanevasPx: 1600, echelleImprimee: '1:100',
      cote: { ...coteFacade, p2: { x: coteFacade.p1.x + (coteFacade.p2.x - coteFacade.p1.x) * facteur, y: coteFacade.p2.y } },
    })
    expect(avec(1 + ECART_TOLERE * 0.95).statut).toBe('verifiee')
    expect(avec(1 - ECART_TOLERE * 1.05).statut).toBe('conflit')
    expect(ecartRelatif(102, 100)).toBeCloseTo(0.02, 12)
  })

  it('retient l’échelle imprimée sans cote, en le disant', () => {
    const p = proposerEchelle({ largeurPagePt: PLAN_REZ.largeurPt, largeurCanevasPx: 1600, echelleImprimee: '1:50', cote: null })
    expect(p.statut).toBe('non-verifiee')
    expect(p.pxParM).toBeCloseTo(1600 / 21, 9)
    expect(p.resume).toBe('1:50, sans cote lisible pour la vérifier')
  })

  it('ne tire d’une image qu’une échelle approximative, depuis la cote', () => {
    const p = proposerEchelle({
      largeurPagePt: null, largeurCanevasPx: 1600, echelleImprimee: '1:100', ouEchelle: 'cartouche',
      cote: { texte: '12.40', longueurM: 12.4, p1: { x: 100, y: 500 }, p2: { x: 596, y: 500 } },
    })
    expect(p.statut).toBe('approximative')
    expect(p.exacte).toBe(false)
    expect(p.pxParM).toBeCloseTo(40, 9)
    expect(p.imprimee).toBeNull()
    expect(p.resume).toContain('inutilisable sur une image')
  })

  it('ne propose rien quand rien ne permet d’étalonner', () => {
    const p = proposerEchelle({ largeurPagePt: null, largeurCanevasPx: 1600, echelleImprimee: null, cote: null })
    expect(p.statut).toBe('aucune')
    expect(p.pxParM).toBeNull()
  })
})
