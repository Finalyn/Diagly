import { describe, it, expect } from 'vitest'
import {
  aVerifier, champsDepuisPlans, comptagesDepuisPlans, elementAVerifier, GRANDEURS_DES_PLANS, lieuDeLaPage, valeursInitiales,
  type ValeursRetenues,
} from './demarrage-plans'
import type { CleGrandeurPlans, ElementCompteLu, GrandeurLue, LecturePlans } from './api-types'

const G = (valeur: number | null, extra: Partial<GrandeurLue> = {}): GrandeurLue =>
  ({ valeur, page: 'F1 p. 1', methode: 'cote lue', confiance: 'haute', remarque: null, ...extra })

const lecture = (): LecturePlans => ({
  estUnJeuDePlans: true,
  projet: { nom: null, adresse: null, npa: null, localite: null, canton: null },
  pages: [],
  grandeurs: {
    emprise: G(226.3), perimetre: G(61.3), etagesHorsSol: G(4), sousSols: G(1), hauteurEtage: G(2.85),
    hauteurTotale: G(13.2), surfacePlancher: G(905), surfaceFacade: G(700), surfaceFenetres: G(175),
    tauxVitrage: G(25), logements: G(8), cagesEscalier: G(1), surfaceToiture: G(230),
  },
  typeToit: { valeur: 'PLATE', page: null, methode: 'cote lue', confiance: 'haute', remarque: null },
  typologies: { valeur: { '3.5': 4, '4.5': 4 }, page: null, methode: 'surface imprimée', confiance: 'haute', remarque: null },
  facadesParOrientation: [],
  remarques: null,
})

const avec = (patch: Partial<Record<CleGrandeurPlans, number | null>>): ValeursRetenues => {
  const v = valeursInitiales(lecture())
  return { ...v, grandeurs: { ...v.grandeurs, ...patch } }
}

describe('champsDepuisPlans', () => {
  it('remplit les champs du dossier sous leurs noms exacts', () => {
    expect(champsDepuisPlans(valeursInitiales(lecture()))).toEqual({
      builtArea: 226.3,
      perimeter: 61.3,
      nbFloors: 4,
      floorHeight: 2.85,
      floorArea: 905,
      facadeArea: 700,
      windowPct: 0.25,
      nbApartments: 8,
      nbStaircases: 1,
      roofType: 'PLATE',
      apartmentTypes: { '3.5': 4, '4.5': 4 },
    })
  })

  it('ne range nulle part les grandeurs données pour information', () => {
    const c = champsDepuisPlans(valeursInitiales(lecture())) as Record<string, unknown>
    for (const cle of ['sousSols', 'hauteurTotale', 'surfaceFenetres', 'surfaceToiture']) expect(c[cle]).toBeUndefined()
    expect(GRANDEURS_DES_PLANS.filter((g) => !g.champ).map((g) => g.cle)).toEqual(['sousSols', 'hauteurTotale', 'surfaceFenetres', 'surfaceToiture'])
  })

  it('déduit le taux de vitrage des surfaces quand il manque', () => {
    expect(champsDepuisPlans(avec({ tauxVitrage: null })).windowPct).toBe(0.25)
    expect(champsDepuisPlans(avec({ tauxVitrage: null, surfaceFenetres: null })).windowPct).toBeUndefined()
  })

  it('laisse vide ce que le dossier refuserait', () => {
    const c = champsDepuisPlans(avec({ etagesHorsSol: 4.5, emprise: -3, logements: 2.5, hauteurEtage: 0 }))
    expect(c.nbFloors).toBeUndefined()
    expect(c.builtArea).toBeUndefined()
    expect(c.nbApartments).toBeUndefined()
    expect(c.floorHeight).toBeUndefined()
  })

  it('garde zéro logement ou zéro cage, qui sont des réponses', () => {
    const c = champsDepuisPlans(avec({ logements: 0, cagesEscalier: 0 }))
    expect(c.nbApartments).toBe(0)
    expect(c.nbStaircases).toBe(0)
  })

  it('ne garde que les typologies que le serveur accepte', () => {
    const v = { ...valeursInitiales(lecture()), typologies: { '3.5': 4, 'studio': 2, '2.5': 1.5 } }
    expect(champsDepuisPlans(v).apartmentTypes).toEqual({ '3.5': 4 })
  })
})

