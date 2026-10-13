import { describe, it, expect, vi, beforeAll } from 'vitest'
import { generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto'

// Modifiable par les tests : la clé Apple n'est posée que pour ceux de l'échange du code.
const envMock = vi.hoisted((): Record<string, string | undefined> => ({ APPLE_BUNDLE_ID: 'ch.diagly.app' }))
vi.mock('./env.js', () => ({ env: envMock }))
vi.mock('./logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }))

const { verifierJetonApple, jetonDeRevocation, revoquerApple } = await import('./apple.js')

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

describe('le jeton d’une connexion depuis le site', () => {
  const site = () => ({ ...valide(), aud: 'ch.diagly.web', nonce: 'nonce-de-la-demande' })

  it('est accepté pour l’identifiant de service, avec le nonce de la demande', async () => {
    const id = await verifierJetonApple(jeton(site()), { audience: 'ch.diagly.web', nonce: 'nonce-de-la-demande' })
    expect(id.sub).toBe('001234.abcd.5678')
  })

  it('n’ouvre pas l’app, qui garde son identifiant par défaut', async () => {
    await expect(verifierJetonApple(jeton(site()))).rejects.toThrow(/autre app/)
  })

  it('ne se remplace pas par un jeton de l’app', async () => {
    await expect(verifierJetonApple(jeton({ ...valide(), nonce: 'nonce-de-la-demande' }), { audience: 'ch.diagly.web', nonce: 'nonce-de-la-demande' }))
      .rejects.toThrow(/autre app/)
  })

  it('est refusé avec le nonce d’une autre demande, ou sans nonce', async () => {
    const attendu = { audience: 'ch.diagly.web', nonce: 'nonce-de-la-demande' }
    await expect(verifierJetonApple(jeton({ ...site(), nonce: 'autre-nonce' }), attendu)).rejects.toThrow(/nonce/)
    const sansNonce: Record<string, unknown> = site()
    delete sansNonce.nonce
    await expect(verifierJetonApple(jeton(sansNonce), attendu)).rejects.toThrow(/nonce/)
  })
})

describe('le jeton de rafraîchissement, gardé pour la révocation', () => {
  let publique: KeyObject
  const RETOUR = 'https://diagly.ch/api/auth/apple/web/retour'
  const corpsDuDernierAppel = () => new URLSearchParams(String(vi.mocked(fetch).mock.calls.at(-1)![1]?.body))
  const lire = (partie: string) => JSON.parse(Buffer.from(partie, 'base64url').toString('utf8'))

  beforeAll(() => {
    const paire = generateKeyPairSync('ec', { namedCurve: 'P-256' })
    publique = paire.publicKey
    Object.assign(envMock, {
      APPLE_TEAM_ID: 'EQUIPE1234',
      APPLE_KEY_ID: 'CLE1234567',
      APPLE_PRIVATE_KEY: paire.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
      APPLE_SERVICES_ID: 'ch.diagly.web',
    })
  })

  it('s’obtient, pour le site, avec l’identifiant de service, l’adresse de retour et un secret signé par la clé', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ refresh_token: 'r123.0.abc' })))
    const garde = await jetonDeRevocation('code-du-site', { servicesId: 'ch.diagly.web', retour: RETOUR })
    expect(garde).toBe('site:r123.0.abc')
    expect(vi.mocked(fetch).mock.calls.at(-1)![0]).toBe('https://appleid.apple.com/auth/token')
    const corps = corpsDuDernierAppel()
    expect(corps.get('client_id')).toBe('ch.diagly.web')
    expect(corps.get('redirect_uri')).toBe(RETOUR)
    expect(corps.get('code')).toBe('code-du-site')
    const [e, c, s] = corps.get('client_secret')!.split('.')
    expect(lire(e)).toEqual({ alg: 'ES256', kid: 'CLE1234567' })
    expect(lire(c)).toMatchObject({ iss: 'EQUIPE1234', sub: 'ch.diagly.web', aud: 'https://appleid.apple.com' })
    expect(verify('sha256', Buffer.from(`${e}.${c}`), { key: publique, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'))).toBe(true)
  })

  it('s’obtient, pour l’app, comme avant : identifiant de l’app, sans adresse de retour ni préfixe', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ refresh_token: 'r456.0.def' })))
    expect(await jetonDeRevocation('code-de-l-app')).toBe('r456.0.def')
    const corps = corpsDuDernierAppel()
    expect(corps.get('client_id')).toBe('ch.diagly.app')
    expect(corps.has('redirect_uri')).toBe(false)
    expect(lire(corps.get('client_secret')!.split('.')[1]).sub).toBe('ch.diagly.app')
  })

  it('ne fait pas échouer la connexion quand Apple refuse l’échange', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 }))
    expect(await jetonDeRevocation('code-perime', { servicesId: 'ch.diagly.web', retour: RETOUR })).toBeNull()
  })

  it('se révoque avec l’identifiant du client qui l’a obtenu', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))
    await revoquerApple('site:r123.0.abc')
    let corps = corpsDuDernierAppel()
    expect(vi.mocked(fetch).mock.calls.at(-1)![0]).toBe('https://appleid.apple.com/auth/revoke')
    expect(corps.get('client_id')).toBe('ch.diagly.web')
    expect(corps.get('token')).toBe('r123.0.abc')

    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 200 }))
    await revoquerApple('r456.0.def')
    corps = corpsDuDernierAppel()
    expect(corps.get('client_id')).toBe('ch.diagly.app')
    expect(corps.get('token')).toBe('r456.0.def')
  })
})
