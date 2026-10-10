import { describe, it, expect } from 'vitest'
import {
  assemblerArticle, assemblerEtapes, assemblerNomenclature, assemblerPostes, controler,
  type Ligne,
} from './assembler'
import { ErreurBase } from './normaliser'

/** Une ligne d'article complète, telle que le classeur la donne. */
const ligneArticle = (patch: Ligne = {}): Ligne => ({
  'ID': 'A015',
  'Code CFC': '226.1',
  'Article': 'Façade crépie non isolée',
  'Domaine (rapport)': 'Façades',
  'Groupe d’alternatives': 'Revêtement de façade',
  'Échafaudage': 'Oui',
  'Unité entretien': 'm²',
  'Unité remplacement': 'm²',
  'Base de quantité': 'Surface de façade',
  'Coefficient': 1,
  'Très bon état – travaux': 'Néant',
  'Très bon état – prix': null,
  'Bon état – travaux': 'Néant',
  'Bon état – prix': null,
  'État moyen – travaux': 'Réfection partielle du crépi',
  'État moyen – prix fixe': 60,
  'État moyen – part du prix Mauvais': null,
  'Mauvais état – travaux': 'Piquage et réfection complète',
  'Mauvais état – prix': 150,
  'Amélioration – travaux': 'Isolation périphérique crépie',
  'Amélioration – prix': null,
  'Amélioration – unité': 'm²',
  'Mise aux normes – travaux': null,
  'Mise aux normes – prix': null,
  'Mise aux normes – unité': 'm²',
  'Note diagnostiqueur': 'Amélioration : 310 CHF/m² hors échafaudage',
  'Ligne d’origine': 15,
  ...patch,
})

describe('assemblerArticle', () => {
  it('lit un article complet', () => {
    const a = assemblerArticle(ligneArticle())
    expect(a.id).toBe('A015')
    expect(a.cfcCode).toBe('226.1')
    expect(a.echafaudage).toBe(true)
    expect(a.groupeAlternatives).toBe('Revêtement de façade')
    expect(a.baseQuantite).toBe('surface_facade')
    expect(a.coefficient).toBe(1)
    expect(a.ligneOrigine).toBe('15')
  })

  it('donne les six états, dans l’ordre', () => {
    const a = assemblerArticle(ligneArticle())
    expect(a.etats.map((e) => e.etat)).toEqual(['tres_bon', 'bon', 'moyen', 'mauvais', 'amelioration', 'normes'])
  })

  it('attache à chaque état l’unité qui lui revient', () => {
    const a = assemblerArticle(ligneArticle({ 'Unité remplacement': 'pce', 'Mise aux normes – unité': 'forfait' }))
    const par = Object.fromEntries(a.etats.map((e) => [e.etat, e.unite]))
    expect(par).toMatchObject({ bon: 'm2', moyen: 'm2', mauvais: 'pce', amelioration: 'm2', normes: 'forfait' })
  })

  it('garde « Néant » comme texte : l’état est décrit, il n’appelle rien', () => {
    const a = assemblerArticle(ligneArticle())
    expect(a.etats.find((e) => e.etat === 'bon')).toMatchObject({ travaux: 'Néant', prix: null })
  })

  it('ne met la part du prix Mauvais que sur l’état moyen', () => {
    const a = assemblerArticle(ligneArticle({ 'État moyen – part du prix Mauvais': 0.3 }))
    expect(a.etats.find((e) => e.etat === 'moyen')?.partPrixMauvais).toBe(0.3)
    expect(a.etats.filter((e) => e.etat !== 'moyen').every((e) => e.partPrixMauvais === null)).toBe(true)
  })

  it('prend un coefficient absent pour 1', () => {
    expect(assemblerArticle(ligneArticle({ 'Coefficient': null })).coefficient).toBe(1)
  })

  it('accepte une colonne renommée à l’accent près', () => {
    const l = ligneArticle()
    delete l['Domaine (rapport)']
    l['Domaine (Rapport)'] = 'Façades'
    expect(assemblerArticle(l).domaineRapport).toBe('Façades')
  })

  it('refuse un article sans identifiant, sans nom ou sans domaine', () => {
    expect(() => assemblerArticle(ligneArticle({ 'ID': '' }))).toThrow(/identifiant/)
    expect(() => assemblerArticle(ligneArticle({ 'Article': null }))).toThrow(/nom manquant/)
    expect(() => assemblerArticle(ligneArticle({ 'Domaine (rapport)': '' }))).toThrow(/domaine/)
  })

  it('nomme l’article fautif dans le message', () => {
    try { assemblerArticle(ligneArticle({ 'Unité entretien': 'm3' })) } catch (e) {
      expect((e as ErreurBase).champ).toBe('A015 / Unité entretien')
    }
  })

  it('refuse un coefficient nul', () => {
    expect(() => assemblerArticle(ligneArticle({ 'Coefficient': 0 }))).toThrow(/coefficient/)
  })

  it('préfère l’indication de la base à celle de l’unité', () => {
    const a = assemblerArticle(ligneArticle({
      'Base de quantité': 'Saisie manuelle (portes par logement × logements)',
      'Amélioration – unité': 'pce (par logement)',
    }))
    expect(a.indicationQuantite).toBe('portes par logement × logements')
  })
})

