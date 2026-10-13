import { describe, it, expect } from 'vitest'
import { ECHECS_PAR_COMPTE, ESSAIS_PAR_TICKET, EssaisDeCode, FENETRE_COMPTE_MS } from './essais-code.js'

const t0 = 1_000_000
const expire = t0 + 10 * 60_000

/** Un essai raté, du début à la fin, comme le fait la route. */
function rater(essais: EssaisDeCode, ticket: string, compte: string, maintenant = t0) {
  const refus = essais.commencer(ticket, compte, expire, maintenant)
  if (!refus) essais.echec(ticket, compte, maintenant)
  return refus
}

describe('les essais de code 2FA', () => {
  it('laissent cinq essais par ticket, puis le ticket ne sert plus', () => {
    const essais = new EssaisDeCode()
    for (let i = 0; i < ESSAIS_PAR_TICKET; i++) expect(rater(essais, 'ticket', 'compte')).toBeNull()
    expect(essais.commencer('ticket', 'compte', expire, t0)).toBe('epuise')
    expect(essais.utilisable('ticket')).toBe(false)
  })

  it('disent combien d’essais il reste', () => {
    const essais = new EssaisDeCode()
    essais.commencer('ticket', 'compte', expire, t0)
    expect(essais.echec('ticket', 'compte', t0)).toBe(ESSAIS_PAR_TICKET - 1)
  })

  it('rendent le ticket inutilisable après un succès', () => {
    const essais = new EssaisDeCode()
    expect(essais.commencer('ticket', 'compte', expire, t0)).toBeNull()
    expect(essais.reussite('ticket', 'compte', expire)).toBe(true)
    expect(essais.commencer('ticket', 'compte', expire, t0)).toBe('utilise')
    expect(essais.utilisable('ticket')).toBe(false)
  })

  it('n’ouvrent qu’une session pour deux requêtes simultanées avec le bon code', () => {
    const essais = new EssaisDeCode()
    expect(essais.commencer('ticket', 'compte', expire, t0)).toBeNull()
    expect(essais.commencer('ticket', 'compte', expire, t0)).toBeNull()
    expect(essais.reussite('ticket', 'compte', expire)).toBe(true)
    expect(essais.reussite('ticket', 'compte', expire)).toBe(false)
  })

  it('limitent les échecs par compte, tous tickets confondus', () => {
    const essais = new EssaisDeCode()
    // Une nouvelle connexion donne un nouveau ticket : sans limite par compte, cinq essais de plus à chaque fois.
    for (let i = 0; i < ECHECS_PAR_COMPTE; i++) expect(rater(essais, `ticket-${Math.floor(i / 5)}`, 'compte')).toBeNull()
    expect(essais.commencer('ticket-neuf', 'compte', expire, t0)).toBe('compte')
    // Un autre compte n'est pas touché.
    expect(essais.commencer('ticket-autre', 'autre-compte', expire, t0)).toBeNull()
    // Un quart d'heure plus tard, c'est reparti.
    const plusTard = t0 + FENETRE_COMPTE_MS
    expect(essais.commencer('ticket-neuf', 'compte', plusTard + 10 * 60_000, plusTard)).toBeNull()
  })

  it('oublient les échecs du compte après un succès', () => {
    const essais = new EssaisDeCode()
    for (let i = 0; i < ECHECS_PAR_COMPTE - 1; i++) rater(essais, `ticket-${Math.floor(i / 5)}`, 'compte')
    essais.commencer('ticket-bon', 'compte', expire, t0)
    essais.reussite('ticket-bon', 'compte', expire)
    for (let i = 0; i < 3; i++) expect(rater(essais, 'ticket-suivant', 'compte')).toBeNull()
  })

  it('retirent un ticket remplacé par un nouveau code', () => {
    const essais = new EssaisDeCode()
    expect(essais.utilisable('ticket')).toBe(true)
    essais.invalider('ticket', expire)
    expect(essais.commencer('ticket', 'compte', expire, t0)).toBe('utilise')
  })

  it('oublient les tickets expirés', () => {
    const essais = new EssaisDeCode()
    essais.commencer('ticket', 'compte', expire, t0)
    essais.reussite('ticket', 'compte', expire)
    // Le ticket a expiré : sa trace part (le JWT est de toute façon refusé à ce stade).
    essais.commencer('autre', 'compte', expire + 20 * 60_000, expire + 1)
    expect(essais.utilisable('ticket')).toBe(true)
  })
})
