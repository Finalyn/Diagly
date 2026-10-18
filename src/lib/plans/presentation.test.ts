import { describe, it, expect } from 'vitest'
import {
  CLE_SIA416, OPTIONS_PRESENTATION, PHOTOS_MAX, cadrer, composerPresentation, echelleGraphique, elementsMetres, feuillesARendre,
  milieuDuTrace, nomDuPdf, ordonnerParNiveau, photosDeLElement, rangDuNiveau,
  type ContextePresentation, type DiapoReperage, type DiapoTableau, type Diapositive, type OuvragePresentation,
} from './presentation'
import { entreesSia416, panneauDesQuantites, quantiteLisible, type PlanPourQuantites } from './quantites'
import { surfacesSia416 } from './sia416'
import type { PlanAnnotation, TypeZoneIA } from '../api-types'
import type { CategorieComptee } from '../base-cfc/comptages'

/** 10 px par mètre sur les pages 1 à 4 ; la page 5 n'a pas d'échelle. */
const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10, 3: 10, 4: 10 } }

let n = 0
const rect = (page: number, l: number, h: number, typeZone?: TypeZoneIA, extra: Partial<PlanAnnotation> = {}, x = 0, y = 0): PlanAnnotation => ({
  id: `z${n++}`, type: 'hatch', page, typeZone,
  points: [{ x: x * 10, y: y * 10 }, { x: (x + l) * 10, y: y * 10 }, { x: (x + l) * 10, y: (y + h) * 10 }, { x: x * 10, y: (y + h) * 10 }], ...extra,
})
const repere = (page: number, categorie: CategorieComptee, numero: number, extra: Partial<NonNullable<PlanAnnotation['repere']>> = {}): PlanAnnotation => ({
  id: `r${n++}`, type: 'repere', page, points: [{ x: 50 + numero * 10, y: 50 }], repere: { categorie, numero, ...extra },
})

const paliere2 = repere(2, 'porte_paliere', 2)
const paliere1 = repere(2, 'porte_paliere', 1)
const jeu: PlanPourQuantites[] = [{
  plan: {
    id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
    annotations: [
      ECHELLE,
      rect(1, 12, 9, 'emprise'), rect(1, 4, 5, 'piece', { text: 'Séjour', itemId: 'it-sol' }), rect(1, 3, 4, 'piece', { text: 'Couloir' }, 5, 0),
      rect(1, 2, 2, 'piece', { proposition: { type: 'piece', libelle: 'Bain', confiance: 'basse' } as never }),
      repere(1, 'fenetre', 1), repere(1, 'fenetre', 2),
      rect(2, 12, 9, 'emprise'), rect(2, 4, 5, 'piece', { text: 'Chambre', sia416: 'SUS' }),
      paliere2, paliere1, repere(2, 'porte_interieure', 1), repere(2, 'fenetre', 3, { aValider: true }),
      rect(3, 5, 4, 'piece', { text: 'Cave' }),
      rect(4, 12, 8, 'facade'), rect(4, 1.2, 1.5, 'fenetre', { itemId: 'it-fen' }, 1, 1), rect(4, 1.2, 1.5, 'fenetre', { itemId: 'it-fen' }, 4, 1),
      rect(4, 1, 2, 'porte', {}, 6, 0), repere(4, 'fenetre', 1),
      rect(5, 3, 3, 'piece', { text: 'Grenier' }),
    ],
  },
  feuilles: {
    pages: {
      1: { type: 'plan_etage', numero: '101', titre: 'Plan du rez', niveau: 'Rez', etagesIdentiques: 1 },
      2: { type: 'plan_etage', numero: '102', titre: 'Étage type (1er au 3e)', niveau: '1er au 3e', etagesIdentiques: 3 },
      3: { type: 'plan_etage', numero: '103', titre: 'Plan du sous-sol', niveau: 'Sous-sol' },
      4: { type: 'elevation', numero: '201', titre: 'Façade sud' },
      5: { type: 'plan_etage', titre: 'Combles' },
    },
  },
}]

