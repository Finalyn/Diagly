import { describe, it, expect } from 'vitest'
import { projeterElan, elastique, suiviVitesse } from './motion'

describe('projection de l\'élan', () => {
  it('suit la formule de décélération exponentielle', () => {
    // 1000 px/s avec le taux normal : (1000/1000) × 0.998 / 0.002 = 499 px de plus.
    expect(Math.round(projeterElan(1000))).toBe(499)
  })
  it('projette dans le sens du geste', () => {
    expect(projeterElan(-800)).toBeLessThan(0)
  })
  it('ne projette rien quand le doigt était immobile', () => {
    expect(projeterElan(0)).toBe(0)
  })
  it('un taux plus sec projette moins loin', () => {
    expect(projeterElan(1000, 0.99)).toBeLessThan(projeterElan(1000, 0.998))
  })
})

describe('résistance aux bords', () => {
  it('rend moins que le dépassement demandé', () => {
    expect(elastique(100, 800)).toBeLessThan(100)
  })
  it('résiste de plus en plus : le rapport suivi/tiré décroît', () => {
    const proche = elastique(50, 800) / 50
    const loin = elastique(400, 800) / 400
    expect(loin).toBeLessThan(proche)
  })
  it('ne bouge pas à la limite exacte', () => {
    expect(elastique(0, 800)).toBe(0)
  })
  it('reste symétrique dans les deux sens', () => {
    expect(elastique(-120, 800)).toBeCloseTo(-elastique(120, 800), 6)
  })
})

describe('suivi de vitesse', () => {
  it('mesure une vitesse en unités par seconde', () => {
    const s = suiviVitesse()
    s.ajouter(0, 0)
    s.ajouter(50, 100) // 50 unités en 0,1 s
    expect(s.vitesse()).toBeCloseTo(500, 5)
  })
  it('rend zéro tant qu\'il n\'y a qu\'un point', () => {
    const s = suiviVitesse()
    s.ajouter(10, 0)
    expect(s.vitesse()).toBe(0)
  })
  it('oublie ce qui sort de la fenêtre : un doigt arrêté a une vitesse nulle', () => {
    const s = suiviVitesse(100)
    s.ajouter(0, 0)
    s.ajouter(300, 50)   // geste rapide
    s.ajouter(300, 400)  // puis le doigt s'immobilise 350 ms
    s.ajouter(300, 450)
    expect(Math.abs(s.vitesse())).toBeLessThan(1)
  })
})
