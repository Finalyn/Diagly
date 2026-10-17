import { describe, it, expect } from 'vitest'
import {
  apresUnePerte, appliquerAnalyse, completerBatiment, corrigerFeuille, enCoursParTache, etatAnalyse, libelleFeuille,
  lotDeLaPage, mettreEnCours, mettreEnFile, multiplicateur, nomProvisoire, prochainLot, retirerDeLaFile, statutEchelle,
  echellesAPoser, poserDansLaTable,
  type FeuilleEnFile,
} from './feuilles'
import type { ApiPlan, FeuillesPlan, PageAnalysee, PlanAnnotation } from '../api-types'
import type { EchelleDePage } from './analyse-ia'

const LE = '2026-10-17T10:00:00.000Z'
const page = (n: number, extra: Partial<PageAnalysee> = {}): PageAnalysee => ({
  page: n, type: 'plan_etage', feuille: `A-10${n}`, titre: `Plan ${n}`, niveau: 'Rez', etagesIdentiques: 1,
  orientation: null, echelle: '1:100', echelleOu: 'cartouche', cote: null, remarque: null, ...extra,
})
const echelle = (n: number): EchelleDePage => ({
  page: n, type: 'plan_etage', titre: null, statut: 'non-verifiee', pxParM: 38.1, exacte: true,
  imprimee: { denominateur: 100, pxParM: 38.1, ou: 'cartouche' }, cote: null, ecart: null, resume: '1:100 au cartouche',
})

describe('la file d’analyse', () => {
  const feuilles = (etats: [string, number, FeuilleEnFile['etat']][]): FeuilleEnFile[] =>
    etats.map(([planId, p, etat]) => ({ planId, page: p, etat }))

  it('prend le premier document qui a des pages en file, huit pages au plus, sans mêler deux documents', () => {
    const jeu = feuilles([
      ['a', 1, 'prete'], ['a', 2, 'en_file'],
      ...Array.from({ length: 10 }, (_, i) => ['b', i + 1, 'en_file'] as [string, number, FeuilleEnFile['etat']]),
    ])
    expect(prochainLot(jeu)).toEqual({ planId: 'a', pages: [2] })
    expect(prochainLot(jeu.slice(2))).toEqual({ planId: 'b', pages: [1, 2, 3, 4, 5, 6, 7, 8] })
  })

  it('ne relance rien de ce qui est prêt, en cours, en erreur ou jamais demandé', () => {
    expect(prochainLot(feuilles([['a', 1, 'prete'], ['a', 2, 'en_cours'], ['a', 3, 'erreur'], ['a', 4, 'aucune']]))).toBeNull()
  })

  it('passe les pages en file, puis en cours avec leur tâche, et les regroupe par tâche', () => {
    let f: FeuillesPlan = { pages: {} }
    f = mettreEnFile(f, [1, 2, 3], LE)
    expect(f.pages['2'].analyse).toEqual({ statut: 'en_file', depuis: LE, tentatives: 0 })
    f = mettreEnCours(f, [1, 2], LE, 't1')
    f = mettreEnCours(f, [3], LE, null)
    expect(enCoursParTache(f)).toEqual(new Map([['t1', [1, 2]], [null, [3]]]))
    f = retirerDeLaFile(f, [3])
    expect(f.pages['3'].analyse).toBeNull()
  })

  it('remet une analyse perdue en file une fois, puis la laisse en erreur', () => {
    let f = mettreEnCours({ pages: {} }, [1], LE, 't1')
    f = apresUnePerte(f, [1], LE)
    expect(f.pages['1'].analyse?.statut).toBe('en_file')
    f = mettreEnCours(f, [1], LE, 't2')
    f = apresUnePerte(f, [1], LE)
    expect(f.pages['1'].analyse).toMatchObject({ statut: 'erreur', tentatives: 2 })
  })

  it('tient pour analysée une page qui porte déjà des propositions de l’éditeur', () => {
    const plan = (annotations: PlanAnnotation[]) => ({ mimeType: 'application/pdf', annotations })
    const proposee: PlanAnnotation = { id: 'z', type: 'hatch', page: 2, points: [], proposition: { type: 'facade' } as never }
    expect(etatAnalyse(plan([proposee]), { pages: {} }, 2)).toBe('prete')
    expect(etatAnalyse(plan([proposee]), { pages: {} }, 1)).toBe('aucune')
    expect(etatAnalyse(plan([]), mettreEnFile({ pages: {} }, [1], LE), 1)).toBe('en_file')
  })
})