const panneau = panneauDesQuantites(jeu)
const sia = surfacesSia416(entreesSia416(panneau))
const ouvrages: OuvragePresentation[] = [
  { id: 'it-sol', cfcCode: '281', libelle: 'Revêtements de sol', etat: 'MOYEN', photos: ['data:sol-1'] },
  { id: 'it-fen', cfcCode: '221.2', libelle: 'Fenêtres bois', etat: 'MAUVAIS', photos: ['data:fen-1', 'data:fen-2'] },
  { id: 'it-pal', cfcCode: '273', libelle: 'Portes palières bois', etat: 'BON', photos: ['data:pal-1'], categorie: 'porte_paliere' },
]
const elements = elementsMetres(panneau, jeu, ouvrages)
const element = (cle: string) => elements.find((e) => e.cle === cle)!
const ctx: ContextePresentation = { batiment: 'Immeuble Les Essais', adresse: 'Rue des Essais 4, 1000 Lausanne', date: new Date(2026, 9, 18), ouvrages, photoDeGarde: null }
const diapos = composerPresentation(elements, sia, ctx, OPTIONS_PRESENTATION)
const derivee = (cle: string, d: string) => panneau.classifications.find((c) => c.cle === cle)!.derivees.find((x) => x.cle === d)!.valeur

describe('les niveaux', () => {
  it('rangent les feuilles du sous-sol à la toiture', () => {
    expect(rangDuNiveau('2e sous-sol')).toBe(-2)
    expect(rangDuNiveau('Sous-sol')).toBe(-1)
    expect(rangDuNiveau('Rez inférieur')).toBe(-0.5)
    expect(rangDuNiveau('Rez')).toBe(0)
    expect(rangDuNiveau('Plan du rez-de-chaussée')).toBe(0)
    expect(rangDuNiveau('1er au 3e')).toBe(1)
    expect(rangDuNiveau('Étage type (1er au 3e)')).toBe(1)
    expect(rangDuNiveau('2e étage')).toBe(2)
    expect(rangDuNiveau('Étage 4')).toBe(4)
    expect(rangDuNiveau('Combles')).toBe(50)
    expect(rangDuNiveau('Façade sud')).toBeNull()
  })

  it('mettent les niveaux connus d’abord, le reste dans l’ordre du jeu', () => {
    const noms = ['Façade sud', '1er', 'Coupe A', 'Sous-sol', 'Rez']
    expect(ordonnerParNiveau(noms, (x) => x, (x) => noms.indexOf(x))).toEqual(['Sous-sol', 'Rez', '1er', 'Façade sud', 'Coupe A'])
  })
})

