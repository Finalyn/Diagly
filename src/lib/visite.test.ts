import { describe, it, expect } from 'vitest'
import {
  places, coteChoisi, placerBulle, trouDuProjecteur, pointeDeLaBulle, direction, MARGE,
  type Rect,
} from './visite'

const FENETRE = { w: 1400, h: 900 }
const BULLE = { w: 360, h: 220 }
/** Une cible au milieu de l'écran : de la place partout. */
const MILIEU: Rect = { x: 600, y: 400, w: 200, h: 100 }

describe('places', () => {
  it('mesure ce qui reste de chaque côté', () => {
    expect(places(MILIEU, FENETRE)).toEqual({ haut: 400, bas: 400, gauche: 600, droite: 600 })
  })
})

describe('coteChoisi', () => {
  it('respecte le côté demandé quand il tient', () => {
    expect(coteChoisi(MILIEU, BULLE, FENETRE, 'haut')).toBe('haut')
    expect(coteChoisi(MILIEU, BULLE, FENETRE, 'gauche')).toBe('gauche')
  })

  it('bascule de l’autre côté quand le côté demandé ne tient pas', () => {
    const colleADroite: Rect = { x: 1200, y: 400, w: 180, h: 60 }
    expect(coteChoisi(colleADroite, BULLE, FENETRE, 'droite')).not.toBe('droite')
  })

  it('préfère la droite à place égale : on lit de gauche à droite', () => {
    expect(coteChoisi(MILIEU, BULLE, FENETRE)).toBe('droite')
  })

  it('prend le côté le plus large quand aucun ne tient vraiment', () => {
    const enorme: Rect = { x: 20, y: 20, w: 1340, h: 840 }
    expect(['haut', 'bas', 'gauche', 'droite']).toContain(coteChoisi(enorme, BULLE, FENETRE))
  })
})

describe('placerBulle', () => {
  it('centre la bulle quand il n’y a rien à montrer', () => {
    const p = placerBulle(null, BULLE, FENETRE)
    expect(p).toEqual({ x: 520, y: 340, cote: null })
  })

  it('pose la bulle à côté de la cible, centrée sur elle', () => {
    const p = placerBulle(MILIEU, BULLE, FENETRE, 'droite')
    expect(p.cote).toBe('droite')
    expect(p.x).toBe(MILIEU.x + MILIEU.w + MARGE)
    // Centre de la cible (450) moins la moitié de la bulle (110).
    expect(p.y).toBe(340)
  })

  it('ne laisse jamais la bulle sortir de la fenêtre', () => {
    const coins: Rect[] = [
      { x: 0, y: 0, w: 60, h: 60 },
      { x: 1340, y: 0, w: 60, h: 60 },
      { x: 0, y: 840, w: 60, h: 60 },
      { x: 1340, y: 840, w: 60, h: 60 },
    ]
    for (const c of coins) {
      const p = placerBulle(c, BULLE, FENETRE)
      expect(p.x, JSON.stringify(c)).toBeGreaterThanOrEqual(MARGE)
      expect(p.y, JSON.stringify(c)).toBeGreaterThanOrEqual(MARGE)
      expect(p.x + BULLE.w).toBeLessThanOrEqual(FENETRE.w - MARGE)
      expect(p.y + BULLE.h).toBeLessThanOrEqual(FENETRE.h - MARGE)
    }
  })

  it('tient dans une fenêtre plus petite que la bulle, sans position négative', () => {
    const p = placerBulle(MILIEU, { w: 1600, h: 1000 }, FENETRE)
    expect(p.x).toBe(MARGE)
    expect(p.y).toBe(MARGE)
  })

  it('ne recouvre pas la cible quand la bulle se pose au-dessus', () => {
    const basDeLEcran: Rect = { x: 600, y: 760, w: 200, h: 80 }
    const p = placerBulle(basDeLEcran, BULLE, FENETRE)
    expect(p.cote).not.toBe('bas')
    if (p.cote === 'haut') expect(p.y + BULLE.h).toBeLessThanOrEqual(basDeLEcran.y)
  })
})

describe('trouDuProjecteur', () => {
  it('élargit la cible', () => {
    expect(trouDuProjecteur({ x: 100, y: 100, w: 50, h: 40 }, 10)).toEqual({ x: 90, y: 90, w: 70, h: 60 })
  })

  it('ne déborde pas de la fenêtre', () => {
    const t = trouDuProjecteur({ x: 0, y: 0, w: 50, h: 40 }, 10, FENETRE)
    expect(t).toEqual({ x: 0, y: 0, w: 60, h: 50 })
  })
})

describe('pointeDeLaBulle', () => {
  const bulle = { x: 816, y: 340, w: 360, h: 220 }

  it('vise le centre de la cible', () => {
    const p = pointeDeLaBulle(MILIEU, bulle, 'droite')
    expect(p.x).toBe(0)
    expect(p.y).toBe(110)
  })

  it('reste sur le bord droit, hors des angles', () => {
    const haut: Rect = { x: 600, y: 0, w: 200, h: 20 }
    const p = pointeDeLaBulle(haut, bulle, 'droite', 18)
    expect(p.y).toBeGreaterThanOrEqual(18)
    expect(p.y).toBeLessThanOrEqual(bulle.h - 18)
  })
})

describe('direction', () => {
  it('pointe vers la cible, pas vers la bulle', () => {
    expect(direction('droite')).toBe('gauche')
    expect(direction('haut')).toBe('bas')
    expect(direction(null)).toBeNull()
  })
})
