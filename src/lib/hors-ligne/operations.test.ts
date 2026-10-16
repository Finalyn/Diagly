import { describe, it, expect } from 'vitest'
import type { ApiDiagnosticItem } from '@/lib/api-types'
import { entrer, superposer, enAttenteParDiagnostic, fusionnerRelecture, type Operation } from './operations'

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

describe('une création déjà tentée (la réponse a pu se perdre)', () => {
  it('ne reçoit plus rien : la modification part en opération à elle', () => {
    const c = op('creer', 'r1', { corps: { cfcCode: '211', state: null }, tentee: true } as Partial<Operation>)
    const m = op('modifier', 'r1', { corps: { state: 'MAUVAIS', notes: 'fissure', photos: ['data:a'] } } as Partial<Operation>)
    const r = entrer([c], m)
    expect(r.file.map((o) => o.type)).toEqual(['creer', 'modifier'])
    expect(r.file[0]).toBe(c)
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ cfcCode: '211', state: null })
    expect(r.ecrites).toEqual([m])
  })

  it('les modifications suivantes se fondent entre elles, pas dans la création', () => {
    const c = op('creer', 'r1', { corps: { cfcCode: '211' }, tentee: true } as Partial<Operation>)
    const m1 = op('modifier', 'r1', { corps: { state: 'MOYEN' } } as Partial<Operation>)
    const m2 = op('modifier', 'r1', { corps: { notes: 'humidité' } } as Partial<Operation>)
    const r = entrer(entrer([c], m1).file, m2)
    expect(r.file.map((o) => o.type)).toEqual(['creer', 'modifier'])
    expect(r.file[1].type !== 'supprimer' && r.file[1].corps).toEqual({ state: 'MOYEN', notes: 'humidité' })
    expect(r.ecrites.map((o) => o.id)).toEqual([m1.id])
  })

  it('envoie toujours la suppression du relevé, et retire ce qui attendait', () => {
    const c = op('creer', 'r1', { tentee: true } as Partial<Operation>)
    const m = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const s = op('supprimer', 'r1')
    const r = entrer([c, m], s)
    expect(r.file).toEqual([s])
    expect(r.ecrites).toEqual([s])
    expect(r.effacees.sort()).toEqual([c.id, m.id].sort())
  })

  it('une modification tentée accepte encore la suite : la renvoyer entière ne perd rien', () => {
    const m1 = op('modifier', 'r1', { corps: { state: 'MOYEN' }, tentee: true } as Partial<Operation>)
    const m2 = op('modifier', 'r1', { corps: { notes: 'fissure' } } as Partial<Operation>)
    const r = entrer([m1], m2)
    expect(r.file).toHaveLength(1)
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ state: 'MOYEN', notes: 'fissure' })
  })
})

describe('deux comptes sur le même appareil', () => {
  it('ne fond pas la saisie d’un compte dans celle d’un autre', () => {
    const c = op('creer', 'r1', { corps: { cfcCode: '211' } } as Partial<Operation>)
    const m = op('modifier', 'r1', { utilisateurId: 'u2', corps: { state: 'BON' } } as Partial<Operation>)
    const r = entrer([c], m)
    expect(r.file).toEqual([c, m])
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ cfcCode: '211' })
  })

  it('une suppression laisse en place les saisies de l’autre compte', () => {
    const autre = op('creer', 'r1', { utilisateurId: 'u2' } as Partial<Operation>)
    const mien = op('modifier', 'r1', { corps: { state: 'BON' } } as Partial<Operation>)
    const s = op('supprimer', 'r1')
    const r = entrer([autre, mien], s)
    expect(r.file).toEqual([autre, s])
    expect(r.effacees).toEqual([mien.id])
  })

  it('ne montre que les saisies du compte connecté', () => {
    const mienne = op('creer', 'r8', { corps: { cfcCode: '221' } } as Partial<Operation>)
    const autre = op('creer', 'r9', { utilisateurId: 'u2', corps: { cfcCode: '222' } } as Partial<Operation>)
    const modifAutre = op('modifier', 'r1', { utilisateurId: 'u2', corps: { state: 'MAUVAIS' } } as Partial<Operation>)
    const suppAutre = op('supprimer', 'r2', { utilisateurId: 'u2' } as Partial<Operation>)
    const vus = superposer([serveur('r1'), serveur('r2')], [mienne, autre, modifAutre, suppAutre], 'd1', 'u1')
    expect(vus.map((r) => r.id)).toEqual(['r1', 'r2', 'r8'])
    expect(vus[0].state).toBe('BON')
  })

  it('sans compte connecté, rien de la file ne se montre', () => {
    expect(superposer([], [op('creer', 'r1')], 'd1', null)).toEqual([])
  })
})

