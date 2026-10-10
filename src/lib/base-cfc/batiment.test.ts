import { describe, it, expect } from 'vitest'
import { donneesDuBatiment, donneesManquantes, repartitionDesLogements } from './batiment'
import { quantiteDeBase } from './quantites'

const FICHE = {
  floorArea: 1200, builtArea: 400, terrainArea: 900, perimeter: 90, nbFloors: 4,
  floorHeight: 2.7, nbApartments: 12, nbStaircases: 2, windowPct: 30,
  apartmentTypes: { '2.5': 4, '4.5': 8 },
}

describe('la fiche du bâtiment, traduite pour les quantités', () => {
  it('calcule la façade depuis le périmètre, les étages et la hauteur', () => {
    // 90 × 4 × 2,7 = 972 m².
    expect(donneesDuBatiment(FICHE).surfaceFacade).toBe(972)
  })

  it('ne retient la façade relevée qu’à défaut du calcul', () => {
    expect(donneesDuBatiment({ ...FICHE, perimeter: null, facadeArea: 850 }).surfaceFacade).toBe(850)
    // Le calcul prime : une correction du périmètre doit se voir.
    expect(donneesDuBatiment({ ...FICHE, facadeArea: 850 }).surfaceFacade).toBe(972)
  })

  it('déduit les fenêtres de la façade et de la part vitrée', () => {
    expect(donneesDuBatiment(FICHE).surfaceFenetres).toBe(291.6)
  })

  it('accepte la part vitrée en pourcent comme en fraction', () => {
    expect(donneesDuBatiment({ ...FICHE, windowPct: 0.3 }).surfaceFenetres).toBe(291.6)
  })

  it('déduit la hauteur, les portes d’entrée et les pièces d’eau', () => {
    const d = donneesDuBatiment(FICHE)
    expect(d.hauteur).toBe(10.8)
    expect(d.nombrePortesEntree).toBe(2)
    expect(d.nombrePiecesEau).toBe(24)
  })

  it('rend null et non zéro pour une donnée absente', () => {
    const d = donneesDuBatiment({})
    expect(d.surfacePlancher).toBeNull()
    expect(d.surfaceFacade).toBeNull()
    expect(d.nombreCages).toBeNull()
    expect(d.nombrePortesEntree).toBeNull()
    expect(d.hauteur).toBeNull()
  })

  it('traite un zéro saisi comme une donnée absente', () => {
    // Une façade de zéro mètre carré n'existe pas : c'est un champ pas rempli.
    expect(donneesDuBatiment({ ...FICHE, floorArea: 0 }).surfacePlancher).toBeNull()
  })

  it('laisse une quantité incalculable plutôt que de la mettre à zéro', () => {
    const d = donneesDuBatiment({})
    expect(quantiteDeBase({ baseQuantite: 'surface_facade', coefficient: 1 }, d)).toBeNull()
  })
})

describe('la répartition des logements par typologie', () => {
  it('range chaque typologie dans sa tranche', () => {
    expect(repartitionDesLogements({ '1.5': 2, '2.5': 3, '3.5': 4, '4.5': 5, '5.5': 1 }))
      .toEqual({ p1_5: 2, p2_5: 3, p3_5: 4, p4_5: 5, p5_5plus: 1 })
  })

  it('accepte la virgule et le plus', () => {
    expect(repartitionDesLogements({ '3,5': 2, '5.5+': 3 })).toEqual({ p3_5: 2, p5_5plus: 3 })
  })

  it('compte un trois-pièces avec les trois-et-demi', () => {
    expect(repartitionDesLogements({ '3': 2 })).toEqual({ p3_5: 2 })
  })

  it('additionne les grands logements au-delà de cinq pièces', () => {
    expect(repartitionDesLogements({ '5.5': 2, '6.5': 1 })).toEqual({ p5_5plus: 3 })
  })

  it('ne rend rien quand la répartition n’est pas renseignée', () => {
    expect(repartitionDesLogements(null)).toBeNull()
    expect(repartitionDesLogements({})).toBeNull()
    expect(repartitionDesLogements({ '3.5': 0 })).toBeNull()
  })

  it('compte les stores depuis la répartition, pas depuis le nombre de logements', () => {
    const d = donneesDuBatiment(FICHE)
    // 4 petits logements à un store, 8 grands à deux : 20 stores.
    expect(quantiteDeBase({ baseQuantite: 'regle_stores', coefficient: 1 }, d)).toBe(20)
  })
})

describe('ce qui manque à la fiche', () => {
  it('ne réclame rien quand la fiche est complète', () => {
    expect(donneesManquantes(donneesDuBatiment(FICHE))).toEqual([])
  })

  it('nomme en clair les données à saisir', () => {
    const manque = donneesManquantes(donneesDuBatiment({ ...FICHE, nbStaircases: null, floorArea: null }))
    expect(manque).toEqual(['surface de plancher', "nombre de cages d'escalier", "nombre de portes d'entrée"])
  })

  it('ne réclame pas la surface de parking, qui est facultative', () => {
    expect(donneesManquantes(donneesDuBatiment(FICHE))).not.toContain('surface de parking')
  })
})
