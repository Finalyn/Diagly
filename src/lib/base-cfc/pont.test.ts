import { describe, it, expect } from 'vitest'
import { ouvrageDeLArticle, prixDeLEtat, travauxDeLEtat, uniteEnClair } from './pont'
import type { ApiArticle } from '../api-types'

const A015: ApiArticle = {
  id: 'A015', cfcCode: '226.1', nom: 'Façade crépie non isolée', domaineRapport: 'Extérieur',
  groupeAlternatives: 'Revêtement de façade', echafaudage: true, uniteEntretien: 'm2',
  uniteRemplacement: 'm2', baseQuantite: 'surface_facade', indicationQuantite: null, coefficient: 1,
  noteDiagnostiqueur: 'Amélioration : 310 CHF/m² hors échafaudage', articleLieId: null, actif: true,
  ligneOrigine: '18',
  etats: [
    { etat: 'tres_bon', travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'm2' },
    { etat: 'bon', travaux: 'Nettoyage', prix: 12, partPrixMauvais: null, unite: 'm2' },
    { etat: 'moyen', travaux: 'Réfection partielle', prix: 40, partPrixMauvais: 0.3, unite: 'm2' },
    { etat: 'mauvais', travaux: 'Piquage et réfection', prix: 180, partPrixMauvais: null, unite: 'm2' },
    { etat: 'amelioration', travaux: 'Isolation périphérique', prix: null, partPrixMauvais: null, unite: 'm2' },
    { etat: 'normes', travaux: null, prix: null, partPrixMauvais: null, unite: 'm2' },
  ],
  etapes: [{ articleId: 'A015', etapeNumero: 1, ordreDansEtape: 8 }],
}

describe('l’article présenté à l’écran de visite', () => {
  it('porte son étape dans son identité', () => {
    expect(ouvrageDeLArticle(A015, 1).id).toBe('A015@1')
    expect(ouvrageDeLArticle(A015).id).toBe('A015')
  })

  it('reprend les travaux de chaque état', () => {
    const o = ouvrageDeLArticle(A015, 1)
    expect(o.workMauvais).toBe('Piquage et réfection')
    expect(o.workImprovement).toBe('Isolation périphérique')
    expect(o.workNorms).toBeNull()
  })

  it('calcule le prix de l’état moyen au lieu de le lire', () => {
    // 40 de part fixe + 30 % de 180 = 94 CHF/m².
    expect(ouvrageDeLArticle(A015, 1).priceMoyen).toBe(94)
  })

  it('garde la part du catalogue, pour que l’écran puisse l’afficher', () => {
    expect(ouvrageDeLArticle(A015, 1).partPrixMauvais).toBe(0.3)
  })

  it('laisse les descriptions d’état vides, la base v3 n’en a pas', () => {
    const o = ouvrageDeLArticle(A015, 1)
    expect([o.descTbe, o.descBon, o.descMoyen, o.descMauvais]).toEqual([null, null, null, null])
  })

  it('ne porte aucune formule de quantité : la base dit sa base', () => {
    const o = ouvrageDeLArticle(A015, 1)
    expect(o.quantityFormula).toBeNull()
    expect(o.baseQuantite).toBe('surface_facade')
    expect(o.coefficient).toBe(1)
  })

  it('reprend le groupe d’alternatives et l’échafaudage', () => {
    const o = ouvrageDeLArticle(A015, 1)
    expect(o.surfaceGroup).toBe('Revêtement de façade')
    expect(o.echafaudage).toBe(true)
    expect(o.scaffoldingNote).toContain('Échafaudage')
  })

  it('transporte la note interne sans la confondre avec un texte de rapport', () => {
    const o = ouvrageDeLArticle(A015, 1)
    expect(o.note).toContain('310 CHF/m²')
    expect(o.description).toBe('Façade crépie non isolée')
  })

  it('écrit les unités pour l’écran', () => {
    expect(uniteEnClair('m2')).toBe('m²')
    expect(uniteEnClair('forfait')).toBe('forfait')
    expect(ouvrageDeLArticle(A015, 1).unit).toBe('m²')
  })
})

describe('les travaux et le prix d’un état constaté', () => {
  const o = ouvrageDeLArticle(A015, 1)

  it('donne les travaux de l’état', () => {
    expect(travauxDeLEtat(o, 'MAUVAIS')).toBe('Piquage et réfection')
    expect(travauxDeLEtat(o, 'TRES_BON')).toBe('Néant')
  })

  it('donne le prix de l’état, y compris celui qui se calcule', () => {
    expect(prixDeLEtat(o, 'MAUVAIS')).toBe(180)
    expect(prixDeLEtat(o, 'MOYEN')).toBe(94)
    expect(prixDeLEtat(o, 'TRES_BON')).toBeNull()
  })
})
