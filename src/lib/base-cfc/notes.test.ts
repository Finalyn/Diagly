import { describe, it, expect } from 'vitest'
import { propositionAmelioration, prixIndicatifDeLaNote } from './notes'

describe('règle 5, l’article lié', () => {
  const a068 = { id: 'A068', nom: 'Chauffage électrique direct (résistances)', articleLieId: 'A064' }

  it('propose l’autre article quand l’amélioration est décrite sans prix', () => {
    const p = propositionAmelioration(a068, { travaux: 'Remplacement par une PAC', prix: null }, 'Pompe à chaleur air/eau (PAC)')
    expect(p?.articleAProposer).toBe('A064')
    expect(p?.message).toContain('Pompe à chaleur air/eau (PAC)')
  })

  it('se tait quand l’amélioration a son propre prix', () => {
    expect(propositionAmelioration(a068, { travaux: 'Remplacement', prix: 45000 })).toBeNull()
  })

  it('se tait quand l’article ne renvoie à rien', () => {
    expect(propositionAmelioration({ id: 'A015', nom: 'Façade', articleLieId: null }, { travaux: 'Isolation', prix: null }))
      .toBeNull()
  })

  it('se tait quand aucune amélioration n’est décrite', () => {
    expect(propositionAmelioration(a068, { travaux: null, prix: null })).toBeNull()
  })

  it('nomme l’article cible par son identifiant à défaut de son nom', () => {
    expect(propositionAmelioration(a068, { travaux: 'x', prix: null })?.message).toContain('A064')
  })
})

describe('règle 6, le prix indicatif en note', () => {
  it('lit le prix et ce qu’il compte', () => {
    // A057 Lustrerie.
    const p = prixIndicatifDeLaNote('Amélioration : compter environ 400.- par luminaire, nombre de luminaires à saisir.')
    expect(p).toMatchObject({ montant: 400, parQuoi: 'luminaire' })
  })

  it('lit un prix au mètre carré', () => {
    // A015 Façade crépie non isolée.
    const p = prixIndicatifDeLaNote("Amélioration : 310 CHF/m² = 250 isolation périphérique crépie + 60 piquage de l'ancien crépi, hors échafaudage")
    expect(p).toMatchObject({ montant: 310, parQuoi: 'm²' })
  })

  it('garde la phrase d’origine, pour que le raisonnement reste lisible', () => {
    const p = prixIndicatifDeLaNote('Préciser la zone. Compter environ 400.- par luminaire.')
    expect(p?.source).toBe('Compter environ 400.- par luminaire.')
  })

  it('accepte l’apostrophe suisse des milliers', () => {
    expect(prixIndicatifDeLaNote("Compter 1'250.- par unité")?.montant).toBe(1250)
  })

  it('ne rend rien d’une note sans prix', () => {
    expect(prixIndicatifDeLaNote('Préciser la zone et le nombre')).toBeNull()
    expect(prixIndicatifDeLaNote(null)).toBeNull()
  })

  it('n’attrape pas un nombre qui n’est pas un prix', () => {
    expect(prixIndicatifDeLaNote('Voir le relevé 2024 pour la toiture')).toBeNull()
    expect(prixIndicatifDeLaNote('Vérifier les 4 façades')).toBeNull()
  })

  it('ne rend rien pour un montant nul', () => {
    expect(prixIndicatifDeLaNote('Compter 0.- par unité')).toBeNull()
  })
})
