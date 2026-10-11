import { describe, it, expect } from 'vitest'
import {
  bilanDigneDEtreEnvoye, canauxVoulus, cestLHeureDuResume, numeroDeSemaine, phraseDuBilan,
} from './notifications-regles.js'

const TOUT = { push: true, email: true }

describe('les canaux d’une notification', () => {
  it('garde toujours le centre, même quand tout le reste est coupé', () => {
    const c = canauxVoulus({ emailDiagnostic: false }, 'diagnostic_cree', TOUT)
    expect(c.centre).toBe(true)
    expect(c.email).toBe(false)
    expect(c.push).toBe(false)
  })

  it('suit le réglage de la personne', () => {
    expect(canauxVoulus({ priorityAlerts: true }, 'priorite_urgente', TOUT))
      .toEqual({ centre: true, push: true, email: true })
    expect(canauxVoulus({ priorityAlerts: false }, 'priorite_urgente', TOUT))
      .toEqual({ centre: true, push: false, email: false })
  })

  it('active par défaut ce qui engage, et seulement cela', () => {
    expect(canauxVoulus(undefined, 'diagnostic_cree', TOUT).email).toBe(true)
    expect(canauxVoulus(undefined, 'priorite_urgente', TOUT).email).toBe(true)
    expect(canauxVoulus(undefined, 'rappel_visite', TOUT).email).toBe(true)
    // Le résumé hebdomadaire ne part que si on l'a demandé.
    expect(canauxVoulus(undefined, 'resume_hebdo', TOUT).email).toBe(false)
    expect(canauxVoulus({ weeklyDigest: true }, 'resume_hebdo', TOUT).email).toBe(true)
  })

  it('ne promet pas un canal que le serveur n’a pas', () => {
    expect(canauxVoulus(undefined, 'rappel_visite', { push: false, email: true }))
      .toEqual({ centre: true, push: false, email: true })
    expect(canauxVoulus(undefined, 'rappel_visite', { push: true, email: false }))
      .toEqual({ centre: true, push: true, email: false })
    expect(canauxVoulus(undefined, 'rappel_visite', { push: false, email: false }))
      .toEqual({ centre: true, push: false, email: false })
  })

  it('traite des réglages absents comme des réglages par défaut', () => {
    expect(canauxVoulus(null, 'diagnostic_cree', TOUT).email).toBe(true)
    expect(canauxVoulus({}, 'diagnostic_cree', TOUT).email).toBe(true)
  })
})

describe('le résumé de la semaine', () => {
  it('dit ce qui a été fait et ce qui vient', () => {
    expect(phraseDuBilan({ diagnostics: 2, releves: 37, visites: 3 }))
      .toBe('2 diagnostics ouverts, 37 ouvrages relevés. 3 visites cette semaine.')
  })

  it('accorde le singulier', () => {
    expect(phraseDuBilan({ diagnostics: 1, releves: 1, visites: 1 }))
      .toBe('1 diagnostic ouvert, 1 ouvrage relevé. 1 visite cette semaine.')
  })

  it('reste lisible quand il ne s’est rien passé', () => {
    expect(phraseDuBilan({ diagnostics: 0, releves: 0, visites: 2 }))
      .toBe('Rien de nouveau la semaine passée. 2 visites cette semaine.')
    expect(phraseDuBilan({ diagnostics: 0, releves: 0, visites: 0 }))
      .toBe('Rien de nouveau la semaine passée. Aucune visite prévue cette semaine.')
  })

  it('ne s’envoie pas quand il n’y a rien à dire', () => {
    expect(bilanDigneDEtreEnvoye({ diagnostics: 0, releves: 0, visites: 0 })).toBe(false)
    expect(bilanDigneDEtreEnvoye({ diagnostics: 0, releves: 0, visites: 1 })).toBe(true)
    expect(bilanDigneDEtreEnvoye({ diagnostics: 0, releves: 4, visites: 0 })).toBe(true)
  })
})

describe('la semaine et son heure', () => {
  it('numérote les semaines à la norme ISO', () => {
    // Le 4 janvier appartient toujours à la première semaine.
    expect(numeroDeSemaine(new Date('2026-01-04T12:00:00'))).toBe('2026-S01')
    expect(numeroDeSemaine(new Date('2026-10-12T08:00:00'))).toBe('2026-S42')
  })

  it('donne la même clé à tous les jours d’une même semaine', () => {
    const lundi = numeroDeSemaine(new Date('2026-10-12T08:00:00'))
    const vendredi = numeroDeSemaine(new Date('2026-10-16T18:00:00'))
    expect(lundi).toBe(vendredi)
  })

  it('n’envoie le résumé que le lundi matin', () => {
    expect(cestLHeureDuResume(new Date('2026-10-12T08:00:00'))).toBe(true)
    expect(cestLHeureDuResume(new Date('2026-10-12T06:00:00'))).toBe(false)
    expect(cestLHeureDuResume(new Date('2026-10-12T14:00:00'))).toBe(false)
    expect(cestLHeureDuResume(new Date('2026-10-13T08:00:00'))).toBe(false)
  })
})