describe('ce qu’une analyse écrit sur les feuilles', () => {
  const resultat = (pages: PageAnalysee[], extra = {}) => ({
    numeros: [1, 2], pages, echelles: [echelle(1)], ecartees: [{ page: 2, libelle: 'Fenêtre', raison: 'contour qui se recoupe' }],
    sansGeometrie: [2], tronque: false, comptages: [{ categorie: 'fenetre' as const, nombre: 12, surface: null, detail: null, pages: [1, 2], confiance: 'haute' as const }],
    remarques: 'Cotes peu lisibles.', le: LE, ...extra,
  })

  it('écrit le cartouche, l’échelle proposée et l’état de chaque page, et garde les totaux avec le lot', () => {
    const f = appliquerAnalyse(mettreEnCours({ pages: {} }, [1, 2], LE, 't'), resultat([
      page(1), page(2, { feuille: 'A-102', titre: 'Étage type (1er au 3e)', niveau: '1er au 3e', etagesIdentiques: 3 }),
    ]))
    expect(f.pages['1']).toMatchObject({ numero: 'A-101', type: 'plan_etage', niveau: 'Rez', echelle: { statut: 'non-verifiee' }, analyse: { statut: 'prete', depuis: LE } })
    expect(f.pages['2']).toMatchObject({ numero: 'A-102', niveau: '1er au 3e', etagesIdentiques: 3, echelle: null, sansGeometrie: true })
    expect(f.pages['2'].ecartees).toHaveLength(1)
    expect(f.pages['1'].ecartees).toEqual([])
    expect(lotDeLaPage(f, 2)?.comptages[0].nombre).toBe(12)
    expect(multiplicateur(f.pages['2'])).toBe(3)
    expect(multiplicateur(f.pages['1'])).toBe(1)
  })

  it('ne revient pas sur une correction faite à la main', () => {
    let f = appliquerAnalyse({ pages: {} }, resultat([page(1), page(2, { etagesIdentiques: 3 })]))
    f = corrigerFeuille(f, 2, { etagesIdentiques: 4, titre: 'Étages 1 à 4' })
    expect(f.pages['2'].corrige).toEqual(['etagesIdentiques', 'titre'])
    f = appliquerAnalyse(f, resultat([page(1), page(2, { etagesIdentiques: 3, titre: 'Étage type' })]))
    expect(f.pages['2']).toMatchObject({ etagesIdentiques: 4, titre: 'Étages 1 à 4', numero: 'A-102' })
  })

  it('remplace le lot d’une page relancée au lieu d’en empiler deux', () => {
    let f = appliquerAnalyse({ pages: {} }, resultat([page(1), page(2)]))
    f = appliquerAnalyse(f, resultat([page(2)], { numeros: [2] }))
    expect(f.lots).toHaveLength(1)
    expect(f.lots![0].pages).toEqual([2])
  })
})

describe('la lecture d’une feuille', () => {
  it('nomme la feuille d’après son cartouche', () => {
    expect(libelleFeuille({ numero: 'A-101', titre: 'Plan du rez' }, 1)).toBe('A-101 · Plan du rez')
    expect(libelleFeuille({ titre: 'Façade sud' }, 3)).toBe('Façade sud')
    expect(libelleFeuille({}, 3, 'Jeu complet')).toBe('Jeu complet, page 3')
  })

  it('dit si l’échelle est vérifiée, posée, proposée, incohérente ou absente', () => {
    const plan: Pick<ApiPlan, 'scalePxPerM' | 'annotations'> = {
      scalePxPerM: null, annotations: [{ id: 'pages', type: 'pages', points: [], pageScales: { 1: 38.1 } }],
    }
    expect(statutEchelle(plan, {}, 1)).toBe('posee')
    expect(statutEchelle(plan, { echelle: { ...echelle(1), statut: 'verifiee' } }, 1)).toBe('verifiee')
    expect(statutEchelle(plan, { echelle: { ...echelle(1), statut: 'verifiee', pxParM: 40 } }, 1)).toBe('posee')
    expect(statutEchelle(plan, { echelle: echelle(2) }, 2)).toBe('a_verifier')
    expect(statutEchelle(plan, { echelle: { ...echelle(2), statut: 'conflit', pxParM: null } }, 2)).toBe('incoherente')
    expect(statutEchelle(plan, { echelle: { ...echelle(2), statut: 'aucune' } }, 2)).toBe('aucune')
  })
})