describe('assemblerEtapes', () => {
  const l = (numero: number, nom: string, zone: string, id: string, ordre: number): Ligne => ({
    'N° étape': numero, 'Étape de visite': nom, 'Zone': zone, 'ID': id, 'Ordre dans l’étape': ordre,
  })

  it('dédoublonne les étapes et garde les liens', () => {
    const r = assemblerEtapes([
      l(1, 'Façade', 'Extérieur', 'A009', 1),
      l(1, 'Façade', 'Extérieur', 'A015', 2),
      l(2, 'Cage d’escalier', 'Communs', 'A100', 1),
    ])
    expect(r.etapes).toEqual([
      { numero: 1, nom: 'Façade', zone: 'Extérieur' },
      { numero: 2, nom: 'Cage d’escalier', zone: 'Communs' },
    ])
    expect(r.liens).toHaveLength(3)
  })

  it('rend les étapes dans l’ordre du tour, même si le classeur les mélange', () => {
    const r = assemblerEtapes([l(5, 'Appartements', 'Logements', 'A100', 1), l(1, 'Façade', 'Extérieur', 'A009', 1)])
    expect(r.etapes.map((e) => e.numero)).toEqual([1, 5])
  })

  it('accepte qu’un article soit dans deux étapes', () => {
    const r = assemblerEtapes([
      l(2, 'Cage d’escalier', 'Communs', 'A100', 7),
      l(5, 'Appartements', 'Logements', 'A100', 12),
    ])
    expect(r.liens.filter((x) => x.articleId === 'A100')).toHaveLength(2)
  })

  it('refuse une étape qui change de nom d’une ligne à l’autre', () => {
    expect(() => assemblerEtapes([
      l(1, 'Façade', 'Extérieur', 'A009', 1),
      l(1, 'Façades', 'Extérieur', 'A015', 2),
    ])).toThrow(/change de nom/)
  })

  it('refuse un ordre ou un numéro illisible', () => {
    expect(() => assemblerEtapes([l(0, 'Façade', 'Extérieur', 'A009', 1)])).toThrow(/numéro/)
    expect(() => assemblerEtapes([l(1, 'Façade', 'Extérieur', 'A009', 0)])).toThrow(/ordre/)
  })
})

describe('assemblerNomenclature', () => {
  it('lit un nœud et son parent', () => {
    const n = assemblerNomenclature([{ 'Code CFC': '226.1', 'Libellé': 'Crépi', 'Niveau': 4, 'Code parent': '226' }])
    expect(n[0]).toEqual({ code: '226.1', libelle: 'Crépi', niveau: 4, parentCode: '226' })
  })

  it('accepte une racine sans parent', () => {
    expect(assemblerNomenclature([{ 'Code CFC': '2', 'Libellé': 'BÂTIMENT', 'Niveau': 1, 'Code parent': null }])[0].parentCode).toBeNull()
  })

  it('refuse un niveau hors de 1 à 4', () => {
    expect(() => assemblerNomenclature([{ 'Code CFC': '2', 'Libellé': 'X', 'Niveau': 7, 'Code parent': null }])).toThrow(/niveau/)
  })
})

