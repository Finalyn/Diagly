import { describe, it, expect } from 'vitest'
import {
  ENTETES_ARTICLES, ligneArticle, ligneNomenclature, lignePoste, lignesDeVisite,
  texteDeLaBase, uniteDuClasseur, type ArticleAExporter,
} from './exporter'
import { assemblerArticle, assemblerEtapes, assemblerPostes } from './assembler'

const A015: ArticleAExporter = {
  id: 'A015', cfcCode: '226.1', nom: 'Façade crépie non isolée', domaineRapport: 'Façades',
  groupeAlternatives: 'Revêtement de façade', echafaudage: true, uniteEntretien: 'm2',
  uniteRemplacement: 'm2', baseQuantite: 'surface_facade', indicationQuantite: null, coefficient: 1,
  noteDiagnostiqueur: 'Amélioration : 310 CHF/m² hors échafaudage', actif: true, ligneOrigine: '18',
  etats: [
    { etat: 'tres_bon', travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'm2' },
    { etat: 'bon', travaux: 'Nettoyage à haute pression', prix: 8, partPrixMauvais: null, unite: 'm2' },
    { etat: 'moyen', travaux: 'Réfection partielle', prix: 45, partPrixMauvais: 0.3, unite: 'm2' },
    { etat: 'mauvais', travaux: 'Piquage et réfection complète', prix: 180, partPrixMauvais: null, unite: 'm2' },
    { etat: 'amelioration', travaux: 'Isolation périphérique crépie', prix: 310, partPrixMauvais: null, unite: 'm2' },
    { etat: 'normes', travaux: null, prix: null, partPrixMauvais: null, unite: 'm2' },
  ],
  etapes: [{ etapeNumero: 1, ordreDansEtape: 8 }],
}

const A057: ArticleAExporter = {
  ...A015,
  id: 'A057', cfcCode: '233', nom: 'Lustrerie', domaineRapport: 'Électricité',
  groupeAlternatives: null, echafaudage: false, uniteEntretien: 'pce', uniteRemplacement: 'pce',
  baseQuantite: 'saisie_manuelle', indicationQuantite: 'nombre de luminaires', coefficient: 1,
  noteDiagnostiqueur: null, ligneOrigine: null,
  etats: [
    { etat: 'mauvais', travaux: 'Remplacement des luminaires', prix: null, partPrixMauvais: null, unite: 'pce' },
  ],
  etapes: [{ etapeNumero: 2, ordreDansEtape: 1 }, { etapeNumero: 5, ordreDansEtape: 3 }],
}

const A040: ArticleAExporter = {
  ...A057,
  id: 'A040', cfcCode: '228.3', nom: 'Stores en toile', baseQuantite: 'regle_stores',
  indicationQuantite: 'Logements : 1 pce par logement de 2,5 à 3,5 pièces, 2 pce au-delà',
  etapes: [{ etapeNumero: 1, ordreDansEtape: 30 }],
}

describe('l’onglet Articles', () => {
  it('écrit toutes les colonnes du classeur, dans l’ordre', () => {
    const ligne = ligneArticle(A015)
    expect(Object.keys(ligne)).toEqual([...ENTETES_ARTICLES])
  })

  it('calcule le prix total de l’état moyen, qui aide à la relecture', () => {
    // 45 de part fixe + 30 % de 180 = 99 CHF/m².
    expect(ligneArticle(A015)['État moyen – prix total']).toBe(99)
  })

  it('écrit l’échafaudage et le statut en toutes lettres', () => {
    expect(ligneArticle(A015)['Échafaudage']).toBe('Oui')
    expect(ligneArticle({ ...A015, echafaudage: false, actif: false })['Échafaudage']).toBe('Non')
    expect(ligneArticle({ ...A015, actif: false })['Statut']).toBe('Retiré')
  })

  it('laisse vides les cases sans valeur, plutôt que d’écrire zéro', () => {
    const ligne = ligneArticle(A015)
    expect(ligne['Très bon état – prix']).toBe('')
    expect(ligne['Mise aux normes – travaux']).toBe('')
  })

  it('nomme les étapes quand on lui donne de quoi', () => {
    const nomDeLEtape = (n: number) => (n === 2 ? "Cage d'escalier" : 'Appartements')
    expect(ligneArticle(A057, { nomDeLEtape })['Étapes de visite']).toBe("Cage d'escalier, Appartements")
  })
})

