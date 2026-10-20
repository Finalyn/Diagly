import { describe, it, expect } from 'vitest'
import {
  bilanDigneDEtreEnvoye, canauxVoulus, cestLHeureDuResume, cleDuResume, destinatairesDuResume,
  numeroDeSemaine, phraseDuBilan, palierDeRelance, cestLHeureDesRelances, phraseDeRelance,
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

// Les instants sont écrits en UTC (« Z ») : les tests ne dépendent pas du
// fuseau de la machine qui les lance, pas plus que les règles du serveur.
describe('la semaine et son heure', () => {
  it('numérote les semaines à la norme ISO', () => {
    // Le 4 janvier appartient toujours à la première semaine.
    expect(numeroDeSemaine(new Date('2026-01-04T12:00:00Z'))).toBe('2026-S01')
    expect(numeroDeSemaine(new Date('2026-10-12T06:00:00Z'))).toBe('2026-S42')
    // Le 31 décembre 2026, un jeudi, est dans la semaine 53.
    expect(numeroDeSemaine(new Date('2026-12-31T12:00:00Z'))).toBe('2026-S53')
  })

  it('donne la même clé à tous les jours d’une même semaine', () => {
    const lundi = numeroDeSemaine(new Date('2026-10-12T06:00:00Z'))
    const vendredi = numeroDeSemaine(new Date('2026-10-16T16:00:00Z'))
    expect(lundi).toBe(vendredi)
  })

  it('compte la semaine au calendrier suisse, pas à celui du serveur', () => {
    // Dimanche 11 octobre, 22 h 30 UTC = lundi 12 octobre, 0 h 30 à Zurich.
    expect(numeroDeSemaine(new Date('2026-10-11T22:30:00Z'))).toBe('2026-S42')
    // Dimanche 11 octobre, 21 h 30 UTC = 23 h 30 à Zurich : encore la S41.
    expect(numeroDeSemaine(new Date('2026-10-11T21:30:00Z'))).toBe('2026-S41')
  })

  it('n’envoie le résumé que le lundi matin, heure suisse', () => {
    // Lundi 12 octobre 2026 (heure d’été, Zurich = UTC + 2).
    expect(cestLHeureDuResume(new Date('2026-10-12T06:00:00Z'))).toBe(true) // 8 h
    expect(cestLHeureDuResume(new Date('2026-10-12T05:00:00Z'))).toBe(true) // 7 h pile
    expect(cestLHeureDuResume(new Date('2026-10-12T04:59:00Z'))).toBe(false) // 6 h 59
    expect(cestLHeureDuResume(new Date('2026-10-12T09:59:00Z'))).toBe(true) // 11 h 59
    // 10 h UTC = midi à Zurich : un serveur en UTC croyait qu’il était 10 h.
    expect(cestLHeureDuResume(new Date('2026-10-12T10:00:00Z'))).toBe(false)
    expect(cestLHeureDuResume(new Date('2026-10-12T12:00:00Z'))).toBe(false)
    expect(cestLHeureDuResume(new Date('2026-10-13T06:00:00Z'))).toBe(false) // mardi
    // Hiver : lundi 7 décembre, Zurich = UTC + 1.
    expect(cestLHeureDuResume(new Date('2026-12-07T06:00:00Z'))).toBe(true) // 7 h
    expect(cestLHeureDuResume(new Date('2026-12-07T05:30:00Z'))).toBe(false) // 6 h 30
    expect(cestLHeureDuResume(new Date('2026-12-07T10:30:00Z'))).toBe(true) // 11 h 30
    expect(cestLHeureDuResume(new Date('2026-12-07T11:00:00Z'))).toBe(false) // midi
  })
})

describe('le résumé ne part qu’une fois', () => {
  const demande = { notifications: { weeklyDigest: true } }

  it('garde la même clé à chaque passe de la matinée', () => {
    const cles = new Set<string>()
    for (let h = 0; h < 24; h++) {
      const passe = new Date(Date.UTC(2026, 9, 12, h, 7))
      if (cestLHeureDuResume(passe)) cles.add(cleDuResume(passe))
    }
    expect([...cles]).toEqual(['resume-2026-S42'])
  })

  it('change de clé d’une semaine à l’autre', () => {
    expect(cleDuResume(new Date('2026-10-19T06:00:00Z'))).toBe('resume-2026-S43')
  })

  it('ne part qu’à ceux qui l’ont demandé', () => {
    const comptes = [
      { id: 'a', preferences: demande },
      { id: 'b', preferences: { notifications: { weeklyDigest: false } } },
      { id: 'c', preferences: null },
      { id: 'd', preferences: { notifications: {} } },
    ]
    expect(destinatairesDuResume(comptes, new Set())).toEqual(['a'])
  })

  it('ne repart pas à qui l’a déjà reçu cette semaine', () => {
    const comptes = [{ id: 'a', preferences: demande }, { id: 'b', preferences: demande }]
    expect(destinatairesDuResume(comptes, new Set(['a']))).toEqual(['b'])
    expect(destinatairesDuResume(comptes, new Set(['a', 'b']))).toEqual([])
  })

  it('part une fois quand la passe horaire tourne toute la matinée', () => {
    // Ce que fait le planificateur : une passe par heure, plus celle du
    // démarrage, et la cloche qui garde la trace de ce qui est parti.
    const cloche = new Set<string>()
    const comptes = [{ id: 'a', preferences: demande }]
    let envois = 0
    const passes = [...Array.from({ length: 24 }, (_, h) => Date.UTC(2026, 9, 12, h, 7)), Date.UTC(2026, 9, 12, 8, 30)]
    for (const t of passes) {
      const maintenant = new Date(t)
      if (!cestLHeureDuResume(maintenant)) continue
      const cle = cleDuResume(maintenant)
      const dejaServis = new Set([...cloche].filter((x) => x.endsWith(`|${cle}`)).map((x) => x.split('|')[0]))
      for (const id of destinatairesDuResume(comptes, dejaServis)) {
        envois++
        cloche.add(`${id}|${cle}`)
      }
    }
    expect(envois).toBe(1)
  })
})

describe('les rappels d’absence', () => {
  it('se taisent avant une semaine d’absence', () => {
    expect(palierDeRelance(0)).toBeNull()
    expect(palierDeRelance(6)).toBeNull()
  })

  it('partent après une semaine, puis après trois, et plus jamais ensuite', () => {
    expect(palierDeRelance(7)).toBe(7)
    expect(palierDeRelance(20)).toBe(7)
    expect(palierDeRelance(21)).toBe(21)
    expect(palierDeRelance(400)).toBe(21)
  })

  it('sont actifs par défaut, et se coupent par leur réglage', () => {
    expect(canauxVoulus({}, 'relance_absence', TOUT).push).toBe(true)
    expect(canauxVoulus({ relances: false }, 'relance_absence', TOUT).push).toBe(false)
  })

  it('arrivent en semaine, le matin, à l’heure suisse', () => {
    // Mardi 13 octobre 2026, 7 h 30 UTC = 9 h 30 à Zurich (heure d’été).
    expect(cestLHeureDesRelances(new Date('2026-10-13T07:30:00Z'))).toBe(true)
    // 6 h 30 à Zurich : trop tôt.
    expect(cestLHeureDesRelances(new Date('2026-10-13T04:30:00Z'))).toBe(false)
    // Samedi 17 octobre, 9 h 30 à Zurich : pas le week-end.
    expect(cestLHeureDesRelances(new Date('2026-10-17T07:30:00Z'))).toBe(false)
    // Hiver : lundi 7 décembre, 9 h 30 à Zurich = 8 h 30 UTC.
    expect(cestLHeureDesRelances(new Date('2026-12-07T08:30:00Z'))).toBe(true)
  })

  it('nomment le dossier qui attend', () => {
    const p = phraseDeRelance({ nom: 'Chalet Belalp', releves: 13 })
    expect(p.titre).toBe('Le relevé de « Chalet Belalp » vous attend')
    expect(p.texte).toBe('13 ouvrages déjà relevés. Reprenez où vous en étiez.')
    expect(phraseDeRelance({ nom: 'Villa', releves: 1 }).texte).toBe('1 ouvrage déjà relevé. Reprenez où vous en étiez.')
    expect(phraseDeRelance({ nom: 'Villa', releves: 0 }).texte).toMatch(/visite peut commencer/)
  })

  it('proposent un nouveau dossier quand rien n’est en cours', () => {
    expect(phraseDeRelance(null).titre).toBe('Un bâtiment à diagnostiquer ?')
  })
})

describe('la fin d’une analyse par l’IA', () => {
  it('prévient sur l’appareil et dans la cloche, jamais par courriel', () => {
    expect(canauxVoulus(undefined, 'analyse_terminee', TOUT)).toEqual({ centre: true, push: true, email: false })
  })
  it('se tait sur l’appareil quand on l’a coupée, mais reste dans la cloche', () => {
    expect(canauxVoulus({ analysesIA: false }, 'analyse_terminee', TOUT)).toEqual({ centre: true, push: false, email: false })
  })
})
