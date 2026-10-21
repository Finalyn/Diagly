import { describe, it, expect, afterEach } from 'vitest'
import { dateSuisse, enSuisse, heureSuisse, instantSuisse } from './heure-suisse.js'

describe('l’heure suisse', () => {
  it('lit l’heure d’été (UTC + 2)', () => {
    // Lundi 12 octobre 2026, 7 h 30 UTC.
    expect(enSuisse(new Date('2026-10-12T07:30:00Z'))).toEqual({
      annee: 2026, mois: 10, jour: 12, heure: 9, minute: 30, jourDeSemaine: 1,
    })
    expect(heureSuisse(new Date('2026-10-12T07:30:00Z'))).toBe('09:30')
  })

  it('lit l’heure d’hiver (UTC + 1)', () => {
    expect(heureSuisse(new Date('2026-12-07T08:30:00Z'))).toBe('09:30')
    expect(enSuisse(new Date('2026-12-07T08:30:00Z')).jourDeSemaine).toBe(1)
  })

  it('suit le changement d’heure du dernier dimanche d’octobre', () => {
    // Dimanche 25 octobre 2026 : 3 h d’été redeviennent 2 h d’hiver à 1 h UTC.
    expect(heureSuisse(new Date('2026-10-25T00:30:00Z'))).toBe('02:30')
    expect(heureSuisse(new Date('2026-10-25T01:30:00Z'))).toBe('02:30')
    expect(heureSuisse(new Date('2026-10-25T02:30:00Z'))).toBe('03:30')
  })

  it('passe au jour suivant à minuit à Zurich, pas à Londres', () => {
    // Dimanche 11 octobre, 22 h 15 UTC = lundi 12 octobre, 0 h 15 à Zurich.
    const m = enSuisse(new Date('2026-10-11T22:15:00Z'))
    expect([m.jour, m.heure, m.minute, m.jourDeSemaine]).toEqual([12, 0, 15, 1])
    expect(heureSuisse(new Date('2026-10-11T22:15:00Z'))).toBe('00:15')
  })

  it('numérote les jours de la semaine du lundi (1) au dimanche (7)', () => {
    const jours = [12, 13, 14, 15, 16, 17, 18].map((j) => enSuisse(new Date(Date.UTC(2026, 9, j, 10))).jourDeSemaine)
    expect(jours).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

describe('l’heure suisse sur un serveur réglé ailleurs', () => {
  const avant = process.env.TZ
  afterEach(() => {
    if (avant === undefined) delete process.env.TZ
    else process.env.TZ = avant
  })

  it('ne dépend pas du fuseau du processus', () => {
    const instant = new Date('2026-10-12T07:30:00Z')
    for (const fuseau of ['UTC', 'America/New_York', 'Asia/Tokyo', 'Europe/Zurich']) {
      process.env.TZ = fuseau
      expect(heureSuisse(instant)).toBe('09:30')
      expect(enSuisse(instant).jour).toBe(12)
    }
  })

  it('annonce l’heure de Zurich là où un serveur en UTC disait deux heures de moins', () => {
    process.env.TZ = 'UTC'
    const instant = new Date('2026-10-12T07:30:00Z')
    // Ce qu'affichait l'ancien rappel sur un serveur en UTC.
    expect(instant.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })).toBe('07:30')
    expect(heureSuisse(instant)).toBe('09:30')
  })
})

describe('l’instant d’une heure suisse', () => {
  it('convertit une heure d’été et une heure d’hiver', () => {
    expect(instantSuisse('2026-10-12', '09:30').toISOString()).toBe('2026-10-12T07:30:00.000Z')
    expect(instantSuisse('2026-12-07', '09:30').toISOString()).toBe('2026-12-07T08:30:00.000Z')
  })

  it('tient le jour du changement d’heure', () => {
    expect(instantSuisse('2026-10-25', '10:00').toISOString()).toBe('2026-10-25T09:00:00.000Z')
    expect(instantSuisse('2026-03-29', '10:00').toISOString()).toBe('2026-03-29T08:00:00.000Z')
  })

  it('rend la date suisse d’un instant', () => {
    expect(dateSuisse(new Date('2026-10-27T23:30:00Z'))).toBe('2026-10-28')
  })
})
