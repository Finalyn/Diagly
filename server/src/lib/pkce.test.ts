import { describe, it, expect } from 'vitest'
import { CodesDeConnexion, challengeDe, challengeValide, verifierCorrespond, DUREE_CODE_MS } from './pkce.js'

// L'exemple de la RFC 7636 (annexe B) : ce que l'app calcule doit donner la même empreinte.
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'

describe('l’empreinte du secret de l’app (PKCE)', () => {
  it('se calcule comme dans la RFC 7636', () => {
    expect(challengeDe(VERIFIER)).toBe(CHALLENGE)
    expect(challengeValide(CHALLENGE)).toBe(true)
  })

  it('n’accepte que le secret dont elle est l’empreinte', () => {
    expect(verifierCorrespond(VERIFIER, CHALLENGE)).toBe(true)
    expect(verifierCorrespond(VERIFIER.replace('d', 'e'), CHALLENGE)).toBe(false)
  })

  it('refuse un secret ou une empreinte mal formés', () => {
    expect(verifierCorrespond('trop-court', challengeDe('trop-court'))).toBe(false)
    expect(verifierCorrespond(VERIFIER, CHALLENGE.slice(1))).toBe(false)
    expect(challengeValide(undefined)).toBe(false)
    expect(challengeValide(['a'])).toBe(false)
  })
})

describe('les codes de retour vers l’app', () => {
  it('s’échangent une seule fois, avec le bon secret', () => {
    const codes = new CodesDeConnexion()
    const code = codes.emettre('compte-1', CHALLENGE)
    expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(codes.echanger(code, VERIFIER)).toBe('compte-1')
    expect(codes.echanger(code, VERIFIER)).toBeNull()
  })

  it('ne servent à rien sans le secret, et sont consommés par l’essai', () => {
    const codes = new CodesDeConnexion()
    const code = codes.emettre('compte-1', CHALLENGE)
    const autreSecret = 'a'.repeat(43)
    expect(codes.echanger(code, autreSecret)).toBeNull()
    // L'app légitime ne peut plus s'en servir non plus : un code intercepté et essayé est perdu.
    expect(codes.echanger(code, VERIFIER)).toBeNull()
  })

  it('expirent au bout d’une minute', () => {
    const codes = new CodesDeConnexion()
    const t0 = 1_000_000
    const code = codes.emettre('compte-1', CHALLENGE, t0)
    expect(codes.echanger(code, VERIFIER, t0 + DUREE_CODE_MS + 1)).toBeNull()
  })

  it('ne se devinent pas et ne s’accumulent pas', () => {
    const codes = new CodesDeConnexion(DUREE_CODE_MS, 3)
    const t0 = 1_000_000
    const emis = new Set([1, 2, 3, 4].map(() => codes.emettre('compte-1', CHALLENGE, t0)))
    expect(emis.size).toBe(4)
    expect(codes.taille).toBe(3)
    // Les codes expirés partent à l'émission suivante.
    codes.emettre('compte-2', CHALLENGE, t0 + DUREE_CODE_MS + 1)
    expect(codes.taille).toBe(1)
  })

  it('refusent un code inconnu', () => {
    expect(new CodesDeConnexion().echanger('inconnu', VERIFIER)).toBeNull()
  })
})
