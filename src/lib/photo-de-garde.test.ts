import { describe, it, expect } from 'vitest'
import { photoDeGarde, referencePhoto } from './photo-de-garde'

const photo = (n: number) => `data:image/jpeg;base64,${'A'.repeat(200)}${String(n).repeat(80)}${'B'.repeat(200)}`
const items = [
  { id: 'r1', photos: [] },
  { id: 'r2', photos: [photo(1), photo(2)] },
  { id: 'r3', photos: [photo(3)] },
]

describe('photoDeGarde', () => {
  it('prend la première photo venue sans choix', () => {
    expect(photoDeGarde(items, null)).toBe(photo(1))
  })

  it('prend la photo choisie', () => {
    expect(photoDeGarde(items, referencePhoto('r3', photo(3)))).toBe(photo(3))
    expect(photoDeGarde(items, referencePhoto('r2', photo(2)))).toBe(photo(2))
  })

  it('reprend la règle d’avant si la photo choisie a disparu', () => {
    expect(photoDeGarde(items, referencePhoto('r3', photo(9)))).toBe(photo(1))
    expect(photoDeGarde(items, referencePhoto('r9', photo(3)))).toBe(photo(1))
  })

  it('ne trouve rien quand aucun élément n’a de photo', () => {
    expect(photoDeGarde([{ id: 'r1', photos: [] }], null)).toBeUndefined()
  })
})