describe('les éléments métrés', () => {
  it('suivent le panneau, chaque catégorie comptée à part, sans ce qui n’est pas validé', () => {
    expect(elements.map((e) => e.cle)).toEqual(['pieces', 'facades', 'fenetres', 'portes', 'dalles', 'cat:porte_paliere', 'cat:porte_interieure', 'cat:fenetre'])
    const pieces = element('pieces')
    expect(pieces.etages.flatMap((x) => x.formes.map((f) => f.nom))).not.toContain('Bain')
    // Le grenier est sur une feuille sans échelle : hors total, et dit.
    expect(pieces.etages.flatMap((x) => x.formes.map((f) => f.nom))).not.toContain('Grenier')
    expect(pieces.sansEchelle).toBe(1)
  })

  it('reprennent les totaux du panneau, étages identiques compris', () => {
    const pieces = element('pieces')
    expect(pieces.totaux.map((d) => d.cle)).toEqual(['surface', 'plinthes', 'nombre'])
    expect(pieces.totaux[0].valeur).toBeCloseTo(derivee('pieces', 'surface'), 9)
    expect(pieces.totaux[0].valeur).toBeCloseTo(20 + 20 + 12 + 20 * 3, 9)
    expect(element('fenetres').totaux.map((d) => d.valeur)).toEqual(panneau.classifications.find((c) => c.cle === 'fenetres')!.derivees.map((d) => d.valeur))
    // Une catégorie comptée : son seul nombre, celui que le panneau range sous « Éléments comptés ».
    expect(element('cat:porte_paliere').totaux).toEqual([expect.objectContaining({ cle: 'nombre', valeur: 6, unite: 'pce' })])
    expect(element('cat:porte_paliere').totaux[0].valeur).toBe(derivee('elements', 'cat-porte_paliere'))
    expect(element('cat:fenetre').totaux[0].valeur).toBe(derivee('elements', 'cat-fenetre'))
  })

  it('rangent les niveaux du sous-sol vers le haut et numérotent les formes d’un bout à l’autre', () => {
    const pieces = element('pieces')
    expect(pieces.etages.map((x) => x.feuille.niveau)).toEqual(['Sous-sol', 'Rez', '1er au 3e'])
    expect(pieces.etages.map((x) => x.formes.map((f) => `${f.numero} ${f.nom}`))).toEqual([['1 Cave'], ['2 Séjour', '3 Couloir'], ['4 Chambre']])
    // Les repères gardent l'ordre de leurs numéros sur la feuille.
    expect(element('cat:porte_paliere').etages[0].formes.map((f) => [f.id, f.numero])).toEqual([[paliere1.id, 1], [paliere2.id, 2]])
  })

  it('laissent de côté un repère d’élévation déjà compté sur un plan d’étage', () => {
    const f = element('cat:fenetre')
    expect(f.etages.map((x) => x.feuille.niveau)).toEqual(['Rez'])
    expect(f.dejaComptes).toBe(1)
    expect(f.totaux[0].valeur).toBe(2)
  })

  it('cadrent chaque feuille sur ce qui y est dessiné, au format de la place du plan', () => {
    const f = element('pieces').etages[1].feuille
    expect(f.libelle).toBe('101 Plan du rez')
    expect(f.cadre.largeur / f.cadre.hauteur).toBeCloseTo(860 / 520, 6)
    // L'emprise (120 × 90 px) est dans le cadre, marge comprise.
    expect(f.cadre.x).toBeLessThan(0)
    expect(f.cadre.x + f.cadre.largeur).toBeGreaterThan(120)
    expect(f.cadre.y + f.cadre.hauteur).toBeGreaterThan(90)
    expect(f.echelle).toBe(10)
  })

  it('donnent les codes CFC des ouvrages rattachés', () => {
    expect(element('fenetres').etages[0].cfc).toEqual(['221.2'])
    expect(element('pieces').etages[1].cfc).toEqual(['281'])
    expect(element('portes').etages[0].cfc).toEqual([])
  })
})