describe('la base de quantité, écrite pour être relue', () => {
  it('reprend le libellé, et l’indication entre parenthèses', () => {
    expect(texteDeLaBase('surface_facade', null)).toBe('Surface de façade')
    expect(texteDeLaBase('saisie_manuelle', 'nombre de luminaires')).toBe('Saisie manuelle (nombre de luminaires)')
  })

  it('garde la phrase d’origine des trois règles nommées', () => {
    expect(texteDeLaBase('regle_stores', 'Logements : 1 pce par logement de 2,5 à 3,5 pièces, 2 pce au-delà'))
      .toBe('Logements : 1 pce par logement de 2,5 à 3,5 pièces, 2 pce au-delà')
  })

  it('écrit les unités comme le classeur', () => {
    expect(uniteDuClasseur('m2')).toBe('m²')
    expect(uniteDuClasseur('forfait')).toBe('forfait')
  })
})

describe('l’aller-retour : ce qui sort se relit', () => {
  const relire = (a: ArticleAExporter) => assemblerArticle(ligneArticle(a))

  it('retrouve l’article entier après un passage par le classeur', () => {
    const relu = relire(A015)
    expect(relu.id).toBe('A015')
    expect(relu.cfcCode).toBe('226.1')
    expect(relu.nom).toBe('Façade crépie non isolée')
    expect(relu.domaineRapport).toBe('Façades')
    expect(relu.groupeAlternatives).toBe('Revêtement de façade')
    expect(relu.echafaudage).toBe(true)
    expect(relu.baseQuantite).toBe('surface_facade')
    expect(relu.coefficient).toBe(1)
    expect(relu.noteDiagnostiqueur).toContain('310 CHF/m²')
    expect(relu.ligneOrigine).toBe('18')
  })

  it('retrouve les six états, leurs travaux et leurs prix', () => {
    const relu = relire(A015)
    const parEtat = new Map(relu.etats.map((e) => [e.etat, e]))
    expect(parEtat.get('bon')?.prix).toBe(8)
    expect(parEtat.get('moyen')?.partPrixMauvais).toBe(0.3)
    expect(parEtat.get('mauvais')?.travaux).toBe('Piquage et réfection complète')
    expect(parEtat.get('amelioration')?.prix).toBe(310)
    expect(parEtat.get('normes')?.travaux).toBeNull()
  })

  it('retrouve une saisie manuelle avec son indication', () => {
    const relu = relire(A057)
    expect(relu.baseQuantite).toBe('saisie_manuelle')
    expect(relu.indicationQuantite).toBe('nombre de luminaires')
  })

  it('retrouve une règle nommée, qui ne se réécrit pas de mémoire', () => {
    const relu = relire(A040)
    expect(relu.baseQuantite).toBe('regle_stores')
  })

  it('retrouve les étapes de visite, dans leur ordre', () => {
    const etapes = [
      { numero: 1, nom: 'Façade', zone: 'Extérieur' },
      { numero: 2, nom: "Cage d'escalier", zone: 'Communs' },
      { numero: 5, nom: 'Appartements', zone: 'Logements' },
    ]
    const lignes = lignesDeVisite([A015, A057], etapes)
    const relu = assemblerEtapes(lignes)
    expect(relu.etapes.map((e) => e.numero)).toEqual([1, 2, 5])
    expect(relu.liens.map((l) => `${l.articleId}@${l.etapeNumero}`)).toEqual(['A015@1', 'A057@2', 'A057@5'])
    expect(relu.liens[0].ordreDansEtape).toBe(8)
  })

  it('retrouve un poste automatique, déclencheur et règle compris', () => {
    const poste = {
      cfcCode: '211.1', libelle: 'Échafaudage de façade', declencheur: 'echafaudage_facade',
      unite: 'm2' as const, prix: 35, regleQuantite: 'surface_echafaudee', remarque: 'Compté une fois.',
    }
    const relu = assemblerPostes([lignePoste(poste)])[0]
    expect(relu).toMatchObject({
      cfcCode: '211.1', declencheur: 'echafaudage_facade', regleQuantite: 'surface_echafaudee', prix: 35,
    })
  })

  it('écrit la nomenclature avec le nombre d’articles de chaque code', () => {
    const n = ligneNomenclature({ code: '226.1', libelle: 'Crépis et enduits extérieurs', niveau: 4, parentCode: '226' }, 2)
    expect(n).toMatchObject({ 'Code CFC': '226.1', 'Niveau': 4, 'Code parent': '226', 'Articles Diagly': 2 })
  })
})
