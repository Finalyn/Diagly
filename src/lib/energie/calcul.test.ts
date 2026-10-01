import { describe, it, expect } from 'vitest'
import {
  besoinDeBase,
  calculer,
  calculerEnveloppe,
  appliquerMesures,
  comparer,
  classeEnveloppe,
  type EntreeEnergie,
  type Mesure,
  type Etat,
} from './calcul'

/** Tous les éléments d'enveloppe dans le même état, sans rénovation. */
const enveloppeUniforme = (etat: Etat) => ({
  toiture: { etat },
  facades: { etat },
  fenetres: { etat },
  sol: { etat },
  ventilation: { etat },
})

/** Immeuble collectif de 1965, jamais rénové, mazout ancien fatigué. */
const immeuble1965: EntreeEnergie = {
  anneeConstruction: 1965,
  categorie: 'COLLECTIF',
  sre: 1000,
  agentChauffage: 'MAZOUT_ANCIEN',
  etatProduction: 3,
  photovoltaiqueKwc: null,
  elements: enveloppeUniforme(3),
}

/** Villa de 2010, enveloppe en bon état, pompe à chaleur air-eau. */
const villa2010: EntreeEnergie = {
  anneeConstruction: 2010,
  categorie: 'INDIVIDUEL',
  sre: 180,
  agentChauffage: 'PAC_AIR_EAU',
  etatProduction: 1,
  photovoltaiqueKwc: null,
  elements: enveloppeUniforme(1),
}

describe('besoin de chauffage de base', () => {
  it('suit les bornes de période', () => {
    expect(besoinDeBase(1900).valeur).toBe(150)
    expect(besoinDeBase(1919).valeur).toBe(150)
    expect(besoinDeBase(1920).valeur).toBe(160)
    expect(besoinDeBase(1965).valeur).toBe(160)
    expect(besoinDeBase(1976).valeur).toBe(120)
    expect(besoinDeBase(2010).valeur).toBe(50)
    expect(besoinDeBase(2026).valeur).toBe(35)
  })
})

describe('cas 1 : immeuble de 1965 non rénové', () => {
  const r = calculer(immeuble1965)

  it("calcule l'enveloppe", () => {
    // 160 de base, toutes les parts en état 3 (coefficient 1.15) : 160 x 1.15.
    expect(r.enveloppe.qh).toBeCloseTo(184, 5)
    expect(r.enveloppe.ratio).toBeCloseTo(4.6, 5)
    expect(r.enveloppe.classe).toBe('G')
  })

  it('dégrade le rendement parce que la production est en état 3', () => {
    // Mazout ancien 0.80, dégradé de 10 %.
    expect(r.global.rendement).toBeCloseTo(0.72, 5)
    expect(r.global.energieFinale).toBeCloseTo((184 + 21) / 0.72, 4)
    expect(r.global.classe).toBe('G')
  })

  it('rend la trace du calcul, ligne par ligne', () => {
    // Une estimation qu'on ne peut pas ouvrir ne se discute pas avec un client.
    expect(r.enveloppe.lignes.length).toBeGreaterThanOrEqual(8)
    expect(r.enveloppe.lignes[0].libelle).toBe('Besoin de chauffage de base')
    expect(r.global.lignes.some((l) => l.libelle === 'Énergie pondérée')).toBe(true)
  })
})

