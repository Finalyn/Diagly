import { describe, it, expect, beforeEach } from 'vitest'
import { etatPourLaBase, patchDuPrix, patchDuRetour } from './prix-du-dossier'
import { setMarketCoeff } from './diagnostic-auto'
import type { DevisLigne } from './devis'
import type { ApiArticle } from './api-types'

const ligne = (o: Partial<DevisLigne>): DevisLigne => ({
  cle: 'r:Réparation', releveId: 'r', cfcCode: '226.1', libelle: 'Crépi', enveloppe: 'Réparation', priorite: 'I',
  quantite: 400, unite: 'm²', prixUnitaire: 180, montant: 72_000, aChiffrer: false, raisonAChiffrer: null, remarque: '',
  automatique: false, prixBase: 180, prixModifie: false, indexation: null, variantesADetailler: false, rattacheA: null, ...o,
})

beforeEach(() => setMarketCoeff(1))

describe('un prix saisi dans l’onglet Coûts', () => {
  it('fige le coût d’une réparation, qui ne suit plus la base', () => {
    expect(patchDuPrix(ligne({}), 200)).toEqual({ estimatedCost: 80_000, costManual: true, costIndex: null })
  })

  it('chiffre une amélioration à la quantité de la ligne', () => {
    expect(patchDuPrix(ligne({ enveloppe: 'Amélioration' }), 310)).toEqual({ improvementCost: 124_000 })
  })

  it('revient au prix de la base', () => {
    expect(patchDuRetour(ligne({ prixBase: 180 }))).toEqual({ estimatedCost: 72_000, costManual: false, costIndex: 1 })
  })

  it('écrit dans la base le prix avant indexation, sans toucher au texte des travaux', () => {
    const article = { uniteEntretien: 'm2', uniteRemplacement: 'm2', etats: [{ etat: 'mauvais', travaux: 'Réfection complète', prix: 150, partPrixMauvais: null, unite: 'm2' }] } as unknown as ApiArticle
    expect(etatPourLaBase(article, 'mauvais', 165, 1.1)).toEqual({ etat: 'mauvais', travaux: 'Réfection complète', prix: 150, partPrixMauvais: null, unite: 'm2' })
  })
})
