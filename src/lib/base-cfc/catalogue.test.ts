import { describe, it, expect } from 'vitest'
import {
  etatDeLArticle, etatsRenseignes, nomDeLEtapePourLeBatiment, parcoursDuDiagnostic, prixMauvaisDe,
} from './catalogue'
import type { ApiArticle, ApiDiagnosticItem, ApiEtapeVisite } from '../api-types'

const ETAPES: ApiEtapeVisite[] = [
  { numero: 1, nom: 'Façade', zone: 'Extérieur' },
  { numero: 2, nom: "Cage d'escalier", zone: 'Communs' },
  { numero: 5, nom: 'Appartements', zone: 'Logements' },
]

const article = (p: Partial<ApiArticle>): ApiArticle => ({
  id: 'A015', cfcCode: '226.1', nom: 'Façade crépie non isolée', domaineRapport: 'Extérieur',
  groupeAlternatives: 'Revêtement de façade', echafaudage: true, uniteEntretien: 'm2',
  uniteRemplacement: 'm2', baseQuantite: 'surface_facade', indicationQuantite: null, coefficient: 1,
  noteDiagnostiqueur: null, articleLieId: null, actif: true, ligneOrigine: null,
  etats: [
    { etat: 'mauvais', travaux: 'Réfection du crépi', prix: 180, partPrixMauvais: null, unite: 'm2' },
    { etat: 'moyen', travaux: 'Réfection partielle', prix: 40, partPrixMauvais: 0.3, unite: 'm2' },
    { etat: 'tres_bon', travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'm2' },
    { etat: 'normes', travaux: null, prix: null, partPrixMauvais: null, unite: 'm2' },
  ],
  etapes: [{ articleId: 'A015', etapeNumero: 1, ordreDansEtape: 8 }],
  ...p,
})

const peinture = article({
  id: 'A100', cfcCode: '285.1', nom: 'Peinture intérieure – murs', domaineRapport: 'Intérieur – murs',
  groupeAlternatives: 'Finition de paroi', echafaudage: false, baseQuantite: 'surface_plancher',
  etapes: [
    { articleId: 'A100', etapeNumero: 2, ordreDansEtape: 31 },
    { articleId: 'A100', etapeNumero: 5, ordreDansEtape: 34 },
  ],
})

const sol = article({
  id: 'A116', cfcCode: '281.6', nom: 'Carrelage de sol', domaineRapport: 'Intérieur – sols',
  groupeAlternatives: 'Revêtement de sol', echafaudage: false, baseQuantite: 'surface_plancher',
  etapes: [{ articleId: 'A116', etapeNumero: 2, ordreDansEtape: 22 }],
})

const releve = (p: Partial<ApiDiagnosticItem>): ApiDiagnosticItem => ({
  id: 'r1', diagnosticId: 'd1', cfcCode: '285.1', cfcLabel: 'Peinture', catalogItemId: null,
  state: 'MAUVAIS', priority: 'I', notes: null, works: [], photos: [], area: 300, unit: 'm²',
  yearInstalled: null, interventionYear: null, estimatedCost: null, improvement: null,
  improvementCost: null, norms: null, normsCost: null, createdAt: '', updatedAt: '', ...p,
})

const base = { articles: [article({}), peinture, sol], etapes: ETAPES }

