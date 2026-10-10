import { describe, it, expect } from 'vitest'
import {
  arborescenceCfc, articlesDuNoeud, cheminDuCode, filtrerLArbre, noeudDeLArticle,
} from './arborescence'
import { articleSemblable, controlerLaBase, controlerLArticle, nomsProches } from './controles'
import { chercherDansLaBase, filtresPosés, valeursDeFiltre } from './recherche'
import type { ApiArticle, ApiNoeudCfc } from '../api-types'

const NOEUDS: ApiNoeudCfc[] = [
  { code: '2', libelle: 'BÂTIMENT', niveau: 1, parentCode: null },
  { code: '22', libelle: 'GROS-ŒUVRE 2', niveau: 2, parentCode: '2' },
  { code: '221', libelle: 'Fenêtres, portes extérieures', niveau: 3, parentCode: '22' },
  { code: '221.0', libelle: 'Fenêtres en bois', niveau: 4, parentCode: '221' },
  { code: '226', libelle: 'Crépissages de façade', niveau: 3, parentCode: '22' },
  { code: '226.1', libelle: 'Crépis et enduits extérieurs', niveau: 4, parentCode: '226' },
  { code: '23', libelle: 'INSTALLATIONS ÉLECTRIQUES', niveau: 2, parentCode: '2' },
  { code: '233', libelle: 'Lustrerie', niveau: 3, parentCode: '23' },
  { code: '4', libelle: 'AMÉNAGEMENTS EXTÉRIEURS', niveau: 1, parentCode: null },
  { code: '42', libelle: 'JARDINS', niveau: 2, parentCode: '4' },
]

const article = (o: Partial<ApiArticle>): ApiArticle => ({
  id: 'A015', cfcCode: '226.1', nom: 'Façade crépie non isolée', domaineRapport: 'Façades',
  groupeAlternatives: 'Revêtement de façade', echafaudage: true, uniteEntretien: 'm2',
  uniteRemplacement: 'm2', baseQuantite: 'surface_facade', indicationQuantite: null, coefficient: 1,
  noteDiagnostiqueur: null, articleLieId: null, actif: true, ligneOrigine: null,
  etats: [
    { etat: 'tres_bon', travaux: 'Néant', prix: null, partPrixMauvais: null, unite: 'm2' },
    { etat: 'mauvais', travaux: 'Piquage et réfection du crépi', prix: 180, partPrixMauvais: null, unite: 'm2' },
  ],
  etapes: [{ articleId: 'A015', etapeNumero: 1, ordreDansEtape: 8 }],
  ...o,
})

const A015 = article({})
const A019 = article({
  id: 'A019', cfcCode: '221.0', nom: 'Fenêtres en bois', domaineRapport: 'Fenêtres',
  groupeAlternatives: 'Fenêtres et vitrines', baseQuantite: 'surface_fenetres',
  etats: [{ etat: 'mauvais', travaux: 'Remplacement des fenêtres', prix: 950, partPrixMauvais: null, unite: 'm2' }],
  etapes: [{ articleId: 'A019', etapeNumero: 1, ordreDansEtape: 12 }],
})
const A057 = article({
  id: 'A057', cfcCode: '233', nom: 'Lustrerie', domaineRapport: 'Électricité',
  groupeAlternatives: null, echafaudage: false, baseQuantite: 'saisie_manuelle',
  etats: [{ etat: 'mauvais', travaux: 'Remplacement des luminaires', prix: null, partPrixMauvais: null, unite: 'pce' }],
  etapes: [{ articleId: 'A057', etapeNumero: 2, ordreDansEtape: 1 }],
})
const BASE = [A015, A019, A057]

