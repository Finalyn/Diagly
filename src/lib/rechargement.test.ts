import { describe, it, expect, vi, afterEach } from 'vitest'
import { estHorsLigne, rechargerProprement, rechargerUneFois } from './rechargement'

/** Un navigateur factice : réseau, service worker, caches et stockage observables. */
function navigateur(enLigne: boolean) {
  const desinscrire = vi.fn(async () => true)
  const espions = {
    getRegistrations: vi.fn(async () => [{ unregister: desinscrire }]),
    desinscrire,
    keys: vi.fn(async () => ['diagly-shell-v3', 'diagly-assets-v3', 'diagly-api-v3']),
    supprimer: vi.fn(async () => true),
    recharger: vi.fn(),
    noter: vi.fn(),
  }
  vi.stubGlobal('navigator', { onLine: enLigne, serviceWorker: { getRegistrations: espions.getRegistrations } })
  vi.stubGlobal('caches', { keys: espions.keys, delete: espions.supprimer })
  vi.stubGlobal('window', { location: { reload: espions.recharger } })
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: espions.noter })
  return espions
}

const MODULE_MANQUANT = new TypeError('Failed to fetch dynamically imported module: https://diagly.ch/assets/ProjectVisite-abc.js')

afterEach(() => { vi.unstubAllGlobals() })

describe('le rechargement propre', () => {
  it('purge le code et recharge, en ligne', async () => {
    const e = navigateur(true)
    await rechargerProprement()
    expect(e.desinscrire).toHaveBeenCalled()
    // Les données de l'API restent : seuls le shell et le code partent.
    expect(e.supprimer.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['diagly-shell-v3', 'diagly-assets-v3'])
    expect(e.recharger).toHaveBeenCalled()
  })

  it('ne touche à rien hors connexion', async () => {
    const e = navigateur(false)
    expect(estHorsLigne()).toBe(true)
    await rechargerProprement()
    expect(e.getRegistrations).not.toHaveBeenCalled()
    expect(e.keys).not.toHaveBeenCalled()
    expect(e.supprimer).not.toHaveBeenCalled()
    expect(e.recharger).not.toHaveBeenCalled()
  })

  it('laisse l’erreur au filet de sécurité hors connexion, sans consommer la minute de garde', () => {
    const e = navigateur(false)
    expect(() => rechargerUneFois(MODULE_MANQUANT)).toThrow(MODULE_MANQUANT)
    expect(e.noter).not.toHaveBeenCalled()
    expect(e.getRegistrations).not.toHaveBeenCalled()
    expect(e.recharger).not.toHaveBeenCalled()
  })

  it('recharge une fois, en ligne, quand un fichier de code manque', async () => {
    const e = navigateur(true)
    expect(() => rechargerUneFois(MODULE_MANQUANT)).toThrow(MODULE_MANQUANT)
    expect(e.noter).toHaveBeenCalled()
    await vi.waitFor(() => expect(e.recharger).toHaveBeenCalled())
  })
})
