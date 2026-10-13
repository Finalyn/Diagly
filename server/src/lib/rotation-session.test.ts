import { describe, it, expect } from 'vitest'
import { DELAI_GRACE_ROTATION_MS, dansLeDelaiDeGrace, rotationTolerable, type EtatJeton } from './rotation-session.js'

const maintenant = new Date('2026-10-13T10:00:00Z')
const ilYa = (ms: number) => new Date(maintenant.getTime() - ms)
const dans7Jours = new Date(maintenant.getTime() + 7 * 86_400_000)

/** Une base de jetons en mémoire : l'id désigne la ligne. */
function base(lignes: Record<string, EtatJeton>) {
  return async (id: string) => lignes[id] ?? null
}
const actif = (): EtatJeton => ({ revokedAt: null, replacedById: null, expiresAt: dans7Jours })
const remplacePar = (id: string, ms = 10_000): EtatJeton => ({ revokedAt: ilYa(ms), replacedById: id, expiresAt: dans7Jours })
const revoqueSansRemplacant = (): EtatJeton => ({ revokedAt: ilYa(5_000), replacedById: null, expiresAt: dans7Jours })

describe('la minute de tolérance d’un jeton tout juste remplacé', () => {
  it('ne vaut que pour un jeton remplacé par une rotation, depuis moins d’une minute', () => {
    expect(dansLeDelaiDeGrace(remplacePar('t2', 30_000), maintenant)).toBe(true)
    expect(dansLeDelaiDeGrace(remplacePar('t2', DELAI_GRACE_ROTATION_MS), maintenant)).toBe(true)
    expect(dansLeDelaiDeGrace(remplacePar('t2', DELAI_GRACE_ROTATION_MS + 1), maintenant)).toBe(false)
    // Déconnexion ou mot de passe changé : révoqué sans remplaçant, pas de tolérance.
    expect(dansLeDelaiDeGrace(revoqueSansRemplacant(), maintenant)).toBe(false)
    expect(dansLeDelaiDeGrace(actif(), maintenant)).toBe(false)
  })

  it('accepte le jeton quand la réponse de la rotation s’est perdue', async () => {
    const charger = base({ t2: actif() })
    expect(await rotationTolerable(remplacePar('t2'), charger, maintenant)).toBe(true)
  })

  it('refuse passé la minute, comme une réutilisation', async () => {
    const charger = base({ t2: actif() })
    expect(await rotationTolerable(remplacePar('t2', 61_000), charger, maintenant)).toBe(false)
  })

  it('refuse quand la session a été fermée depuis (déconnexion, mot de passe changé)', async () => {
    expect(await rotationTolerable(remplacePar('t2'), base({ t2: revoqueSansRemplacant() }), maintenant)).toBe(false)
    // La session a encore tourné, puis a été fermée.
    const chaineFermee = base({ t2: remplacePar('t3', 5_000), t3: revoqueSansRemplacant() })
    expect(await rotationTolerable(remplacePar('t2'), chaineFermee, maintenant)).toBe(false)
  })

  it('suit la chaîne quand le remplaçant a lui-même déjà tourné (deux onglets)', async () => {
    const charger = base({ t2: remplacePar('t3', 5_000), t3: actif() })
    expect(await rotationTolerable(remplacePar('t2'), charger, maintenant)).toBe(true)
  })

  it('refuse quand le remplaçant est expiré ou introuvable', async () => {
    const expire = { ...actif(), expiresAt: ilYa(1) }
    expect(await rotationTolerable(remplacePar('t2'), base({ t2: expire }), maintenant)).toBe(false)
    expect(await rotationTolerable(remplacePar('t2'), base({}), maintenant)).toBe(false)
  })

  it('ne suit pas une chaîne sans fin', async () => {
    // Une boucle (impossible en pratique) ne fait pas tourner la vérification indéfiniment.
    const boucle = base({ t2: remplacePar('t3'), t3: remplacePar('t2') })
    expect(await rotationTolerable(remplacePar('t2'), boucle, maintenant)).toBe(false)
  })
})