describe('l’arborescence CFC', () => {
  it('range un article du quatrième niveau sous son parent', () => {
    const parCode = new Map(NOEUDS.map((n) => [n.code, n]))
    expect(noeudDeLArticle('226.1', parCode)).toBe('226')
    expect(noeudDeLArticle('233', parCode)).toBe('233')
  })

  it('range un code inconnu sous lui-même, pour qu’il se voie', () => {
    const parCode = new Map(NOEUDS.map((n) => [n.code, n]))
    expect(noeudDeLArticle('999.9', parCode)).toBe('999.9')
  })

  it('compte les articles de chaque branche, descendance comprise', () => {
    const arbre = arborescenceCfc(NOEUDS, BASE)
    const batiment = arbre.find((n) => n.code === '2')!
    expect(batiment.total).toBe(3)
    expect(batiment.enfants.find((n) => n.code === '22')!.total).toBe(2)
    expect(batiment.enfants.find((n) => n.code === '23')!.total).toBe(1)
  })

  it('n’affiche pas les branches sans article', () => {
    const arbre = arborescenceCfc(NOEUDS, BASE)
    expect(arbre.map((n) => n.code)).toEqual(['2'])
    expect(arbre[0].enfants.find((n) => n.code === '22')!.enfants.map((n) => n.code)).toEqual(['221', '226'])
  })

  it('montre la nomenclature entière quand on le demande', () => {
    const arbre = arborescenceCfc(NOEUDS, BASE, true)
    expect(arbre.map((n) => n.code)).toEqual(['2', '4'])
    expect(arbre.find((n) => n.code === '4')!.total).toBe(0)
  })

  it('ne descend pas sous le troisième niveau', () => {
    const arbre = arborescenceCfc(NOEUDS, BASE, true)
    const cent221 = arbre[0].enfants.find((n) => n.code === '22')!.enfants.find((n) => n.code === '221')!
    expect(cent221.enfants).toEqual([])
    expect(cent221.articles.map((a) => a.id)).toEqual(['A019'])
  })

  it('donne le chemin d’un code, pour ouvrir l’arbre au bon endroit', () => {
    expect(cheminDuCode('226.1', NOEUDS)).toEqual(['2', '22', '226'])
    expect(cheminDuCode('233', NOEUDS)).toEqual(['2', '23', '233'])
  })

  it('rend tous les articles d’une branche dans l’ordre du code', () => {
    const arbre = arborescenceCfc(NOEUDS, BASE)
    expect(articlesDuNoeud(arbre[0]).map((a) => a.id)).toEqual(['A019', 'A015', 'A057'])
  })

  it('filtre l’arbre sur le code et le libellé, accents ignorés', () => {
    const arbre = arborescenceCfc(NOEUDS, BASE)
    expect(filtrerLArbre(arbre, 'crepissages')[0].enfants[0].enfants.map((n) => n.code)).toEqual(['226'])
    expect(filtrerLArbre(arbre, '233')[0].enfants.map((n) => n.code)).toEqual(['23'])
    expect(filtrerLArbre(arbre, 'zzz')).toEqual([])
  })
})

describe('les contrôles qualité', () => {
  it('signale un « Néant » qui porte un prix', () => {
    const faux = article({
      etats: [{ etat: 'tres_bon', travaux: 'Néant', prix: 120, partPrixMauvais: null, unite: 'm2' }],
    })
    expect(controlerLArticle(faux).map((c) => c.raison)).toEqual(['neant_avec_prix'])
  })

  it('signale des travaux décrits sans prix', () => {
    expect(controlerLArticle(A057).map((c) => c.raison)).toEqual(['travaux_sans_prix'])
  })

  it('ne signale pas un « Néant » sans prix, qui est le cas normal', () => {
    expect(controlerLArticle(A015)).toEqual([])
  })

  it('signale un code CFC absent de la nomenclature', () => {
    const codes = new Set(NOEUDS.map((n) => n.code))
    const inconnu = article({ cfcCode: '999.9' })
    expect(controlerLArticle(inconnu, codes).map((c) => c.raison)).toEqual(['code_inconnu'])
    expect(controlerLArticle(A015, codes)).toEqual([])
  })

  it('signale un article actif sans étape de visite', () => {
    const orphelin = article({ etapes: [] })
    expect(controlerLArticle(orphelin).map((c) => c.raison)).toEqual(['sans_etape'])
  })

  it('ne réclame pas d’étape à un article désactivé', () => {
    expect(controlerLArticle(article({ etapes: [], actif: false }))).toEqual([])
  })

  it('signale un doublon probable, même code et nom proche', () => {
    const jumeau = article({ id: 'A900' })
    const c = controlerLaBase([A015, jumeau]).filter((x) => x.raison === 'doublon_probable')
    expect(c).toHaveLength(1)
    expect(c[0].articleId).toBe('A900')
    expect(c[0].message).toContain('A015')
  })

  it('ne prend pas deux matériaux voisins pour un doublon', () => {
    expect(nomsProches('Fenêtres en bois', 'Fenêtres en métal')).toBe(false)
    expect(nomsProches('Garde-corps vitré', 'Garde-corps à barreaudage')).toBe(false)
  })

  it('reconnaît un nom identique aux accents près', () => {
    expect(nomsProches('Façade crépie non isolée', 'Facade crepie non isolee')).toBe(true)
  })

  it('propose l’article semblable avant d’en créer un nouveau', () => {
    expect(articleSemblable(BASE, { cfcCode: '226.1', nom: 'Facade crepie non isolee' })?.id).toBe('A015')
    expect(articleSemblable(BASE, { cfcCode: '226.1', nom: 'Façade ventilée métallique' })).toBeNull()
  })
})

