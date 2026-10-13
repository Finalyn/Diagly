import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ApiUser } from '@/lib/api-types'
import type { Operation } from './operations'
import type { Refus } from './etat'

/**
 * Le moteur de la file, avec un disque et un serveur simulés : ce que les
 * tests purs d'operations.ts ne voient pas (l'ordre des écritures, ce qui
 * reste sur le disque, l'attente de la relecture).
 */

// Le disque de l'appareil, en mémoire : on y lit ce que le moteur a laissé à
// chaque instant, comme après une fermeture brutale de l'app.
const memoire = vi.hoisted(() => ({
  disque: new Map<string, unknown>(),
  refus: [] as unknown[],
  lecture: Promise.resolve([] as unknown[]),
}))

vi.mock('./stockage', () => ({
  stockage: {
    lister: () => memoire.lecture,
    ecrire: async (ops: { id: string }[]) => { for (const op of ops) memoire.disque.set(op.id, structuredClone(op)) },
    effacer: async (ids: string[]) => { for (const id of ids) memoire.disque.delete(id) },
    lireRefus: async () => structuredClone(memoire.refus),
    ecrireRefus: async (refus: unknown[]) => { memoire.refus = structuredClone(refus) },
  },
}))

const appels = vi.hoisted(() => ({ createItem: vi.fn(), updateItem: vi.fn(), deleteItem: vi.fn() }))

vi.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(status: number, message: string) {
      super(message)
      this.status = status
    }
  }
  return { api: { diagnostics: appels }, ApiError }
})

// Le vrai minuteur, gardé avant que les tests ne le remplacent : il laisse
// passer toutes les promesses en cours, sans déclencher les relances programmées.
const vraiMinuteur = globalThis.setTimeout
const laisserFiler = () => new Promise<void>((r) => { vraiMinuteur(r, 0) })

const operation = (champs: Partial<Operation> & { id: string }): Operation => ({
  type: 'creer', rang: 1, utilisateurId: 'u1', diagnosticId: 'd1', releveId: 'r1', saisieLe: 1, corps: {}, ...champs,
} as Operation)

/** Un moteur neuf (modules rechargés), avec une session ouverte. */
async function demarrer(utilisateurId = 'u1') {
  const { useAuth } = await import('@/stores/auth')
  useAuth.setState({ user: { id: utilisateurId } as unknown as ApiUser, accessToken: 'jeton', refreshToken: 'renouvellement' })
  const { ApiError } = await import('@/lib/api')
  return { ...(await import('./file-envoi')), ...(await import('./etat')), ApiError }
}

beforeEach(() => {
  vi.resetModules()
  memoire.disque.clear()
  memoire.refus = []
  memoire.lecture = Promise.resolve([])
  for (const f of Object.values(appels)) f.mockReset()
  let valeurs: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => valeurs[k] ?? null,
      setItem: (k: string, v: string) => { valeurs[k] = v },
      removeItem: (k: string) => { delete valeurs[k] },
      clear: () => { valeurs = {} },
    },
    configurable: true,
  })
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('une création dont la réponse se perd', () => {
  it('est marquée tentée sur le disque avant de partir, et le reste', async () => {
    const { saisir, lireEtat } = await demarrer()
    let surLeDisqueAuDepart: Operation | undefined
    appels.createItem.mockImplementation(async () => {
      surLeDisqueAuDepart = [...memoire.disque.values()][0] as Operation
      throw new TypeError('Failed to fetch')
    })
    await saisir({ type: 'creer', diagnosticId: 'd1', releveId: 'r1', corps: { cfcCode: '211' } })
    await laisserFiler()

    expect(appels.createItem).toHaveBeenCalledTimes(1)
    expect(surLeDisqueAuDepart?.tentee).toBe(true)
    expect(lireEtat().file).toHaveLength(1)
    expect(lireEtat().file[0].tentee).toBe(true)
  })

  it('ne reçoit pas la modification suivante, et sa suppression part au serveur', async () => {
    const { saisir, lireEtat, ApiError } = await demarrer()
    appels.createItem.mockRejectedValue(new TypeError('Failed to fetch'))
    await saisir({ type: 'creer', diagnosticId: 'd1', releveId: 'r1', corps: { cfcCode: '211' } })
    await laisserFiler()

    await saisir({ type: 'modifier', diagnosticId: 'd1', releveId: 'r1', corps: { state: 'MAUVAIS', notes: 'fissure' } })
    await laisserFiler()
    expect(lireEtat().file.map((o) => o.type)).toEqual(['creer', 'modifier'])
    const creation = lireEtat().file[0]
    expect(creation.type !== 'supprimer' && creation.corps).toEqual({ cfcCode: '211' })

    // Le relevé n'existe peut-être pas sur le serveur : son 404 vaut succès.
    appels.deleteItem.mockRejectedValue(new ApiError(404, 'Diagnostic item not found'))
    await saisir({ type: 'supprimer', diagnosticId: 'd1', releveId: 'r1' })
    await laisserFiler()
    expect(appels.deleteItem).toHaveBeenCalledWith('r1')
    expect(lireEtat().file).toEqual([])
    expect(lireEtat().refus).toEqual([])
    expect(memoire.disque.size).toBe(0)
  })
})

