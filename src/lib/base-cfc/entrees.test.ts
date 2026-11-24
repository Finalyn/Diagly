import { describe, it, expect } from 'vitest'
import type { ApiArticle, ApiBatiment, ApiDiagnosticItem } from '../api-types'
import { donneesDuBatiment } from './batiment'
import { entreesDuDossier, nomDeLEntree, partDeLEntree, partDuReleve, sePartageParEntree } from './entrees'
import { calculateurDesQuantites, recalculsDuBatiment } from './quantite-comptee'
import { parcoursDuDiagnostic } from './catalogue'

const bat = (o: Partial<ApiBatiment>): ApiBatiment => ({ id: 'b', ...o })

// Champrilly 16-18-20 : un bâtiment, trois entrées.
const CHAMPRILLY = [
  bat({ id: 'b16', adresse: 'Avenue de Champrilly 16', floorArea: 687, nbApartments: 7, nbStaircases: 1, nbFloors: 3 }),
  bat({ id: 'b18', adresse: 'Avenue de Champrilly 18', floorArea: 720, nbApartments: 8, nbStaircases: 1, nbFloors: 3 }),
  bat({ id: 'b20', adresse: 'Avenue de Champrilly 20', floorArea: 687, nbApartments: 6, nbStaircases: 1, nbFloors: 4 }),
]

const etats = [
  { etat: 'tres_bon' as const, travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'm2' as const },
  { etat: 'bon' as const, travaux: 'Nettoyage', prix: 5, partPrixMauvais: null, unite: 'm2' as const },
  { etat: 'moyen' as const, travaux: 'Retouches', prix: 20, partPrixMauvais: null, unite: 'm2' as const },
  { etat: 'mauvais' as const, travaux: 'Peinture', prix: 40, partPrixMauvais: null, unite: 'm2' as const },
]
const article = (id: string, extra: Partial<ApiArticle>): ApiArticle => ({
  id, cfcCode: '285.0', nom: id, domaineRapport: 'Intérieur', groupeAlternatives: null, echafaudage: false,
  uniteEntretien: 'm2', uniteRemplacement: 'm2', baseQuantite: 'surface_plancher', indicationQuantite: null,
  coefficient: 0.1, noteDiagnostiqueur: null, articleLieId: null, actif: true, ligneOrigine: null,
  etats, etapes: [{ articleId: id, etapeNumero: 2, ordreDansEtape: 1 }], ...extra,
})
// La peinture de la cage : 10 % du plancher, propre à chaque entrée.
const PEINTURE = article('A200', {})
// La façade se mesure sur l'ensemble : pas d'exception possible.
const FACADE = article('A001', { baseQuantite: 'surface_facade', coefficient: 1, etapes: [{ articleId: 'A001', etapeNumero: 1, ordreDansEtape: 1 }] })
const ARTICLES = [PEINTURE, FACADE]

const releve = (id: string, a: ApiArticle, extra: Partial<ApiDiagnosticItem> = {}): ApiDiagnosticItem => ({
  id, diagnosticId: 'd', cfcCode: a.cfcCode, cfcLabel: a.nom, catalogItemId: null, articleId: a.id,
  etapeNumero: a.etapes[0].etapeNumero, state: 'BON', priority: null, notes: null, works: [], photos: [],
  area: null, unit: 'm²', yearInstalled: null, interventionYear: null,
  estimatedCost: null, improvement: null, improvementCost: null, norms: null, normsCost: null,
  createdAt: '', updatedAt: '', ...extra,
})

const batiment = donneesDuBatiment({ batiments: CHAMPRILLY, perimeter: 120, floorHeight: 2.7 })

describe('les entrées du bâtiment', () => {
  it('ne comptent qu’à partir de deux', () => {
    expect(entreesDuDossier(CHAMPRILLY)).toHaveLength(3)
    expect(entreesDuDossier([CHAMPRILLY[0]])).toBeNull()
    expect(entreesDuDossier(null)).toBeNull()
  })

  it('ne partagent que ce qui se mesure par entrée', () => {
    expect(sePartageParEntree('nombre_cages')).toBe(true)
    expect(sePartageParEntree('surface_plancher')).toBe(true)
    // Façade, toiture et chaufferie se relèvent sur l'ensemble.
    expect(sePartageParEntree('surface_facade')).toBe(false)
    expect(sePartageParEntree('surface_batie')).toBe(false)
    expect(sePartageParEntree('forfait')).toBe(false)
  })

  it('se nomment par leur adresse, et une entrée retirée le dit', () => {
    expect(nomDeLEntree(CHAMPRILLY, 'b18')).toBe('Avenue de Champrilly 18')
    expect(nomDeLEntree(CHAMPRILLY, 'b99')).toBe('entrée retirée du dossier')
  })
})