describe('les échelles posées en lot', () => {
  const f: FeuillesPlan = {
    nombre: 4,
    pages: {
      1: { echelle: { ...echelle(1), statut: 'verifiee', pxParM: 38.1 } },
      2: { echelle: { ...echelle(2), statut: 'non-verifiee', pxParM: 76.2 } },
      3: { echelle: { ...echelle(3), statut: 'conflit', pxParM: null } },
      4: { echelle: { ...echelle(4), statut: 'verifiee', pxParM: 38.1 } },
    },
  }
  const plan: Pick<ApiPlan, 'mimeType' | 'scalePxPerM' | 'annotations'> = {
    mimeType: 'application/pdf', scalePxPerM: null,
    annotations: [{ id: 'pages', type: 'pages', points: [], pageScales: { 4: 50 } }],
  }

  it('posent d’office les seules échelles vérifiées, jamais par-dessus une échelle posée', () => {
    expect(echellesAPoser(plan, f, { seulementVerifiees: true })).toEqual({ 1: 38.1 })
  })

  it('posent sur demande toutes les échelles proposées, sauf celles qui se contredisent', () => {
    expect(echellesAPoser(plan, f)).toEqual({ 1: 38.1, 2: 76.2 })
  })

  it('complètent la table du plan sans toucher aux autres pages', () => {
    const r = poserDansLaTable(plan, 4, { 1: 38.1, 2: 76.2 })
    expect(r.scalePxPerM).toBe(38.1)
    expect(r.annotations.find((a) => a.type === 'pages')!.pageScales).toEqual({ 1: 38.1, 2: 76.2, 4: 50 })
  })

  it('recopient d’abord l’échelle d’un plan étalonné d’un bloc sur chacune de ses pages', () => {
    const r = poserDansLaTable({ ...plan, scalePxPerM: 20, annotations: [] }, 3, { 2: 76.2 })
    expect(r.annotations.find((a) => a.type === 'pages')!.pageScales).toEqual({ 1: 20, 2: 76.2, 3: 20 })
    expect(r.scalePxPerM).toBe(20)
  })
})

describe('le bâtiment d’un dépôt', () => {
  it('tire un nom provisoire du nom de fichier', () => {
    expect(nomProvisoire('plans_rue-du-lac_12.pdf')).toBe('plans rue du lac 12')
    expect(nomProvisoire('Immeuble Les Tilleuls - A101.PDF')).toBe('Immeuble Les Tilleuls - A101')
    expect(nomProvisoire('.pdf')).toBe('Bâtiment sans nom')
  })

  const projet = { name: 'plans rue du lac 12', address: '', postalCode: null, city: '', canton: 'VD' }
  const lu = { nom: 'Immeuble Les Essais', adresse: 'Chemin du Contrôle 12', npa: '1004', localite: 'Lausanne', canton: 'VD' }

  it('complète un dossier ouvert depuis un dépôt avec ce que dit le cartouche', () => {
    expect(completerBatiment(projet, lu, ['plans rue du lac 12'])).toEqual({
      name: 'Immeuble Les Essais', address: 'Chemin du Contrôle 12', postalCode: '1004', city: 'Lausanne',
    })
    expect(completerBatiment(projet, { ...lu, canton: 'GE' }, ['plans rue du lac 12'])?.canton).toBe('GE')
  })

  it('ne touche ni un nom choisi ni une adresse déjà saisie', () => {
    expect(completerBatiment({ ...projet, name: 'Villa Dupraz' }, lu, ['plans rue du lac 12'])?.name).toBeUndefined()
    const saisi = { name: 'Villa Dupraz', address: 'Rue Haute 1', postalCode: '1400', city: 'Yverdon', canton: 'VD' }
    expect(completerBatiment(saisi, lu, ['plans rue du lac 12'])).toBeNull()
    expect(completerBatiment(projet, null, [])).toBeNull()
  })
})