describe('une saisie faite pendant la relecture de la file', () => {
  it('attend la fin de la lecture, puis passe après ce qui était sur le disque', async () => {
    let finirLecture: (ops: Operation[]) => void = () => undefined
    memoire.lecture = new Promise((r) => { finirLecture = r })
    // Rien ne revient du serveur : la file reste telle qu'on l'observe.
    appels.createItem.mockReturnValue(new Promise(() => undefined))
    const { saisir, chargerFile, lireEtat } = await demarrer()

    void chargerFile()
    const enCours = saisir({ type: 'creer', diagnosticId: 'd1', releveId: 'r2', corps: {} })
    await laisserFiler()
    expect(lireEtat().file).toEqual([])

    finirLecture([operation({ id: 'ancienne', rang: 4, releveId: 'r1' })])
    await enCours
    const file = lireEtat().file
    expect(file.map((o) => o.releveId)).toEqual(['r1', 'r2'])
    expect(file[1].rang).toBe(5)
    expect((memoire.disque.get(file[1].id) as Operation).rang).toBe(5)
  })
})

describe('les refus', () => {
  it('sont gardés sur le disque avec leur compte', async () => {
    const { saisir, lireEtat, ApiError } = await demarrer()
    appels.createItem.mockRejectedValue(new ApiError(404, 'Diagnostic not found'))
    await saisir({ type: 'creer', diagnosticId: 'd1', releveId: 'r1', corps: {} })
    await laisserFiler()

    expect(lireEtat().file).toEqual([])
    expect(memoire.disque.size).toBe(0)
    expect((memoire.refus as Refus[]).map((r) => r.operation.utilisateurId)).toEqual(['u1'])
  })

  it('sont relus au démarrage, et chacun ne voit que les siens', async () => {
    memoire.refus = [
      { operation: operation({ id: 'a', utilisateurId: 'u1' }), raison: 'A', le: 1 },
      { operation: operation({ id: 'b', utilisateurId: 'u2' }), raison: 'B', le: 2 },
    ]
    const { chargerFile, lireEtat, ignorerRefus } = await demarrer('u1')
    await chargerFile()
    expect(lireEtat().refus).toHaveLength(2)

    ignorerRefus()
    await laisserFiler()
    expect(lireEtat().refus.map((r) => r.raison)).toEqual(['B'])
    expect((memoire.refus as Refus[]).map((r) => r.raison)).toEqual(['B'])
  })
})

describe('la déconnexion', () => {
  it("n'efface que les saisies et les refus du compte qui part", async () => {
    const autre = operation({ id: 'de-u2', utilisateurId: 'u2', releveId: 'r9' })
    memoire.lecture = Promise.resolve([autre])
    memoire.disque.set(autre.id, autre)
    memoire.refus = [
      { operation: operation({ id: 'refus-u1', utilisateurId: 'u1' }), raison: 'A', le: 1 },
      { operation: operation({ id: 'refus-u2', utilisateurId: 'u2' }), raison: 'B', le: 2 },
    ]
    appels.createItem.mockReturnValue(new Promise(() => undefined))
    const { saisir, lireEtat, oublierSaisiesDuCompte } = await demarrer('u1')
    await saisir({ type: 'creer', diagnosticId: 'd1', releveId: 'r1', corps: {} })
    await laisserFiler()
    expect(lireEtat().file).toHaveLength(2)

    await oublierSaisiesDuCompte('u1')
    expect(lireEtat().file.map((o) => o.id)).toEqual(['de-u2'])
    expect([...memoire.disque.keys()]).toEqual(['de-u2'])
    expect(lireEtat().refus.map((r) => r.operation.id)).toEqual(['refus-u2'])
    expect((memoire.refus as Refus[]).map((r) => r.operation.id)).toEqual(['refus-u2'])
  })
})