describe('cas 2 : le même immeuble isolé entièrement, avec une pompe à chaleur', () => {
  const mesures: Mesure[] = [
    { type: 'ISOLER', element: 'toiture' },
    { type: 'ISOLER', element: 'facades' },
    { type: 'ISOLER', element: 'fenetres' },
    { type: 'ISOLER', element: 'sol' },
    { type: 'ISOLER', element: 'ventilation' },
    { type: 'PRODUCTION', agent: 'PAC_SOL_EAU' },
  ]
  const apres = calculer(appliquerMesures(immeuble1965, mesures))

  it('ramène le besoin au niveau de la rénovation', () => {
    // Chaque élément rénové prend la base de 2020, soit 35, en état 1.
    expect(apres.enveloppe.qh).toBeCloseTo(35, 5)
    expect(apres.enveloppe.classe).toBe('B')
  })

  it('profite du rendement de la pompe à chaleur, sans dégradation', () => {
    expect(apres.global.rendement).toBeCloseTo(3.8, 5)
    expect(apres.global.classe).toBe('A')
  })

  it('chiffre le gain par rapport à avant', () => {
    const avant = calculer(immeuble1965)
    const d = comparer(avant, apres, immeuble1965.sre)
    expect(d.gainPourcent).toBeGreaterThan(80)
    expect(d.economieParAn).toBeGreaterThan(0)
    // L'économie annuelle est bien la différence au mètre carré, multipliée par la SRE.
    expect(d.economieParAn).toBe(
      Math.round((avant.global.energiePonderee - apres.global.energiePonderee) * 1000),
    )
  })

  it("ne modifie pas l'entrée d'origine", () => {
    // Le recalcul à chaque case cochée repart toujours de l'état réel du bâtiment.
    expect(immeuble1965.elements.facades.etat).toBe(3)
    expect(immeuble1965.agentChauffage).toBe('MAZOUT_ANCIEN')
  })
})

describe('cas 3 : villa de 2010', () => {
  const r = calculer(villa2010)

  it('calcule enveloppe et global', () => {
    expect(r.enveloppe.qh).toBeCloseTo(50, 5)
    expect(r.enveloppe.ratio).toBeCloseTo(1.25, 5)
    expect(r.enveloppe.classe).toBe('C')
    expect(r.global.energieFinale).toBeCloseTo((50 + 14) / 2.8, 4)
    expect(r.global.classe).toBe('B')
  })
})

describe('rénovation partielle', () => {
  it("n'améliore que la part de l'élément rénové", () => {
    const partiel: EntreeEnergie = {
      ...immeuble1965,
      elements: { ...enveloppeUniforme(3), toiture: { etat: 1, anneeRenovation: 2020 } },
    }
    // Toiture : 20 % x 1.00 x 35 = 7. Le reste : 80 % x 1.15 x 160 = 147.2.
    expect(calculerEnveloppe(partiel).qh).toBeCloseTo(7 + 147.2, 4)
  })
})

describe('photovoltaïque', () => {
  it("retranche l'autoconsommation, rapportée à la SRE", () => {
    const sans = calculer(villa2010)
    const avec = calculer({ ...villa2010, photovoltaiqueKwc: 10 })
    // 10 kWc x 950 kWh x 30 % = 2850 kWh, sur 180 m2.
    expect(avec.global.apportPv).toBeCloseTo(2850 / 180, 4)
    expect(avec.global.energiePonderee).toBeLessThan(sans.global.energiePonderee)
  })

  it('ne descend jamais sous zéro', () => {
    const enorme = calculer({ ...villa2010, photovoltaiqueKwc: 500 })
    expect(enorme.global.energiePonderee).toBe(0)
  })

  it('ignore le photovoltaïque sans SRE, plutôt que de diviser par zéro', () => {
    const sansSre = calculer({ ...villa2010, sre: 0, photovoltaiqueKwc: 10 })
    expect(sansSre.global.apportPv).toBe(0)
    expect(Number.isFinite(sansSre.global.energiePonderee)).toBe(true)
  })
})

describe('seuils de classe', () => {
  it("place le ratio dans la bonne lettre, bornes comprises", () => {
    expect(classeEnveloppe(0.5)).toBe('A')
    expect(classeEnveloppe(0.51)).toBe('B')
    expect(classeEnveloppe(1.0)).toBe('B')
    expect(classeEnveloppe(2.0)).toBe('D')
    expect(classeEnveloppe(2.9)).toBe('F')
    expect(classeEnveloppe(2.91)).toBe('G')
    expect(classeEnveloppe(99)).toBe('G')
  })
})

describe('garde-fous', () => {
  it('signale les tables encore provisoires', () => {
    // Tant que ces valeurs ne sont pas celles de Chloé, l'interface doit le dire.
    const r = calculer(villa2010)
    expect(r.provisoire).toContain('ponderation')
    expect(r.provisoire).toContain('seuilsGlobal')
  })

  it('refuse un agent énergétique inconnu plutôt que de rendre un chiffre', () => {
    expect(() => calculer({ ...villa2010, agentChauffage: 'CHARBON' })).toThrow(/inconnu/i)
  })
})