describe('les diapositives', () => {
  const types = (ds: Diapositive[]) => ds.map((d) => (d.type === 'reperage' || d.type === 'tableau' || d.type === 'existant' ? `${d.type}:${d.element.cle}` : d.type))

  it('s’enchaînent : titre, chaque élément (repérages, tableau, existant), SIA 416 après les pièces, récapitulatif', () => {
    expect(types(diapos)).toEqual([
      'titre',
      'reperage:pieces', 'reperage:pieces', 'reperage:pieces', 'tableau:pieces', 'existant:pieces',
      'sia-plan', 'sia-plan', 'sia-plan', 'sia-tableau',
      'reperage:facades', 'tableau:facades',
      'reperage:fenetres', 'tableau:fenetres', 'existant:fenetres',
      'reperage:portes', 'tableau:portes',
      'reperage:dalles', 'reperage:dalles', 'tableau:dalles',
      'reperage:cat:porte_paliere', 'tableau:cat:porte_paliere', 'existant:cat:porte_paliere',
      'reperage:cat:porte_interieure', 'tableau:cat:porte_interieure',
      'reperage:cat:fenetre', 'tableau:cat:fenetre',
      'recapitulatif',
    ])
  })

  it('titrent un repérage de l’élément et de sa feuille, avec la quantité de la feuille', () => {
    const r = diapos.find((d): d is DiapoReperage => d.type === 'reperage' && d.element.cle === 'cat:porte_paliere')!
    expect(r.titre).toBe('Portes palières · 102 Étage type (1er au 3e)')
    expect(r.sousTitre).toBe('3 étages identiques')
    expect(r.quantite).toBe('2 pce')
    expect(r.etages).toBe('× 3 étages identiques = 6 pce')
    expect(r.formes.every((f) => f.couleur === r.element.couleur)).toBe(true)
    expect(r.liste).toEqual([])
    expect(r.detail).toEqual([])
    const sejour = diapos.find((d): d is DiapoReperage => d.type === 'reperage' && d.element.cle === 'pieces' && d.feuille.page === 1)!
    expect(sejour.liste).toEqual([{ numero: 2, nom: 'Séjour', quantite: quantiteLisible(20, 'm²') }, { numero: 3, nom: 'Couloir', quantite: quantiteLisible(12, 'm²') }])
    expect(sejour.detail).toEqual([`Plinthes ${quantiteLisible(18 + 14, 'ml')}`, 'Pièces 2 pce'])
  })

  it('tiennent le tableau par niveau : les numéros, chaque étage type multiplié, le total général', () => {
    const t = diapos.find((d): d is DiapoTableau => d.type === 'tableau' && d.element.cle === 'cat:porte_paliere')!
    expect(t.colonnes.map((c) => c.libelle)).toEqual(['Nombre'])
    expect(t.lignes).toEqual([expect.objectContaining({ niveau: '1er au 3e', numeros: '1 à 2', multiplicateur: 3, cellules: [{ total: '6 pce', parEtage: '2 pce par étage' }] })])
    expect(t.total).toEqual(['6 pce'])
    expect(t.avecCfc).toBe(false)
    // La carte du total reprend le total général et donne la part de chaque niveau.
    expect(t.synthese).toEqual({ total: '6 pce', libelle: 'Nombre', autres: [], barres: [{ cle: 'p#2', niveau: '1er au 3e', multiplicateur: 3, valeur: '6 pce', part: 1 }] })

    const p = diapos.find((d): d is DiapoTableau => d.type === 'tableau' && d.element.cle === 'pieces')!
    expect(p.colonnes.map((c) => c.libelle)).toEqual(['Sol', 'Plinthes', 'Pièces'])
    expect(p.lignes.map((l) => [l.niveau, l.numeros, l.cellules[0].total, l.cellules[0].parEtage])).toEqual([
      ['Sous-sol', '1', quantiteLisible(20, 'm²'), null],
      ['Rez', '2 à 3', quantiteLisible(32, 'm²'), null],
      ['1er au 3e', '4', quantiteLisible(60, 'm²'), `${quantiteLisible(20, 'm²')} par étage`],
    ])
    expect(p.total![0]).toBe(quantiteLisible(112, 'm²'))
    expect(p.synthese!.total).toBe(p.total![0])
    expect(p.synthese!.autres).toEqual([`Plinthes ${p.total![1]}`, `Pièces ${p.total![2]}`])
    expect(p.synthese!.barres.map((b) => [b.niveau, b.valeur, b.part])).toEqual([
      ['Sous-sol', quantiteLisible(20, 'm²'), 20 / 112], ['Rez', quantiteLisible(32, 'm²'), 32 / 112], ['1er au 3e', quantiteLisible(60, 'm²'), 60 / 112],
    ])
    expect(p.synthese!.barres.reduce((s, b) => s + b.part, 0)).toBeCloseTo(1, 9)
    expect(p.avecCfc).toBe(true)
    expect(p.notes).toEqual(['1 forme sur une feuille sans échelle, hors total.'])

    const f = diapos.find((d): d is DiapoTableau => d.type === 'tableau' && d.element.cle === 'cat:fenetre')!
    expect(f.notes).toEqual(['1 repère d’élévation déjà compté sur un plan d’étage, hors total.'])
  })

  it('posent les surfaces SIA 416 par catégorie, avec la mention', () => {
    const plan = diapos.find((d) => d.type === 'sia-plan' && d.feuille.page === 2)
    expect(plan?.type === 'sia-plan' && plan.formes.map((f) => f.categorie)).toEqual(['SUS'])
    const tableau = diapos.find((d) => d.type === 'sia-tableau')!
    expect(tableau.type === 'sia-tableau' && tableau.mention).toBe('À vérifier, selon SIA 416:2003')
    expect(tableau.type === 'sia-tableau' && tableau.lignes.map((l) => l.niveau)).toEqual(['Sous-sol', 'Rez', '1er au 3e'])
    // La SN partagée entre ses catégories : les parts font le tout, la pièce sans affectation comprise.
    const parts = tableau.type === 'sia-tableau' ? tableau.synthese.parts : []
    expect(parts.reduce((s, x) => s + x.part, 0)).toBeCloseTo(1, 9)
    expect(tableau.type === 'sia-tableau' && tableau.synthese.sn).toBe(quantiteLisible(sia.total.sn, 'm²'))
  })

  it('montrent les photos des ouvrages rattachés, et seulement elles', () => {
    const fen = diapos.find((d) => d.type === 'existant' && d.element.cle === 'fenetres')
    expect(fen?.type === 'existant' && fen.titre).toBe('Existant · Fenêtres')
    expect(fen?.type === 'existant' && fen.photos).toEqual([
      { src: 'data:fen-1', legende: '221.2 · Fenêtres bois', etat: 'MAUVAIS' },
      { src: 'data:fen-2', legende: '221.2 · Fenêtres bois', etat: 'MAUVAIS' },
    ])
    // Un élément compté prend les photos des relevés de sa catégorie.
    expect(photosDeLElement(element('cat:porte_paliere'), ouvrages).map((p) => p.src)).toEqual(['data:pal-1'])
    expect(photosDeLElement(element('facades'), ouvrages)).toEqual([])
  })

  it('prennent une photo par ouvrage d’abord, et six au plus', () => {
    const beaucoup: OuvragePresentation[] = [
      { id: 'a', cfcCode: null, libelle: 'A', etat: null, photos: ['a1', 'a2', 'a3', 'a4'] },
      { id: 'b', cfcCode: null, libelle: 'B', etat: null, photos: ['b1', 'b2', 'b3', 'b4'] },
    ]
    const e = { ...element('fenetres'), ouvrages: ['a', 'b'] }
    const photos = photosDeLElement(e, beaucoup).map((p) => p.src)
    expect(photos).toHaveLength(PHOTOS_MAX)
    expect(photos).toEqual(['a1', 'b1', 'a2', 'b2', 'a3', 'b3'])
  })

  it('sortent entières sans diagnostic, sans aucune diapositive de l’existant', () => {
    const sans = composerPresentation(elementsMetres(panneau, jeu), sia, { ...ctx, ouvrages: [] }, OPTIONS_PRESENTATION)
    expect(sans.some((d) => d.type === 'existant')).toBe(false)
    expect(sans.filter((d) => d.type === 'tableau')).toHaveLength(8)
    expect(sans.find((d) => d.type === 'tableau' && d.element.cle === 'pieces')).toMatchObject({ avecCfc: false })
  })

  it('suivent les options : éléments écartés, sans titre, sans photos, sans récapitulatif, sans SIA 416', () => {
    const d = composerPresentation(elements, sia, ctx, { ...OPTIONS_PRESENTATION, exclus: ['pieces', 'dalles', CLE_SIA416], titre: false, photos: false, recapitulatif: false })
    expect(d[0].type).toBe('reperage')
    expect(d.some((x) => x.type === 'existant' || x.type === 'recapitulatif' || x.type === 'sia-plan' || x.type === 'sia-tableau')).toBe(false)
    expect(d.some((x) => (x.type === 'reperage' || x.type === 'tableau') && (x.element.cle === 'pieces' || x.element.cle === 'dalles'))).toBe(false)
  })

  it('mettent la photo de garde en titre, sinon le premier plan', () => {
    const titre = diapos[0]
    expect(titre.type === 'titre' && titre.image?.genre).toBe('plan')
    expect(titre.type === 'titre' && titre.date).toBe('18 octobre 2026')
    const avecPhoto = composerPresentation(elements, sia, { ...ctx, photoDeGarde: 'data:garde' }, OPTIONS_PRESENTATION)[0]
    expect(avecPhoto.type === 'titre' && avecPhoto.image).toEqual({ genre: 'photo', src: 'data:garde' })
  })

  it('ne sortent rien sans forme validée', () => {
    const vide = panneauDesQuantites([{ ...jeu[0], plan: { ...jeu[0].plan, annotations: [ECHELLE, rect(1, 2, 2, 'piece', { proposition: { type: 'piece', libelle: 'X', confiance: 'haute' } as never })] } }])
    expect(composerPresentation(elementsMetres(vide, jeu), surfacesSia416([]), ctx, OPTIONS_PRESENTATION)).toEqual([])
  })

  it('demandent chaque feuille une fois, en retrait pour les repérages, telle quelle pour le titre', () => {
    const f = feuillesARendre(diapos, true)
    expect(f.filter((x) => !x.attenue).map((x) => x.feuille.cle)).toEqual(['p#3'])
    expect(f.filter((x) => x.attenue).map((x) => x.feuille.cle).sort()).toEqual(['p#1', 'p#2', 'p#3', 'p#4'])
  })
})

