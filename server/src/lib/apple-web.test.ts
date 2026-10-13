import { describe, it, expect, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  AUTORISATION_APPLE, DUREE_DEMANDE_MS, adresseDeRetourApple, demandeAppleWeb, nomDuPremierPassage, verifierEtatAppleWeb,
} from './apple-web.js'

const SECRET = 'secret-de-test-pour-les-jetons-1234567890'
const RETOUR = 'https://diagly.ch/api/auth/apple/web/retour'
const demande = () => demandeAppleWeb({ servicesId: 'ch.diagly.web', retour: RETOUR, secret: SECRET })

describe('la demande « Se connecter avec Apple » du site', () => {
  it('part vers Apple avec l’identifiant de service, l’adresse de retour et un retour par formulaire', () => {
    const { url } = demande()
    const u = new URL(url)
    expect(`${u.origin}${u.pathname}`).toBe(AUTORISATION_APPLE)
    expect(u.searchParams.get('client_id')).toBe('ch.diagly.web')
    expect(u.searchParams.get('redirect_uri')).toBe(RETOUR)
    expect(u.searchParams.get('response_type')).toBe('code id_token')
    expect(u.searchParams.get('response_mode')).toBe('form_post')
    expect(u.searchParams.get('scope')).toBe('name email')
    expect(u.searchParams.get('state')).toBeTruthy()
    expect(u.searchParams.get('nonce')).toBeTruthy()
  })

  it('écrit les espaces en %20, comme la documentation d’Apple', () => {
    const { url } = demande()
    expect(url).toContain('response_type=code%20id_token')
    expect(url).toContain('scope=name%20email')
    expect(url).not.toContain('+')
  })

  it('tire un lien, un état et un nonce neufs à chaque demande', () => {
    const a = demande()
    const b = demande()
    expect(a.lien).not.toBe(b.lien)
    expect(new URL(a.url).searchParams.get('state')).not.toBe(new URL(b.url).searchParams.get('state'))
    expect(new URL(a.url).searchParams.get('nonce')).not.toBe(new URL(b.url).searchParams.get('nonce'))
  })

  it('ne laisse pas le lien du cookie paraître dans l’adresse', () => {
    const { url, lien } = demande()
    expect(url).not.toContain(lien)
  })

  it('construit l’adresse de retour depuis l’URL publique', () => {
    expect(adresseDeRetourApple('https://diagly.ch')).toBe(RETOUR)
    expect(adresseDeRetourApple('https://diagly.ch/')).toBe(RETOUR)
  })
})

describe('le retour d’Apple sur le site', () => {
  it('est accepté avec l’état de la demande et le cookie du même navigateur, et rend le nonce envoyé', () => {
    const { url, lien } = demande()
    const u = new URL(url)
    const { nonce } = verifierEtatAppleWeb(u.searchParams.get('state')!, lien, SECRET)
    expect(nonce).toBe(u.searchParams.get('nonce'))
  })

  it('est refusé avec le cookie d’un autre navigateur', () => {
    const victime = demande()
    const attaquant = demande()
    const state = new URL(attaquant.url).searchParams.get('state')!
    expect(() => verifierEtatAppleWeb(state, victime.lien, SECRET)).toThrow(/autre navigateur/)
  })

  it('est refusé sans cookie, ou sans état', () => {
    const { url, lien } = demande()
    expect(() => verifierEtatAppleWeb(new URL(url).searchParams.get('state')!, undefined, SECRET)).toThrow(/cookie/)
    expect(() => verifierEtatAppleWeb(undefined, lien, SECRET)).toThrow(/état absent/)
  })

  it('est refusé quand l’état a été signé ailleurs ou modifié', () => {
    const { url, lien } = demande()
    const state = new URL(url).searchParams.get('state')!
    expect(() => verifierEtatAppleWeb(state, lien, 'un-autre-secret-de-plus-de-32-caracteres')).toThrow()
    const [e, , s] = state.split('.')
    const charge = Buffer.from(JSON.stringify({ purpose: 'apple-web', l: 'x', o: 'nonce-choisi' })).toString('base64url')
    expect(() => verifierEtatAppleWeb(`${e}.${charge}.${s}`, lien, SECRET)).toThrow()
  })

  it('est refusé avec l’état d’une connexion Google', () => {
    const { lien } = demande()
    const google = jwt.sign({ n: lien, purpose: 'oauth' }, SECRET, { expiresIn: '10m' })
    expect(() => verifierEtatAppleWeb(google, lien, SECRET)).toThrow(/autre demande/)
  })

  it('est refusé au-delà de dix minutes', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      const { url, lien } = demande()
      const state = new URL(url).searchParams.get('state')!
      vi.setSystemTime(Date.now() + DUREE_DEMANDE_MS - 30_000)
      expect(() => verifierEtatAppleWeb(state, lien, SECRET)).not.toThrow()
      vi.setSystemTime(Date.now() + 60_000)
      expect(() => verifierEtatAppleWeb(state, lien, SECRET)).toThrow(/expired/)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('le nom joint au premier passage', () => {
  it('se lit dans le champ « user » d’Apple', () => {
    const user = JSON.stringify({ name: { firstName: ' Chloé ', lastName: 'Berger' }, email: 'chloe@exemple.ch' })
    expect(nomDuPremierPassage(user)).toEqual({ firstName: 'Chloé', lastName: 'Berger' })
  })

  it('manque sans faire échouer la connexion', () => {
    expect(nomDuPremierPassage(undefined)).toEqual({})
    expect(nomDuPremierPassage('pas du json')).toEqual({})
    expect(nomDuPremierPassage('null')).toEqual({ firstName: undefined, lastName: undefined })
    expect(nomDuPremierPassage(JSON.stringify({ name: { firstName: 42, lastName: '  ' } }))).toEqual({ firstName: undefined, lastName: undefined })
  })

  it('est borné comme à l’inscription', () => {
    const long = 'a'.repeat(300)
    expect(nomDuPremierPassage(JSON.stringify({ name: { firstName: long } })).firstName).toHaveLength(100)
  })
})
