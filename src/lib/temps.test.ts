import { describe, it, expect } from 'vitest'
import { ilYA } from './temps'

const le = (iso: string) => new Date(iso).getTime()
const MAINTENANT = le('2026-10-11T14:00:00Z')

describe('le temps écoulé', () => {
  it('ne compte pas les premières minutes', () => {
    expect(ilYA('2026-10-11T13:59:30Z', MAINTENANT)).toBe("à l'instant")
    expect(ilYA('2026-10-11T13:58:30Z', MAINTENANT)).toBe("à l'instant")
  })

  it('compte en minutes, puis en heures', () => {
    expect(ilYA('2026-10-11T13:40:00Z', MAINTENANT)).toBe('il y a 20 min')
    expect(ilYA('2026-10-11T11:00:00Z', MAINTENANT)).toBe('il y a 3 h')
  })

  it('dit hier, puis compte les jours', () => {
    expect(ilYA('2026-10-10T14:00:00Z', MAINTENANT)).toBe('hier')
    expect(ilYA('2026-10-08T14:00:00Z', MAINTENANT)).toBe('il y a 3 jours')
  })

  it('redonne la date au-delà d’une semaine', () => {
    expect(ilYA('2026-09-28T14:00:00Z', MAINTENANT)).toMatch(/28/)
  })

  it('ne dit jamais un temps négatif, même si l’horloge avance', () => {
    expect(ilYA('2026-10-11T14:05:00Z', MAINTENANT)).toBe("à l'instant")
  })
})
