import { describe, it, expect } from 'vitest'
import { partRemplie, circonference, decalageAnneau } from './anneau'

const R = 15.5
const C = 2 * Math.PI * R

describe('part remplie', () => {
  it('suit la proportion', () => {
    expect(partRemplie(0, 4)).toBe(0)
    expect(partRemplie(1, 4)).toBe(0.25)
    expect(partRemplie(2, 4)).toBe(0.5)
    expect(partRemplie(4, 4)).toBe(1)
  })

  it('ne depasse jamais le tour complet', () => {
    // Un relevé de plus que le catalogue ne doit pas repartir pour un second tour.
    expect(partRemplie(7, 4)).toBe(1)
  })

  it('ne remplit rien sur un total nul ou absurde', () => {
    // Une étape vide : l'anneau reste vide plutôt que de diviser par zéro.
    expect(partRemplie(0, 0)).toBe(0)
    expect(partRemplie(3, 0)).toBe(0)
    expect(partRemplie(3, -2)).toBe(0)
    expect(partRemplie(-1, 4)).toBe(0)
    expect(partRemplie(NaN, 4)).toBe(0)
  })
})

describe('decalage du trait', () => {
  it('vaut la circonference entiere a vide, et zero a plein', () => {
    expect(decalageAnneau(0, 4, R)).toBeCloseTo(C, 6)
    expect(decalageAnneau(4, 4, R)).toBeCloseTo(0, 6)
  })

  it('laisse voir exactement la part remplie', () => {
    // A un quart, il reste trois quarts de trait repousses.
    expect(decalageAnneau(1, 4, R)).toBeCloseTo(C * 0.75, 6)
    expect(decalageAnneau(3, 4, R)).toBeCloseTo(C * 0.25, 6)
  })

  it('reste coherent avec la circonference du rayon donne', () => {
    expect(circonference(10)).toBeCloseTo(62.831853, 5)
    expect(decalageAnneau(1, 2, 10)).toBeCloseTo(circonference(10) / 2, 6)
  })
})
