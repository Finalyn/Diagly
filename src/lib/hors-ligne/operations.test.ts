import { describe, it, expect } from 'vitest'
import type { ApiDiagnosticItem } from '@/lib/api-types'
import { entrer, superposer, enAttenteParDiagnostic, type Operation } from './operations'

let rang = 0
function op<T extends Operation['type']>(type: T, releveId: string, extra: Partial<Operation> = {}): Operation {
  rang += 1
  const commun = { id: `op${rang}`, rang, utilisateurId: 'u1', diagnosticId: 'd1', releveId, saisieLe: 1_760_000_000_000 + rang }
  if (type === 'supprimer') return { ...commun, type: 'supprimer', ...extra } as Operation
  return { ...commun, type, corps: {}, ...extra } as Operation
}

function serveur(id: string, champs: Partial<ApiDiagnosticItem> = {}): ApiDiagnosticItem {
  return {
    id, diagnosticId: 'd1', cfcCode: '211', cfcLabel: 'Maçonnerie', catalogItemId: null,
    state: 'BON', priority: 'III', notes: null, works: [], photos: [], area: 10, unit: 'm²',
    yearInstalled: null, interventionYear: null, estimatedCost: '1000', improvement: null,
    improvementCost: null, norms: null, normsCost: null,
    createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:00:00.000Z', ...champs,
  }
}

describe('entrer une saisie dans la file', () => {
  it('ajoute une création en bout de file', () => {
    const c = op('creer', 'r1', { corps: { cfcCode: '211' } } as Partial<Operation>)
    const r = entrer([], c)
    expect(r.file).toEqual([c])
    expect(r.ecrites).toEqual([c])
    expect(r.effacees).toEqual([])
  })

  it("fond une modification dans la création encore en attente : une seule requête partira", () => {
    const c = op('creer', 'r1', { corps: { cfcCode: '211', state: null } } as Partial<Operation>)
    const m = op('modifier', 'r1', { corps: { state: 'MAUVAIS', photos: ['data:a'] } } as Partial<Operation>)
    const r = entrer([c], m)
    expect(r.file).toHaveLength(1)
    expect(r.file[0].type).toBe('creer')
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ cfcCode: '211', state: 'MAUVAIS', photos: ['data:a'] })
    expect(r.ecrites[0].id).toBe(c.id)
  })

  it('fond deux modifications du même relevé, la plus récente gagnant champ par champ', () => {
    const m1 = op('modifier', 'r1', { corps: { state: 'MOYEN', notes: 'fissure' } } as Partial<Operation>)
    const m2 = op('modifier', 'r1', { corps: { state: 'MAUVAIS' } } as Partial<Operation>)
    const r = entrer([m1], m2)
    expect(r.file).toHaveLength(1)
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ state: 'MAUVAIS', notes: 'fissure' })
  })

  it("ne touche pas une opération déjà partie : la modification vient après elle", () => {
    const c = op('creer', 'r1', { corps: { cfcCode: '211' } } as Partial<Operation>)
    const m = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const r = entrer([c], m, c.id)
    expect(r.file.map((o) => o.type)).toEqual(['creer', 'modifier'])
    expect(r.file[0]).toBe(c)
  })

  it('ne mélange pas deux relevés', () => {
    const m1 = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const m2 = op('modifier', 'r2', { corps: { state: 'MAUVAIS' } } as Partial<Operation>)
    expect(entrer([m1], m2).file).toHaveLength(2)
  })

  it("efface sans rien envoyer un relevé créé ici puis supprimé avant d'être parti", () => {
    const c = op('creer', 'r1')
    const m = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const s = op('supprimer', 'r1')
    const r = entrer([c, m], s)
    expect(r.file).toEqual([])
    expect(r.effacees.sort()).toEqual([c.id, m.id].sort())
    expect(r.ecrites).toEqual([])
  })

  it('remplace les modifications en attente par la suppression d’un relevé déjà sur le serveur', () => {
    const m = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const s = op('supprimer', 'r1')
    const r = entrer([m], s)
    expect(r.file).toEqual([s])
    expect(r.effacees).toEqual([m.id])
  })

  it('demande la suppression si la création est déjà partie', () => {
    const c = op('creer', 'r1')
    const s = op('supprimer', 'r1')
    const r = entrer([c], s, c.id)
    expect(r.file.map((o) => o.type)).toEqual(['creer', 'supprimer'])
  })

  it('ignore la modification d’un relevé qui attend sa suppression', () => {
    const s = op('supprimer', 'r1')
    const m = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const r = entrer([s], m)
    expect(r.file).toEqual([s])
    expect(r.ecrites).toEqual([])
  })
})

describe('superposer la file aux relevés du serveur', () => {
  it('montre un relevé créé hors-ligne, complété des valeurs par défaut', () => {
    const c = op('creer', 'r9', { corps: { cfcCode: '221', cfcLabel: 'Fenêtres', state: 'MOYEN' } } as Partial<Operation>)
    const vus = superposer([serveur('r1')], [c], 'd1')
    expect(vus.map((r) => r.id)).toEqual(['r1', 'r9'])
    expect(vus[1]).toMatchObject({ cfcCode: '221', state: 'MOYEN', photos: [], works: [], diagnosticId: 'd1' })
  })

  it('applique une modification en attente sur la donnée fraîche du serveur', () => {
    const m = op('modifier', 'r1', { corps: { state: 'MAUVAIS', photos: ['data:x'] } } as Partial<Operation>)
    const [r] = superposer([serveur('r1', { notes: 'vu par un collègue' })], [m], 'd1')
    expect(r.state).toBe('MAUVAIS')
    expect(r.photos).toEqual(['data:x'])
    expect(r.notes).toBe('vu par un collègue')
  })

  it('retire un relevé dont la suppression attend', () => {
    expect(superposer([serveur('r1'), serveur('r2')], [op('supprimer', 'r1')], 'd1').map((r) => r.id)).toEqual(['r2'])
  })

  it("ne double pas un relevé que le serveur a reçu avant que la file ne l'oublie", () => {
    const c = op('creer', 'r1', { corps: { state: 'MOYEN' } } as Partial<Operation>)
    const vus = superposer([serveur('r1', { state: 'BON' })], [c], 'd1')
    expect(vus).toHaveLength(1)
    expect(vus[0].state).toBe('MOYEN')
  })

  it("ignore les saisies d'un autre diagnostic", () => {
    const c = op('creer', 'r1', { diagnosticId: 'd2' } as Partial<Operation>)
    expect(superposer([], [c], 'd1')).toEqual([])
  })

  it('ne modifie pas la liste reçue', () => {
    const liste = [serveur('r1')]
    superposer(liste, [op('modifier', 'r1', { corps: { state: 'MAUVAIS' } } as Partial<Operation>)], 'd1')
    expect(liste[0].state).toBe('BON')
  })
})

describe('compter ce qui attend', () => {
  it('par diagnostic', () => {
    const f = [op('creer', 'a'), op('modifier', 'b'), op('creer', 'c', { diagnosticId: 'd2' } as Partial<Operation>)]
    expect(Object.fromEntries(enAttenteParDiagnostic(f))).toEqual({ d1: 2, d2: 1 })
  })
})