describe('relire la file au démarrage', () => {
  it('rend la file lue, triée, sans rien à réécrire quand rien n’est entré entre-temps', () => {
    const a = op('creer', 'a')
    const b = op('modifier', 'b')
    const r = fusionnerRelecture([b, a], [])
    expect(r.file).toEqual([a, b])
    expect(r.renumerotees).toEqual([])
  })

  it('garde ce qui est entré pendant la lecture, après la file lue et avec un rang qui suit', () => {
    const a = op('creer', 'a', { rang: 7 } as Partial<Operation>)
    const b = op('modifier', 'b', { rang: 9 } as Partial<Operation>)
    // Entrée avant la fin de la lecture : elle a pris le rang 1.
    const pendant = op('creer', 'c', { rang: 1 } as Partial<Operation>)
    const r = fusionnerRelecture([a, b], [pendant])
    expect(r.file.map((o) => o.id)).toEqual([a.id, b.id, pendant.id])
    expect(r.file[2].rang).toBe(10)
    expect(r.renumerotees).toEqual([{ ...pendant, rang: 10 }])
  })

  it('préfère la version en mémoire d’une opération connue des deux côtés', () => {
    const lue = op('creer', 'a', { corps: { state: null } } as Partial<Operation>)
    const enMemoire = { ...lue, corps: { state: 'MAUVAIS' } } as Operation
    const r = fusionnerRelecture([lue], [enMemoire])
    expect(r.file).toHaveLength(1)
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ state: 'MAUVAIS' })
  })
})

describe('superposer la file aux relevés du serveur', () => {
  it('montre un relevé créé hors-ligne, complété des valeurs par défaut', () => {
    const c = op('creer', 'r9', { corps: { cfcCode: '221', cfcLabel: 'Fenêtres', state: 'MOYEN' } } as Partial<Operation>)
    const vus = superposer([serveur('r1')], [c], 'd1', 'u1')
    expect(vus.map((r) => r.id)).toEqual(['r1', 'r9'])
    expect(vus[1]).toMatchObject({ cfcCode: '221', state: 'MOYEN', photos: [], works: [], diagnosticId: 'd1' })
  })

  it('applique une modification en attente sur la donnée fraîche du serveur', () => {
    const m = op('modifier', 'r1', { corps: { state: 'MAUVAIS', photos: ['data:x'] } } as Partial<Operation>)
    const [r] = superposer([serveur('r1', { notes: 'vu par un collègue' })], [m], 'd1', 'u1')
    expect(r.state).toBe('MAUVAIS')
    expect(r.photos).toEqual(['data:x'])
    expect(r.notes).toBe('vu par un collègue')
  })

  it('retire un relevé dont la suppression attend', () => {
    expect(superposer([serveur('r1'), serveur('r2')], [op('supprimer', 'r1')], 'd1', 'u1').map((r) => r.id)).toEqual(['r2'])
  })

  it("ne double pas un relevé que le serveur a reçu avant que la file ne l'oublie", () => {
    const c = op('creer', 'r1', { corps: { state: 'MOYEN' } } as Partial<Operation>)
    const vus = superposer([serveur('r1', { state: 'BON' })], [c], 'd1', 'u1')
    expect(vus).toHaveLength(1)
    expect(vus[0].state).toBe('MOYEN')
  })

  it("ignore les saisies d'un autre diagnostic", () => {
    const c = op('creer', 'r1', { diagnosticId: 'd2' } as Partial<Operation>)
    expect(superposer([], [c], 'd1', 'u1')).toEqual([])
  })

  it('ne modifie pas la liste reçue', () => {
    const liste = [serveur('r1')]
    superposer(liste, [op('modifier', 'r1', { corps: { state: 'MAUVAIS' } } as Partial<Operation>)], 'd1', 'u1')
    expect(liste[0].state).toBe('BON')
  })
})

describe('compter ce qui attend', () => {
  it('par diagnostic', () => {
    const f = [op('creer', 'a'), op('modifier', 'b'), op('creer', 'c', { diagnosticId: 'd2' } as Partial<Operation>)]
    expect(Object.fromEntries(enAttenteParDiagnostic(f))).toEqual({ d1: 2, d2: 1 })
  })
})

describe('les unités d’un type compté dans la file', () => {
  it('se fondent dans la création non tentée, et s’affichent avant l’envoi', () => {
    const c = op('creer', 'r9', { corps: { cfcCode: '273.0', unites: null } } as Partial<Operation>)
    const m = op('modifier', 'r9', { corps: { unites: 2, area: 2 } } as Partial<Operation>)
    const r = entrer([c], m)
    expect(r.file).toHaveLength(1)
    expect(r.file[0].type !== 'supprimer' && r.file[0].corps).toEqual({ cfcCode: '273.0', unites: 2, area: 2 })
    expect(superposer([], r.file, 'd1', 'u1')[0]).toMatchObject({ id: 'r9', unites: 2, area: 2 })
  })

  it('partent à part après une création tentée, comme toute saisie', () => {
    const c = op('creer', 'r8', { corps: { cfcCode: '273.0' }, tentee: true } as Partial<Operation>)
    const m = op('modifier', 'r8', { corps: { unites: 4 } } as Partial<Operation>)
    const r = entrer([c], m)
    expect(r.file.map((o) => o.type)).toEqual(['creer', 'modifier'])
    expect(superposer([serveur('r8')], r.file, 'd1', 'u1')[0].unites).toBe(4)
  })
})
