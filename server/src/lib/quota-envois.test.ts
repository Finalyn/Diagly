import { describe, it, expect } from 'vitest'
import { LIMITES_ENVOI, QuotaEnvois, messageDeQuota, verifierQuota } from './quota-envois.js'

const MINUTE = 60_000
const HEURE = 60 * MINUTE
const T0 = Date.UTC(2026, 9, 13, 8, 0)

/** `n` envois au même instant. */
const fois = (n: number, t: number) => Array.from({ length: n }, () => t)

describe('le quota d’envoi', () => {
  it('est de 30 emails par heure et 100 par jour', () => {
    expect(LIMITES_ENVOI.map((l) => [l.fenetreMs, l.max])).toEqual([[HEURE, 30], [24 * HEURE, 100]])
  })

  it('laisse passer un usage normal', () => {
    expect(verifierQuota([], T0, 5)).toEqual({ ok: true })
    expect(verifierQuota(fois(25, T0 - 10 * MINUTE), T0, 5)).toEqual({ ok: true })
  })

  it('refuse ce qui dépasse l’heure, et dit quand réessayer', () => {
    const v = verifierQuota(fois(28, T0 - 10 * MINUTE), T0, 3)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.limite.libelle).toBe('par heure')
    // Les plus anciens sortent de la fenêtre dans 50 minutes.
    expect(v.attenteMs).toBe(50 * MINUTE)
  })

  it('n’attend que le départ des envois en trop', () => {
    // 20 envois il y a 50 minutes, 10 il y a 5 minutes : pour en faire 5 de
    // plus, il suffit que 5 des plus anciens sortent, dans 10 minutes.
    const envois = [...fois(10, T0 - 5 * MINUTE), ...fois(20, T0 - 50 * MINUTE)]
    const v = verifierQuota(envois, T0, 5)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.attenteMs).toBe(10 * MINUTE)
  })

  it('oublie les envois sortis de la fenêtre', () => {
    expect(verifierQuota(fois(30, T0 - HEURE - 1), T0, 30)).toEqual({ ok: true })
  })

  it('tient le plafond du jour, même heure par heure sous la limite', () => {
    // 4 vagues de 25 envois dans la journée : 100, plus rien jusqu’à demain.
    const envois = [1, 4, 7, 10].flatMap((h) => fois(25, T0 - h * HEURE))
    const v = verifierQuota(envois, T0, 1)
    expect(v.ok).toBe(false)
    if (v.ok) return
    expect(v.limite.libelle).toBe('par jour')
    // La plus ancienne vague (il y a 10 heures) sort dans 14 heures.
    expect(v.attenteMs).toBe(14 * HEURE)
  })

  it('refuse sans délai un mail qui dépasse la limite à lui seul', () => {
    const v = verifierQuota([], T0, 31)
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.attenteMs).toBeNull()
  })
})

describe('le compteur par compte', () => {
  it('compte chaque destinataire, et refuse au-delà', () => {
    const q = new QuotaEnvois()
    expect(q.reserver('a', 20, T0).ok).toBe(true)
    expect(q.reserver('a', 10, T0 + MINUTE).ok).toBe(true)
    expect(q.reserver('a', 1, T0 + 2 * MINUTE).ok).toBe(false)
  })

  it('tient un compte par utilisateur', () => {
    const q = new QuotaEnvois()
    expect(q.reserver('a', 30, T0).ok).toBe(true)
    expect(q.reserver('b', 30, T0).ok).toBe(true)
    expect(q.reserver('a', 1, T0).ok).toBe(false)
  })

  it('ne retient rien d’un envoi refusé : tout ou rien', () => {
    const q = new QuotaEnvois()
    expect(q.reserver('a', 25, T0).ok).toBe(true)
    // 10 de plus : refusé en bloc, aucun des 10 n’est compté...
    expect(q.reserver('a', 10, T0).ok).toBe(false)
    // ... si bien que 5 passent encore.
    expect(q.reserver('a', 5, T0).ok).toBe(true)
  })

  it('rouvre après une heure', () => {
    const q = new QuotaEnvois()
    expect(q.reserver('a', 30, T0).ok).toBe(true)
    expect(q.reserver('a', 1, T0 + HEURE - 1).ok).toBe(false)
    expect(q.reserver('a', 30, T0 + HEURE).ok).toBe(true)
  })
})

describe('le message de refus', () => {
  it('dit la limite, le délai et l’autre voie', () => {
    const v = verifierQuota(fois(30, T0 - 48 * MINUTE), T0, 1)
    if (v.ok) throw new Error('refus attendu')
    expect(messageDeQuota(v, 1)).toBe(
      "Limite d'envoi atteinte : 30 emails par heure depuis Diagly. Réessayez dans 12 minutes, ou ouvrez le mail dans votre messagerie.",
    )
  })

  it('compte en heures au-delà d’une heure d’attente', () => {
    const v = verifierQuota(fois(100, T0 - 10 * HEURE), T0, 1)
    if (v.ok) throw new Error('refus attendu')
    expect(messageDeQuota(v, 1)).toMatch(/^Limite d'envoi atteinte : 100 emails par jour depuis Diagly\. Réessayez dans 14 heures,/)
  })

  it('renvoie à la messagerie un mail trop gros pour Diagly', () => {
    const v = verifierQuota([], T0, 40)
    if (v.ok) throw new Error('refus attendu')
    expect(messageDeQuota(v, 40)).toMatch(/^Ce mail compte 40 destinataires, au-delà des 30 emails par heure/)
  })
})