describe('les outils de mise en page', () => {
  it('cadrent au format voulu, centré sur les formes, jamais à bout portant', () => {
    const c = cadrer({ x: 100, y: 100, largeur: 10, hauteur: 10 }, 2)
    expect(c.largeur).toBeGreaterThanOrEqual(480)
    expect(c.largeur / c.hauteur).toBeCloseTo(2, 9)
    expect(c.x + c.largeur / 2).toBeCloseTo(105, 9)
  })

  it('trouvent le milieu d’un tracé à mi-longueur', () => {
    expect(milieuDuTrace([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }])).toEqual({ x: 10, y: 10 })
  })

  it('choisissent une échelle graphique ronde et lisible', () => {
    // 10 px par mètre, un pixel de diapositive pour un du repère : 10 m font 100 px.
    expect(echelleGraphique(10, 1)).toEqual({ metres: 10, longueur: 100 })
    expect(echelleGraphique(50, 2)).toEqual({ metres: 5, longueur: 125 })
    // 2 m feraient 75 px, 5 m en font 187 : plus près des 140 visés.
    expect(echelleGraphique(37.5, 1)).toEqual({ metres: 5, longueur: 187.5 })
    expect(echelleGraphique(0, 1)).toBeNull()
  })

  it('nomment le PDF du bâtiment et du jour', () => {
    expect(nomDuPdf('Immeuble Les Essais', new Date(2026, 9, 18))).toBe('Métrés Immeuble Les Essais 18.10.2026')
    expect(nomDuPdf('Rue A/B : lot 2', new Date(2026, 0, 5))).toBe('Métrés Rue A-B - lot 2 05.01.2026')
    expect(nomDuPdf('  ', new Date(2026, 0, 5))).toBe('Métrés bâtiment 05.01.2026')
  })
})