describe('la part d’une entrée', () => {
  it('suit la mesure de la base : les logements pour un ouvrage par logement', () => {
    expect(partDeLEntree('nombre_logements', CHAMPRILLY, 'b18')).toBeCloseTo(8 / 21)
    expect(partDeLEntree('surface_plancher', CHAMPRILLY, 'b20')).toBeCloseTo(687 / 2094)
    expect(partDeLEntree('nombre_cages', CHAMPRILLY, 'b16')).toBeCloseTo(1 / 3)
  })

  it('à parts égales quand une entrée n’a pas la mesure', () => {
    const sansSurface = CHAMPRILLY.map((b, i) => (i === 0 ? { ...b, floorArea: null } : b))
    expect(partDeLEntree('surface_plancher', sansSurface, 'b18')).toBeCloseTo(1 / 3)
  })

  it('le relevé général garde ce que les exceptions laissent', () => {
    const exceptions = [{ entreeId: 'b18' }]
    expect(partDuReleve({}, 'nombre_logements', CHAMPRILLY, exceptions)).toBeCloseTo(13 / 21)
    expect(partDuReleve({ entreeId: 'b18' }, 'nombre_logements', CHAMPRILLY, exceptions)).toBeCloseTo(8 / 21)
    // Une exception sur une base qui ne se partage pas ne retire rien.
    expect(partDuReleve({}, 'surface_facade', CHAMPRILLY, exceptions)).toBe(1)
  })
})

describe('un ouvrage avec une exception d’entrée', () => {
  const general = releve('g', PEINTURE)
  const exception = releve('x', PEINTURE, { entreeId: 'b18', state: 'MAUVAIS' })

  it('partage sa quantité sans rien compter deux fois', () => {
    const calcul = calculateurDesQuantites([general, exception], ARTICLES, batiment)
    // 10 % de 2 094 m² de plancher : 209,4 m², dont 72 m² au 18.
    expect(calcul(exception)?.quantite).toBe(72)
    expect(calcul(general)?.quantite).toBe(137.4)
  })

  it('sans exception, le relevé général prend tout', () => {
    const calcul = calculateurDesQuantites([general], ARTICLES, batiment)
    expect(calcul(general)?.quantite).toBe(209.4)
  })

  it('le recalcul réécrit les deux relevés et leurs montants', () => {
    const recalculs = recalculsDuBatiment([{ ...general, area: 209.4 }, exception], ARTICLES, batiment)
    const parId = new Map(recalculs.map((r) => [r.releveId, r.patch]))
    expect(parId.get('g')?.area).toBe(137.4)
    expect(parId.get('x')?.area).toBe(72)
    expect(Number(parId.get('x')?.estimatedCost)).toBe(72 * 40)
  })

  it('reste sur la ligne du relevé général dans le parcours', () => {
    const parcours = parcoursDuDiagnostic({ articles: ARTICLES, etapes: [{ numero: 2, nom: "Cage d'escalier", zone: 'Communs' }] }, [general, exception])
    const ligne = parcours.etapes[0].domaines[0].lignes[0]
    expect(ligne.releve?.id).toBe('g')
    expect(ligne.exceptions.map((x) => x.id)).toEqual(['x'])
    expect(parcours.horsBase).toHaveLength(0)
  })
})

describe('un ouvrage par étage de la cage, la main courante', () => {
  const MAIN_COURANTE = article('A139', { baseQuantite: 'nombre_etages', coefficient: 1, uniteEntretien: 'pce', uniteRemplacement: 'pce' })

  it('compte les étages de chaque cage, pas ceux de la plus haute seulement', () => {
    // 3 + 3 + 4 étages : dix paliers de main courante, pas quatre.
    const calcul = calculateurDesQuantites([releve('m', MAIN_COURANTE)], [MAIN_COURANTE], batiment)
    expect(calcul(releve('m', MAIN_COURANTE))?.quantite).toBe(10)
    // La hauteur, elle, reste celle de la partie la plus haute.
    expect(batiment.nombreEtages).toBe(4)
  })

  it('un bâtiment sans entrées : ses étages dans chacune de ses cages', () => {
    expect(donneesDuBatiment({ nbFloors: 5, nbStaircases: 2 }).etagesDesCages).toBe(10)
    expect(donneesDuBatiment({ nbFloors: 5 }).etagesDesCages).toBe(5)
  })

  it('une exception prend les étages de son entrée', () => {
    const general = releve('g', MAIN_COURANTE)
    const exception = releve('x', MAIN_COURANTE, { entreeId: 'b20' })
    const calcul = calculateurDesQuantites([general, exception], [MAIN_COURANTE], batiment)
    expect(calcul(exception)?.quantite).toBe(4)
    expect(calcul(general)?.quantite).toBe(6)
  })
})
