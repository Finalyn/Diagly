import { describe, it, expect } from 'vitest'
import { COMBLES, libelleEtages, lireEtages, nomDuNiveau } from './etages'
import { rangDuNiveau } from './presentation'

describe('les étages d’une feuille', () => {
  it('nomme chaque niveau', () => {
    expect([-2, -1, 0, 1, 2, COMBLES].map(nomDuNiveau)).toEqual(['2ème sous-sol', 'Sous-sol', 'Rez', '1er', '2ème', 'Combles'])
  })

  it('écrit l’étage type de Champrilly en plage', () => {
    expect(libelleEtages([4, 2, 1, 3])).toBe('1er au 4ème')
    expect(libelleEtages([0])).toBe('Rez')
    expect(libelleEtages([0, 1])).toBe('Rez et 1er')
    expect(libelleEtages([1, 3])).toBe('1er et 3ème')
    expect(libelleEtages([-1, 0, COMBLES])).toBe('Sous-sol, Rez et Combles')
    expect(libelleEtages([1, 2, 3, 5])).toBe('1er au 3ème et 5ème')
    expect(libelleEtages([])).toBe('')
  })

  it('relit ses propres libellés', () => {
    for (const choix of [[1, 2, 3, 4], [0], [0, 1], [1, 3], [-1, 0, COMBLES], [-2, -1], [1, 2, 3, 5]]) {
      expect(lireEtages(libelleEtages(choix))).toEqual(choix)
    }
  })

  it('lit les libellés usuels des cartouches', () => {
    expect(lireEtages('1er-4e')).toEqual([1, 2, 3, 4])
    expect(lireEtages('1er à 3ème')).toEqual([1, 2, 3])
    expect(lireEtages('2e, 3e, 4e')).toEqual([2, 3, 4])
    expect(lireEtages('Rez-de-chaussée')).toEqual([0])
    expect(lireEtages('Sous-sol')).toEqual([-1])
    expect(lireEtages('1er au 4e')).toEqual([1, 2, 3, 4])
    expect(lireEtages('2ème sous-sol et Sous-sol')).toEqual([-2, -1])
  })

  it('ne coche rien sur un libellé qu’il ne sait pas lire en entier', () => {
    expect(lireEtages('Étage type')).toBeNull()
    expect(lireEtages('Façade est')).toBeNull()
    expect(lireEtages('Rez et façade')).toBeNull()
    expect(lireEtages('')).toBeNull()
    expect(lireEtages(null)).toBeNull()
  })

  it('range la feuille à son premier étage dans les tableaux', () => {
    expect(rangDuNiveau(libelleEtages([1, 2, 3, 4]))).toBe(1)
    expect(rangDuNiveau(libelleEtages([0, 1]))).toBe(0)
    expect(rangDuNiveau(libelleEtages([-1, 0]))).toBe(-1)
  })
})
