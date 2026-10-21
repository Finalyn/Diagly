import { describe, it, expect } from 'vitest'
import { occupationsDuFlux } from './agenda-ics.js'
import { bornesDeLaDemo, creneauxLibres, estLibre, quandEnLettres, type ReglesDesDemos } from './demos.js'

const REGLES: ReglesDesDemos = {
  duree: 30, pas: 30, ouverture: '08:00', fermeture: '18:00', jours: [1, 2, 3, 4, 5], preavisHeures: 4, horizonJours: 14,
}

// Le flux tel que le Finalyn Hub l'écrit : heures flottantes à Zurich, journées entières en VALUE=DATE.
const FLUX = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:a@finalyn-hub',
  'DTSTART:20261028T094000',
  'DTEND:20261028T113000',
  'SUMMARY:Réunion',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:b@finalyn-hub',
  'DTSTART;VALUE=DATE:20261027',
  'DTEND;VALUE=DATE:20261028',
  'SUMMARY:Congé',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:c@ailleurs',
  'DTSTART:20261029T070000Z',
  'DTEND:20261029T080000Z',
  'SUMMARY:En UTC',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:d@ailleurs',
  'DTSTART:20261030T080000',
  'DTEND:20261030T090000',
  'STATUS:CANCELLED',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

describe('les occupations d’un agenda .ics', () => {
  const occ = occupationsDuFlux(FLUX)

  it('lit les heures flottantes à Zurich, et l’UTC en UTC', () => {
    expect(new Date(occ[1].debut).toISOString()).toBe('2026-10-28T08:40:00.000Z')
    expect(new Date(occ[2].debut).toISOString()).toBe('2026-10-29T07:00:00.000Z')
  })

  it('occupe une journée entière, fin exclue', () => {
    expect(new Date(occ[0].debut).toISOString()).toBe('2026-10-26T23:00:00.000Z')
    expect(new Date(occ[0].fin).toISOString()).toBe('2026-10-27T23:00:00.000Z')
  })

  it('ignore un événement annulé, et une journée de télétravail', () => {
    expect(occ).toHaveLength(3)
    expect(occupationsDuFlux('BEGIN:VEVENT\nDTSTART;VALUE=DATE:20261103\nDTEND;VALUE=DATE:20261104\nCATEGORIES:teletravail\nEND:VEVENT')).toEqual([])
  })

  it('prolonge au lendemain un événement qui passe minuit', () => {
    const [o] = occupationsDuFlux('BEGIN:VEVENT\nDTSTART:20261109T222000\nDTEND:20261109T045000\nEND:VEVENT')
    expect((o.fin - o.debut) / 3600_000).toBeCloseTo(6.5, 5)
  })
})

describe('les créneaux de démo', () => {
  // Lundi 26 octobre 2026, 9 h à Zurich.
  const lundi = new Date('2026-10-26T08:00:00Z')
  const occupe = { occupations: occupationsDuFlux(FLUX), reservations: [] }
  const jours = creneauxLibres(occupe, lundi, REGLES)

  it('ne propose que les jours ouvrables, de 8 h à 17 h 30', () => {
    expect(jours.every((j) => !['2026-10-31', '2026-11-01'].includes(j.date))).toBe(true)
    expect(jours.find((j) => j.date === '2026-10-30')!.heures).toEqual([
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    ])
  })

  it('respecte le préavis de quatre heures', () => {
    expect(jours[0]).toEqual(expect.objectContaining({ date: '2026-10-26' }))
    expect(jours[0].heures[0]).toBe('13:00')
  })

  it('ferme un jour de congé et les heures d’une réunion', () => {
    expect(jours.some((j) => j.date === '2026-10-27')).toBe(false)
    const mercredi = jours.find((j) => j.date === '2026-10-28')!.heures
    expect(mercredi).not.toContain('09:30')
    expect(mercredi).not.toContain('11:00')
    expect(mercredi).toContain('09:00')
    expect(mercredi).toContain('11:30')
  })

  it('ferme le créneau d’une démo déjà réservée', () => {
    const avecDemo = { ...occupe, reservations: [bornesDeLaDemo('2026-10-30', '10:00', REGLES)] }
    expect(estLibre('2026-10-30', '10:00', avecDemo, lundi, REGLES)).toBe(false)
    expect(estLibre('2026-10-30', '10:30', avecDemo, lundi, REGLES)).toBe(true)
  })

  it('écrit le rendez-vous comme on le dit', () => {
    const { debut, fin } = bornesDeLaDemo('2026-10-28', '14:30', REGLES)
    expect(quandEnLettres(debut, fin)).toBe('mercredi 28 octobre 2026, de 14 h 30 à 15 h 00')
  })
})