describe('la recherche dans la base', () => {
  it('cherche sur le nom, sans accents ni casse', () => {
    expect(chercherDansLaBase(BASE, { recherche: 'CREPIE' }).map((a) => a.id)).toEqual(['A015'])
  })

  it('cherche sur le code et sur l’identifiant', () => {
    expect(chercherDansLaBase(BASE, { recherche: '226' }).map((a) => a.id)).toEqual(['A015'])
    expect(chercherDansLaBase(BASE, { recherche: 'a057' }).map((a) => a.id)).toEqual(['A057'])
  })

  it('cherche dans les textes de travaux', () => {
    expect(chercherDansLaBase(BASE, { recherche: 'luminaires' }).map((a) => a.id)).toEqual(['A057'])
  })

  it('rend tout dans l’ordre du code CFC quand rien n’est demandé', () => {
    expect(chercherDansLaBase(BASE, {}).map((a) => a.cfcCode)).toEqual(['221.0', '226.1', '233'])
  })

  it('filtre par branche CFC, à n’importe quel niveau', () => {
    expect(chercherDansLaBase(BASE, { groupeCfc: '22' }).map((a) => a.id)).toEqual(['A019', 'A015'])
    expect(chercherDansLaBase(BASE, { groupeCfc: '226' }).map((a) => a.id)).toEqual(['A015'])
  })

  it('filtre par étape, par domaine, par groupe et par échafaudage', () => {
    expect(chercherDansLaBase(BASE, { etapeNumero: 2 }).map((a) => a.id)).toEqual(['A057'])
    expect(chercherDansLaBase(BASE, { domaineRapport: 'Façades' }).map((a) => a.id)).toEqual(['A015'])
    expect(chercherDansLaBase(BASE, { groupeAlternatives: 'Fenêtres et vitrines' }).map((a) => a.id)).toEqual(['A019'])
    expect(chercherDansLaBase(BASE, { echafaudage: false }).map((a) => a.id)).toEqual(['A057'])
  })

  it('cache les articles retirés du catalogue, sauf si on les demande', () => {
    const retire = article({ id: 'A900', actif: false })
    expect(chercherDansLaBase([...BASE, retire], {}).map((a) => a.id)).not.toContain('A900')
    expect(chercherDansLaBase([...BASE, retire], { inactifs: true }).map((a) => a.id)).toContain('A900')
  })

  it('ne garde que les articles qui portent un défaut donné', () => {
    const controles = controlerLaBase(BASE)
    expect(chercherDansLaBase(BASE, { controle: 'travaux_sans_prix' }, controles).map((a) => a.id)).toEqual(['A057'])
    expect(chercherDansLaBase(BASE, { controle: 'neant_avec_prix' }, controles)).toEqual([])
  })

  it('cumule les filtres', () => {
    expect(chercherDansLaBase(BASE, { groupeCfc: '22', echafaudage: true, recherche: 'facade' }).map((a) => a.id))
      .toEqual(['A015'])
  })

  it('ne propose que les valeurs qui existent', () => {
    const v = valeursDeFiltre(BASE)
    expect(v.domaines).toEqual(['Électricité', 'Façades', 'Fenêtres'])
    expect(v.groupes).toEqual(['Fenêtres et vitrines', 'Revêtement de façade'])
  })

  it('sait dire si un filtre est posé', () => {
    expect(filtresPosés({})).toBe(false)
    expect(filtresPosés({ recherche: '  ' })).toBe(false)
    expect(filtresPosés({ etapeNumero: 1 })).toBe(true)
  })
})
