import { describe, it, expect } from 'vitest'
import { corrigerTexte, nomDuReleve } from './textes'
import type { ApiArticle } from './api-types'

describe('les textes du référentiel', () => {
  it('corrige les coquilles relevées dans le premier rapport', () => {
    expect(corrigerTexte('Reprise des joints siliconnes')).toBe('Reprise des joints silicones')
    expect(corrigerTexte('Façade ventillée métallique')).toBe('Façade ventilée métallique')
    expect(corrigerTexte('Mise aux normes par réhaussement OU / ET remplissage')).toBe('Mise aux normes par rehaussement OU / ET remplissage')
    expect(corrigerTexte('7U')).toBe('7 pce')
  })

  it('laisse les mots justes', () => {
    expect(corrigerTexte('Crépissage de façade')).toBe('Crépissage de façade')
    expect(corrigerTexte('Crépis et enduits intérieurs')).toBe('Crépis et enduits intérieurs')
    expect(corrigerTexte('Fenêtres U = 1,1 W/m²K')).toBe('Fenêtres U = 1,1 W/m²K')
  })

  it('nomme un relevé comme l’article de la base', () => {
    const articles = new Map([['A005', { id: 'A005', nom: 'Balcons en béton' } as ApiArticle]])
    expect(nomDuReleve({ cfcLabel: 'Balcons - Structure', articleId: 'A005' }, articles)).toBe('Balcons en béton')
    expect(nomDuReleve({ cfcLabel: 'Ouvrage libre', articleId: null }, articles)).toBe('Ouvrage libre')
  })
})
