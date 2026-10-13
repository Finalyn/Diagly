import { describe, it, expect, vi, beforeAll } from 'vitest'
import { generateKeyPairSync, sign, type KeyObject } from 'node:crypto'

vi.mock('./env.js', () => ({ env: { APPLE_BUNDLE_ID: 'ch.diagly.app' } }))
vi.mock('./logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const { verifierJetonApple } = await import('./apple.js')

// Une paire de clés jouant le rôle de celle d'Apple, publiée comme Apple le fait.
let privee: KeyObject
beforeAll(() => {
  const paire = generateKeyPairSync('rsa', { modulusLength: 2048 })
  privee = paire.privateKey
  const jwk = { ...paire.publicKey.export({ format: 'jwk' }), kid: 'cle-essai', alg: 'RS256', use: 'sig' }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }))))
})

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
function jeton(charge: Record<string, unknown>, entete: Record<string, unknown> = { alg: 'RS256', kid: 'cle-essai' }) {
  const corps = `${b64(entete)}.${b64(charge)}`
  return `${corps}.${sign('RSA-SHA256', Buffer.from(corps), privee).toString('base64url')}`
}
const valide = () => ({
  iss: 'https://appleid.apple.com',
  aud: 'ch.diagly.app',
  exp: Math.floor(Date.now() / 1000) + 600,
  sub: '001234.abcd.5678',
  email: 'Chloe@Exemple.ch',
  email_verified: 'true',
})

describe('le jeton de « Se connecter avec Apple »', () => {
  it('est accepté quand Apple l’a signé pour notre app', async () => {
    const id = await verifierJetonApple(jeton(valide()))
    expect(id).toEqual({ sub: '001234.abcd.5678', email: 'chloe@exemple.ch', emailVerifie: true })
  })

  it('est refusé quand il est destiné à une autre app', async () => {
    await expect(verifierJetonApple(jeton({ ...valide(), aud: 'com.autre.app' }))).rejects.toThrow(/autre app/)
  })

  it('est refusé quand il ne vient pas d’Apple', async () => {
    await expect(verifierJetonApple(jeton({ ...valide(), iss: 'https://pirate.example' }))).rejects.toThrow(/émetteur/)
  })

  it('est refusé une fois expiré', async () => {
    await expect(verifierJetonApple(jeton({ ...valide(), exp: Math.floor(Date.now() / 1000) - 5 }))).rejects.toThrow(/expiré/)
  })

  it('est refusé quand son contenu a été modifié après signature', async () => {
    const [e, , s] = jeton(valide()).split('.')
    const truque = `${e}.${b64({ ...valide(), sub: 'quelqu-un-d-autre' })}.${s}`
    await expect(verifierJetonApple(truque)).rejects.toThrow(/signature/)
  })

  it('est refusé sans signature RS256 (alg « none »)', async () => {
    const corps = `${b64({ alg: 'none', kid: 'cle-essai' })}.${b64(valide())}`
    await expect(verifierJetonApple(`${corps}.`)).rejects.toThrow()
  })

  it('ne tient pas pour vérifiée une adresse qu’Apple n’a pas vérifiée', async () => {
    const id = await verifierJetonApple(jeton({ ...valide(), email_verified: false }))
    expect(id.emailVerifie).toBe(false)
  })

  it('n’attend pas Apple plus de quelques secondes', async () => {
    const appels = vi.mocked(fetch).mock.calls
    expect(appels.length).toBeGreaterThan(0)
    expect(appels[0][1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('ne relit les clés d’Apple, pour une clé inconnue, qu’une fois par minute', async () => {
    await verifierJetonApple(jeton(valide()))
    const avant = vi.mocked(fetch).mock.calls.length
    const inconnue = () => verifierJetonApple(jeton(valide(), { alg: 'RS256', kid: 'kid-invente' }))
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now() + 2 * 60_000)
      await expect(inconnue()).rejects.toThrow(/inconnue/)
      await expect(inconnue()).rejects.toThrow(/inconnue/)
      await expect(inconnue()).rejects.toThrow(/inconnue/)
      expect(vi.mocked(fetch).mock.calls.length).toBe(avant + 1)
      // Une minute plus tard, une nouvelle lecture est permise.
      vi.setSystemTime(Date.now() + 61_000)
      await expect(inconnue()).rejects.toThrow(/inconnue/)
      expect(vi.mocked(fetch).mock.calls.length).toBe(avant + 2)
    } finally {
      vi.useRealTimers()
    }
  })
})
