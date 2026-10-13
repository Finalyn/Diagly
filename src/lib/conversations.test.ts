import { describe, it, expect, beforeEach } from 'vitest'
import {
  titreDepuis, nouvelleConversation, lireConversations, ecrireConversations, oublierConversations,
  type Conversation,
} from './conversations'

const stockage = () => {
  let data: Record<string, string> = {}
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => { data[k] = v },
    removeItem: (k: string) => { delete data[k] },
    clear: () => { data = {} },
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: stockage(), configurable: true })
})

const conv = (patch: Partial<Conversation> = {}): Conversation => ({
  ...nouvelleConversation(),
  ...patch,
})

describe('titreDepuis', () => {
  it('prend la question telle quelle quand elle est courte', () => {
    expect(titreDepuis('Résume ce diagnostic')).toBe('Résume ce diagnostic')
  })

  it('coupe sur un mot entier et marque la coupe', () => {
    const t = titreDepuis('Explique-moi pourquoi la priorité de la toiture est passée en urgente cette année')
    expect(t.length).toBeLessThanOrEqual(49)
    expect(t.endsWith('…')).toBe(true)
    expect(t).not.toMatch(/\s…$/)
  })

  it('écrase les retours à la ligne', () => {
    expect(titreDepuis('Deux\n\nlignes')).toBe('Deux lignes')
  })

  it('donne un titre par défaut à une question vide', () => {
    expect(titreDepuis('   ')).toBe('Nouvelle conversation')
  })
})

describe('nouvelleConversation', () => {
  it('donne un identifiant différent à chaque fois', () => {
    const ids = new Set(Array.from({ length: 50 }, () => nouvelleConversation().id))
    expect(ids.size).toBe(50)
  })
})

describe('lecture et écriture', () => {
  it('rend une liste vide quand rien n’a été écrit', () => {
    expect(lireConversations()).toEqual([])
  })

  it('relit ce qui a été écrit, la plus récente d’abord', () => {
    ecrireConversations([
      conv({ id: 'a', titre: 'Ancienne', modifieeLe: 100 }),
      conv({ id: 'b', titre: 'Récente', modifieeLe: 900 }),
    ])
    expect(lireConversations().map((c) => c.id)).toEqual(['b', 'a'])
  })

  it('ne garde pas les photos : elles feraient sauter le quota', () => {
    ecrireConversations([conv({
      id: 'a',
      messages: [{ role: 'user', content: 'Regarde', images: ['data:image/png;base64,AAAA'] }],
    })])
    expect(lireConversations()[0].messages[0]).toEqual({ role: 'user', content: 'Regarde' })
  })

  it('ne garde que les quarante plus récentes', () => {
    ecrireConversations(Array.from({ length: 60 }, (_, i) => conv({ id: `c${i}`, modifieeLe: i })))
    const lues = lireConversations()
    expect(lues).toHaveLength(40)
    expect(lues[0].id).toBe('c59')
    expect(lues.some((c) => c.id === 'c0')).toBe(false)
  })

  it('survit à un contenu illisible', () => {
    localStorage.setItem('diagly.assistant.conversations', '{pas du json')
    expect(lireConversations()).toEqual([])
  })

  it('ignore les entrées qui n’ont pas la bonne forme', () => {
    localStorage.setItem('diagly.assistant.conversations', JSON.stringify([null, 42, { titre: 'sans id' }, { id: 'ok', titre: 'T', modifieeLe: 1, messages: [], diagnostics: [] }]))
    expect(lireConversations().map((c) => c.id)).toEqual(['ok'])
  })

  it('ne jette pas quand le stockage refuse d’écrire', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { getItem: () => null, setItem: () => { throw new Error('quota') } },
      configurable: true,
    })
    expect(() => ecrireConversations([conv()])).not.toThrow()
  })
})

describe('fin de session', () => {
  it('efface les conversations : le compte suivant ne les retrouve pas', () => {
    ecrireConversations([conv({ id: 'a', titre: 'Toiture rue du Lac' })])
    oublierConversations()
    expect(lireConversations()).toEqual([])
  })

  it('ne jette pas quand le stockage est indisponible', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: { removeItem: () => { throw new Error('refusé') } },
      configurable: true,
    })
    expect(() => oublierConversations()).not.toThrow()
  })
})
