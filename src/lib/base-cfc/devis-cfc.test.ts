import { describe, it, expect } from 'vitest'
import {
  comparerCodesCfc, ligneDeDevis, lignesACompleter, lignesDuDevis, totalDesLignes,
  type ReleveAChiffrer,
} from './devis-cfc'
import type { EtapeDeVisite } from './etapes'

const ETAPES: EtapeDeVisite[] = [
  { numero: 1, nom: 'Façade', zone: 'Extérieur' },
  { numero: 2, nom: "Cage d'escalier", zone: 'Communs' },
  { numero: 5, nom: 'Appartements', zone: 'Logements' },
]

const peinture = (etapeNumero: number, quantite: number): ReleveAChiffrer => ({
  articleId: 'A100', cfcCode: '285.1', nom: 'Peinture intérieure – murs', etapeNumero,
  etat: 'mauvais', prixMauvais: 32,
  etatDuCatalogue: { travaux: 'Ponçage et remise en peinture complète', prix: 32, partPrixMauvais: null, unite: 'm2' },
  quantite,
})

const facade: ReleveAChiffrer = {
  articleId: 'A015', cfcCode: '226.1', nom: 'Façade crépie non isolée', etapeNumero: 1,
  etat: 'mauvais', prixMauvais: 180,
  etatDuCatalogue: { travaux: 'Piquage et réfection complète du crépi', prix: 180, partPrixMauvais: null, unite: 'm2' },
  quantite: 400,
}

describe('le tri des codes CFC, à l’usage suisse', () => {
  it('compare les segments par leur valeur, pas par leur texte', () => {
    expect([...['226.1', '22', '221', '211.1'].sort(comparerCodesCfc)])
      .toEqual(['22', '211.1', '221', '226.1'])
  })

  it('place 281.9 avant 281.10', () => {
    expect(comparerCodesCfc('281.9', '281.10')).toBeLessThan(0)
  })

  it('place un code court avant celui qui le prolonge', () => {
    expect(comparerCodesCfc('211', '211.1')).toBeLessThan(0)
    expect(comparerCodesCfc('211.1', '211')).toBeGreaterThan(0)
    expect(comparerCodesCfc('285.0', '285.0')).toBe(0)
  })
})

describe('règle 9, une ligne par étape', () => {
  it('ajoute le nom de l’étape en sous-titre quand l’ouvrage est relevé deux fois', () => {
    const lignes = lignesDuDevis([peinture(2, 300), peinture(5, 900)], ETAPES)
    expect(lignes.map((l) => l.libelle)).toEqual([
      'Peinture intérieure – murs · Appartements',
      "Peinture intérieure – murs · Cage d'escalier",
    ])
  })

  it('donne deux lignes distinctes, chacune avec son montant', () => {
    const lignes = lignesDuDevis([peinture(2, 300), peinture(5, 900)], ETAPES)
    expect(lignes.map((l) => l.montant)).toEqual([28_800, 9600])
    expect(new Set(lignes.map((l) => l.cle)).size).toBe(2)
  })

  it('n’alourdit pas le libellé d’un ouvrage relevé une seule fois', () => {
    const [l] = lignesDuDevis([facade], ETAPES)
    expect(l.libelle).toBe('Façade crépie non isolée')
    expect(l.sousTitre).toBeNull()
  })

  it('trie le devis par code CFC et non par ordre de visite', () => {
    const lignes = lignesDuDevis([peinture(2, 300), facade], ETAPES)
    expect(lignes.map((l) => l.cfcCode)).toEqual(['226.1', '285.1'])
  })
})

describe('règle 9, le montant de la ligne', () => {
  it('recalcule le montant depuis la quantité et le prix unitaire', () => {
    expect(ligneDeDevis(facade, ETAPES)).toMatchObject({ quantite: 400, prixUnitaire: 180, montant: 72_000 })
  })

  it('suit une quantité corrigée sur place', () => {
    expect(ligneDeDevis({ ...facade, quantite: 380 }, ETAPES)?.montant).toBe(68_400)
  })

  it('calcule le prix de l’état moyen depuis la part et le prix Mauvais', () => {
    const moyen: ReleveAChiffrer = {
      ...facade, etat: 'moyen',
      etatDuCatalogue: { travaux: 'Réfection partielle du crépi', prix: 40, partPrixMauvais: 0.3, unite: 'm2' },
    }
    // 40 + 0,3 × 180 = 94 CHF/m², sur 400 m².
    expect(ligneDeDevis(moyen, ETAPES)).toMatchObject({ prixUnitaire: 94, montant: 37_600 })
  })

  it('accepte un prix unitaire saisi à la main, quand le prix est en note', () => {
    const lustrerie: ReleveAChiffrer = {
      articleId: 'A057', cfcCode: '233', nom: 'Lustrerie', etapeNumero: 2, etat: 'mauvais', prixMauvais: null,
      etatDuCatalogue: { travaux: 'Remplacement des luminaires', prix: null, partPrixMauvais: null, unite: 'pce' },
      quantite: 24, prixUnitaireManuel: 400,
    }
    expect(ligneDeDevis(lustrerie, ETAPES)?.montant).toBe(9600)
  })

  it('porte le texte des travaux de l’état retenu', () => {
    expect(ligneDeDevis(facade, ETAPES)?.travaux).toBe('Piquage et réfection complète du crépi')
  })

  it('n’imprime pas de ligne pour un état « Néant »', () => {
    const neant = { ...facade, etatDuCatalogue: { ...facade.etatDuCatalogue, travaux: 'Néant', prix: null } }
    expect(ligneDeDevis(neant, ETAPES)).toBeNull()
  })

  it('n’imprime pas de ligne pour un état sans travaux ni prix', () => {
    const vide = { ...facade, etatDuCatalogue: { ...facade.etatDuCatalogue, travaux: null, prix: null } }
    expect(ligneDeDevis(vide, ETAPES)).toBeNull()
  })

  it('garde la ligne, sans montant, quand des travaux sont décrits sans prix', () => {
    const sansPrix = { ...facade, prixMauvais: null, etatDuCatalogue: { ...facade.etatDuCatalogue, prix: null } }
    const l = ligneDeDevis(sansPrix, ETAPES)
    expect(l?.travaux).toBe('Piquage et réfection complète du crépi')
    expect(l?.montant).toBeNull()
  })

  it('garde la ligne, sans montant, quand la quantité reste à saisir', () => {
    expect(ligneDeDevis({ ...facade, quantite: null }, ETAPES)?.montant).toBeNull()
  })
})

describe('règle 9, ce que le devis ne dit pas', () => {
  it('n’expose aucun champ de note du diagnostiqueur', () => {
    const l = ligneDeDevis(facade, ETAPES)!
    expect(Object.keys(l)).toEqual([
      'cle', 'cfcCode', 'article', 'sousTitre', 'libelle', 'etat', 'travaux',
      'quantite', 'unite', 'prixUnitaire', 'montant',
    ])
  })
})

describe('les totaux', () => {
  it('additionne les lignes chiffrées', () => {
    expect(totalDesLignes(lignesDuDevis([facade, peinture(2, 300)], ETAPES))).toBe(81_600)
  })

  it('ne compte pas une ligne à compléter dans le total, et la signale', () => {
    const lignes = lignesDuDevis([facade, { ...peinture(2, 300), quantite: null }], ETAPES)
    expect(totalDesLignes(lignes)).toBe(72_000)
    expect(lignesACompleter(lignes).map((l) => l.article)).toEqual(['Peinture intérieure – murs'])
  })
})
