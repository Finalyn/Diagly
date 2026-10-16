import { describe, it, expect } from 'vitest'
import { createItemSchema, updateItemSchema, modificationDuRenvoi } from './releves.js'

const ID = '0b6f6a3e-2f4b-4c1e-9a57-3f1d2c4b5a6e'
const base = { cfcCode: '211', cfcLabel: 'Maçonnerie' }

describe('la quantité d’un relevé', () => {
  it('accepte zéro, à la création comme à la modification', () => {
    expect(createItemSchema.safeParse({ ...base, area: 0 }).success).toBe(true)
    expect(updateItemSchema.safeParse({ area: 0 }).success).toBe(true)
  })

  it('refuse une quantité négative', () => {
    expect(createItemSchema.safeParse({ ...base, area: -1 }).success).toBe(false)
    expect(updateItemSchema.safeParse({ area: -1 }).success).toBe(false)
  })

  it('accepte toujours une quantité absente', () => {
    expect(createItemSchema.safeParse({ ...base, area: null }).success).toBe(true)
  })
})

describe('le renvoi d’une création déjà reçue', () => {
  it('applique tout le corps reçu, sans l’identifiant', () => {
    const corps = createItemSchema.parse({
      ...base, id: ID, state: 'MAUVAIS', priority: 'I', notes: 'fissure en façade',
      photos: ['/uploads/a.jpg'], area: 0,
    })
    const m = modificationDuRenvoi(corps)
    expect(m).not.toHaveProperty('id')
    expect(m).toEqual({
      ...base, state: 'MAUVAIS', priority: 'I', notes: 'fissure en façade', photos: ['/uploads/a.jpg'], area: 0,
    })
  })

  it('ne pose aucune valeur par défaut : un champ absent ne touche pas au relevé', () => {
    const m = modificationDuRenvoi(createItemSchema.parse({ ...base, id: ID }))
    expect(m).toEqual(base)
    for (const champ of ['works', 'photos', 'quantityManual', 'costManual', 'state']) {
      expect(m).not.toHaveProperty(champ)
    }
  })

  it('garde une remise à zéro explicite', () => {
    const m = modificationDuRenvoi(createItemSchema.parse({ ...base, id: ID, state: null, works: [] }))
    expect(m.state).toBeNull()
    expect(m.works).toEqual([])
  })
})

describe('les unités d’un type compté', () => {
  it('passent à la création, à la modification et au renvoi', () => {
    expect(createItemSchema.parse({ ...base, unites: 2 }).unites).toBe(2)
    expect(updateItemSchema.parse({ unites: null }).unites).toBeNull()
    expect(modificationDuRenvoi(createItemSchema.parse({ ...base, id: ID, unites: 4 })).unites).toBe(4)
  })

  it('refusent un nombre négatif, décimal ou absurde', () => {
    for (const unites of [-1, 1.5, 6000]) expect(updateItemSchema.safeParse({ unites }).success).toBe(false)
  })

  it('restent absentes d’un renvoi qui ne les porte pas', () => {
    expect(modificationDuRenvoi(createItemSchema.parse({ ...base, id: ID }))).not.toHaveProperty('unites')
  })
})