describe('assemblerPostes', () => {
  const poste = (patch: Ligne = {}): Ligne => ({
    'Code CFC': '211.1', 'Poste': 'Échafaudage de façade',
    'Déclencheur': 'Au moins un article « Échafaudage = Oui » avec des travaux chiffrés',
    'Unité': 'm²', 'Prix CHF HT': 35, 'Quantité': 'Surface à échafauder', 'Remarque': null, ...patch,
  })

  it('reconnaît les quatre postes du classeur', () => {
    const p = assemblerPostes([
      poste(),
      poste({ 'Code CFC': '285.0', 'Poste': 'Échafaudage cage', 'Déclencheur': 'Un article murs ou plafonds en état Mauvais', 'Unité': 'forfait', 'Prix CHF HT': 5000, 'Quantité': "1 par cage d'escalier" }),
      poste({ 'Code CFC': '287', 'Poste': 'Nettoyage', 'Déclencheur': 'Toujours', 'Prix CHF HT': 10, 'Quantité': 'Surface de plancher (SP)' }),
      poste({ 'Code CFC': '121', 'Poste': 'Protection', 'Déclencheur': 'Toujours', 'Unité': 'forfait', 'Prix CHF HT': 5000, 'Quantité': '1' }),
    ])
    expect(p.map((x) => x.declencheur)).toEqual(['echafaudage_facade', 'communs_mauvais', 'toujours', 'toujours'])
    expect(p.map((x) => x.regleQuantite)).toEqual(['surface_echafaudee', 'par_cage_escalier', 'surface_plancher', 'forfait'])
  })

  it('refuse un poste sans prix : il serait invisible au devis', () => {
    expect(() => assemblerPostes([poste({ 'Prix CHF HT': null })])).toThrow(/prix/)
  })

  it('refuse un déclencheur qu’il ne sait pas lire', () => {
    expect(() => assemblerPostes([poste({ 'Déclencheur': 'quand ça nous arrange' })])).toThrow(/déclencheur/)
  })
})

describe('controler', () => {
  const base = (patch: Partial<Parameters<typeof controler>[0]> = {}) => ({
    articles: [assemblerArticle(ligneArticle())],
    nomenclature: [{ code: '226.1', libelle: 'Crépi', niveau: 4, parentCode: '226' }],
    liens: [{ articleId: 'A015', etapeNumero: 1, ordreDansEtape: 1 }],
    etapes: [{ numero: 1, nom: 'Façade', zone: 'Extérieur' }],
    ...patch,
  })

  it('ne dit rien d’une base saine, hors travaux sans prix', () => {
    const a = controler(base())
    expect(a.filter((x) => x.gravite === 'bloquante')).toEqual([])
  })

  it('signale l’amélioration décrite sans prix, sans bloquer', () => {
    const a = controler(base())
    expect(a.find((x) => x.code === 'travaux_sans_prix')).toMatchObject({ gravite: 'avertissement', articleId: 'A015' })
  })

  it('bloque sur un code CFC absent de la nomenclature', () => {
    const a = controler(base({ nomenclature: [] }))
    expect(a.find((x) => x.code === 'cfc_inconnu')).toMatchObject({ gravite: 'bloquante' })
  })

  it('bloque sur un article sans étape', () => {
    const a = controler(base({ liens: [] }))
    expect(a.find((x) => x.code === 'sans_etape')).toMatchObject({ gravite: 'bloquante', articleId: 'A015' })
  })

  it('bloque sur un ordre de visite qui cite un article inconnu', () => {
    const a = controler(base({ liens: [{ articleId: 'A999', etapeNumero: 1, ordreDansEtape: 1 }] }))
    expect(a.map((x) => x.code)).toContain('lien_inconnu')
  })

  it('signale « Néant » avec un prix', () => {
    const articles = [assemblerArticle(ligneArticle({ 'Bon état – travaux': 'Néant', 'Bon état – prix': 80 }))]
    expect(controler(base({ articles })).find((x) => x.code === 'neant_avec_prix')).toBeTruthy()
  })
})