describe('lieuDeLaPage', () => {
  const noms = ['rez.pdf', 'facade-sud.jpg']
  it('remplace le repère par le nom du fichier', () => {
    expect(lieuDeLaPage('F1 p. 3', noms)).toBe('rez.pdf, p. 3')
    // Une image n'a qu'une page.
    expect(lieuDeLaPage('F2 p. 1', noms)).toBe('facade-sud.jpg')
  })
  it('laisse tel quel un repère inconnu', () => {
    expect(lieuDeLaPage('F5 p. 1', noms)).toBe('F5 p. 1')
    expect(lieuDeLaPage('Coupe A-A', noms)).toBe('Coupe A-A')
    expect(lieuDeLaPage(null, noms)).toBeNull()
  })
})

describe('aVerifier', () => {
  it('signale une estimation ou une confiance basse, pas une valeur absente', () => {
    expect(aVerifier(G(3, { methode: 'estimation', confiance: 'basse' }))).toBe(true)
    expect(aVerifier(G(3, { confiance: 'basse' }))).toBe(true)
    expect(aVerifier(G(3))).toBe(false)
    expect(aVerifier(G(null, { confiance: 'basse' }))).toBe(false)
  })
})

describe('comptagesDepuisPlans', () => {
  const E = (nombre: number | null, extra: Partial<ElementCompteLu> = {}): ElementCompteLu => ({
    nombre, surface: null, pages: ['F1 p. 2'], methode: 'compté et multiplié par les étages identiques', confiance: 'haute',
    detail: '2 par palier × 3 étages = 6', remarque: null, ...extra,
  })
  const lu = (): LecturePlans => ({
    ...lecture(),
    elements: { porte_paliere: E(6), fenetre: E(36, { surface: 60.5, detail: '12 par étage × 3 = 36' }), balcon: E(null, { detail: 'balcons non dessinés' }) },
  })

  it('reprend chaque compte lu, avec sa source, ses pages et son calcul, à vérifier', () => {
    const c = comptagesDepuisPlans(lu(), valeursInitiales(lu()), ['etage-type.pdf'])
    expect(Object.keys(c)).toEqual(['porte_paliere', 'fenetre'])
    expect(c.porte_paliere).toMatchObject({
      nombre: 6, source: 'plans', detail: '2 par palier × 3 étages = 6', pages: ['etage-type.pdf, p. 2'],
      confiance: 'haute', valide: false, surface: null,
    })
    expect(c.fenetre?.surface).toBe(60.5)
  })

  it('tient pour relu un compte confirmé, et pour corrigé un compte changé', () => {
    const v = valeursInitiales(lu())
    const c = comptagesDepuisPlans(lu(), { ...v, confirmes: ['porte_paliere'], elements: { ...v.elements, fenetre: 30 } }, [])
    expect(c.porte_paliere?.valide).toBe(true)
    expect(c.fenetre).toMatchObject({
      nombre: 30, source: 'plans', valide: true, confiance: null, surface: null,
      detail: 'Corrigé à la relecture ; lu sur les plans : 36',
    })
  })

  it('fait d’un nombre que les plans n’avaient pas donné une saisie', () => {
    const v = valeursInitiales(lu())
    const c = comptagesDepuisPlans(lu(), { ...v, elements: { ...v.elements, balcon: 4 } }, [])
    expect(c.balcon).toMatchObject({ nombre: 4, source: 'saisie', valide: true, detail: null, pages: [] })
  })

  it('n’enregistre rien d’une lecture d’avant les comptages', () => {
    expect(comptagesDepuisPlans(lecture(), valeursInitiales(lecture()), [])).toEqual({})
  })

  it('signale une estimation ou une confiance basse', () => {
    expect(elementAVerifier(E(6, { methode: 'estimation', confiance: 'basse' }))).toBe(true)
    expect(elementAVerifier(E(6))).toBe(false)
    expect(elementAVerifier(E(null, { confiance: 'basse' }))).toBe(false)
  })
})