describe('le parcours de visite d’un diagnostic', () => {
  it('rend les étapes dans l’ordre, avec leur zone', () => {
    const p = parcoursDuDiagnostic(base, [])
    expect(p.etapes.map((e) => [e.numero, e.nom, e.zone]))
      .toEqual([[1, 'Façade', 'Extérieur'], [2, "Cage d'escalier", 'Communs'], [5, 'Appartements', 'Logements']])
  })

  it('n’affiche pas une étape sans article', () => {
    const p = parcoursDuDiagnostic({ articles: [article({})], etapes: ETAPES }, [])
    expect(p.etapes.map((e) => e.numero)).toEqual([1])
  })

  it('attend deux relevés indépendants pour un article de deux étapes', () => {
    const p = parcoursDuDiagnostic(base, [])
    const cles = p.etapes.flatMap((e) => e.domaines.flatMap((d) => d.lignes.map((l) => l.cle)))
    expect(cles).toContain('A100@2')
    expect(cles).toContain('A100@5')
  })

  it('rattache un relevé à son étape, et à elle seule', () => {
    const fait = releve({ id: 'r1', articleId: 'A100', etapeNumero: 2 })
    const p = parcoursDuDiagnostic(base, [fait])
    const cage = p.etapes.find((e) => e.numero === 2)!
    const appartements = p.etapes.find((e) => e.numero === 5)!
    expect(cage.domaines.flatMap((d) => d.lignes).find((l) => l.cle === 'A100@2')?.releve?.id).toBe('r1')
    expect(appartements.domaines.flatMap((d) => d.lignes)[0].releve).toBeNull()
    expect(cage.faits).toBe(1)
    expect(appartements.faits).toBe(0)
  })

  it('ne compte pas comme fait un relevé ouvert sans état', () => {
    const ouvert = releve({ articleId: 'A100', etapeNumero: 2, state: null })
    const p = parcoursDuDiagnostic(base, [ouvert])
    expect(p.etapes.find((e) => e.numero === 2)!.faits).toBe(0)
    expect(p.faits).toBe(0)
  })

  it('totalise les attendus et les faits sur tout le diagnostic', () => {
    const p = parcoursDuDiagnostic(base, [releve({ articleId: 'A015', etapeNumero: 1 })])
    // A015 en façade, A100 et A116 dans la cage, A100 dans les appartements.
    expect(p.attendus).toBe(4)
    expect(p.faits).toBe(1)
  })

  it('range les lignes d’une étape par leur rang, puis par chapitre du rapport', () => {
    const cage = parcoursDuDiagnostic(base, []).etapes.find((e) => e.numero === 2)!
    expect(cage.domaines.map((d) => d.nom)).toEqual(['Intérieur – sols', 'Intérieur – murs'])
  })

  it('ne propose plus un article désactivé', () => {
    const retire = { ...sol, actif: false }
    const p = parcoursDuDiagnostic({ ...base, articles: [article({}), peinture, retire] }, [])
    const cage = p.etapes.find((e) => e.numero === 2)!
    expect(cage.domaines.flatMap((d) => d.lignes).map((l) => l.article.id)).toEqual(['A100'])
  })

  it('garde à l’écran un article désactivé déjà relevé', () => {
    const retire = { ...sol, actif: false }
    const observe = releve({ id: 'r9', articleId: 'A116', etapeNumero: 2, cfcCode: '281.6' })
    const p = parcoursDuDiagnostic({ ...base, articles: [article({}), peinture, retire] }, [observe])
    const cage = p.etapes.find((e) => e.numero === 2)!
    expect(cage.domaines.flatMap((d) => d.lignes).map((l) => l.article.id)).toEqual(['A116', 'A100'])
    expect(p.horsBase).toEqual([])
  })

  it('ne perd pas un relevé dont l’article n’est pas repris dans la base', () => {
    // Les ventilations naturelles de l'ancien catalogue n'ont pas de repreneur.
    const ancien = releve({ id: 'r7', articleId: null, catalogItemId: 1042, cfcLabel: 'Ventilation naturelle' })
    const p = parcoursDuDiagnostic(base, [ancien])
    expect(p.horsBase.map((r) => r.id)).toEqual(['r7'])
  })

  it('ne perd pas un relevé dont l’étape a disparu', () => {
    const orphelin = releve({ id: 'r8', articleId: 'A100', etapeNumero: 9 })
    expect(parcoursDuDiagnostic(base, [orphelin]).horsBase.map((r) => r.id)).toEqual(['r8'])
  })
})

describe('l’intitulé de l’étape des surfaces principales', () => {
  it('suit l’affectation du bâtiment', () => {
    const appartements = ETAPES[2]
    expect(nomDeLEtapePourLeBatiment(appartements, 'SCOLAIRE')).toBe('Salles de classe')
    expect(nomDeLEtapePourLeBatiment(appartements, 'HOTEL')).toBe('Chambres')
    expect(nomDeLEtapePourLeBatiment(appartements, 'LOGEMENT')).toBe('Appartements')
  })

  it('ne touche pas aux autres étapes : une façade est une façade', () => {
    expect(nomDeLEtapePourLeBatiment(ETAPES[0], 'SCOLAIRE')).toBe('Façade')
  })

  it('garde le nom de la base quand l’affectation est inconnue', () => {
    expect(nomDeLEtapePourLeBatiment(ETAPES[2], null)).toBe('Appartements')
  })
})

describe('les états d’un article', () => {
  it('trouve un état et son prix', () => {
    expect(etatDeLArticle(article({}), 'mauvais')?.prix).toBe(180)
    expect(etatDeLArticle(article({}), 'bon')).toBeUndefined()
  })

  it('donne le prix de l’état Mauvais, dont dépend l’état moyen', () => {
    expect(prixMauvaisDe(article({}))).toBe(180)
    expect(prixMauvaisDe(peinture)).toBe(180)
  })

  it('ne retient que les états que le catalogue décrit ou chiffre', () => {
    expect(etatsRenseignes(article({})).map((e) => e.etat)).toEqual(['mauvais', 'moyen', 'tres_bon'])
  })
})
