import { describe, it, expect } from 'vitest'
import { entreesSia416, panneauDesQuantites, type PlanPourQuantites } from './quantites'
import { surfacesSia416 } from './sia416'
import {
  SANS_FILTRE, TRI_NATUREL, filtrerLignes, lignesDuTableau, panneauDesLignes, provenanceCourte, trierLignes, vueDuTableau,
  type ContexteTableau, type LigneTableau,
} from './tableau'
import type { PlanAnnotation, PropositionIA, TypeZoneIA } from '../api-types'

/** 10 px par mètre sur toutes les pages : un carré de 100 px de côté mesure 100 m². */
const ECHELLE = { id: 'pages', type: 'pages' as const, points: [], pageScales: { 1: 10, 2: 10, 3: 10 } }

let n = 0
const rect = (page: number, l: number, h: number, typeZone?: TypeZoneIA, extra: Partial<PlanAnnotation> = {}, x = 0, y = 0): PlanAnnotation => ({
  id: `z${n++}`, type: 'hatch', page, typeZone,
  points: [{ x: x * 10, y: y * 10 }, { x: (x + l) * 10, y: y * 10 }, { x: (x + l) * 10, y: (y + h) * 10 }, { x: x * 10, y: (y + h) * 10 }], ...extra,
})
const trait = (page: number, longueur: number, typeZone?: TypeZoneIA): PlanAnnotation => ({
  id: `t${n++}`, type: 'measure', page, typeZone, points: [{ x: 0, y: 0 }, { x: longueur * 10, y: 0 }],
})
const repere = (page: number, categorie: 'porte_paliere' | 'fenetre', extra: Partial<PlanAnnotation> = {}, aValider = false): PlanAnnotation => ({
  id: `r${n++}`, type: 'repere', page, points: [{ x: 1, y: 1 }], repere: { categorie, numero: 1, ...(aValider ? { aValider } : {}) }, ...extra,
})
const proposition = (type: TypeZoneIA, libelle: string, confiance: PropositionIA['confiance'], aimantee: boolean): PropositionIA => ({
  type, libelle, orientation: null, confiance, aimantee, sommetsAimantes: aimantee ? 4 : 0, couverture: aimantee ? 1 : 0, valeurCotee: null, cotes: null, remarque: null,
})

const sejour = rect(1, 4, 5, 'piece', { text: 'Séjour', itemId: 'o281', mesureExacte: true })
const couloir = rect(1, 3, 4, 'piece', { text: 'Couloir', origine: 'main' })
const chambre = rect(2, 4, 5, 'piece', { text: 'Chambre', sia416: 'SUS', itemId: 'o281' })
const bain = rect(2, 2, 2, 'piece', { proposition: proposition('piece', 'Bain', 'basse', true) })
const mur = trait(2, 20, 'mur')
const facade = rect(3, 12, 8, 'facade', { itemId: 'o221' })
const fenetre = rect(3, 1.2, 1.5, 'fenetre', { proposition: proposition('fenetre', 'Fenêtre 1', 'moyenne', false) }, 1, 1)

const jeu: PlanPourQuantites[] = [{
  plan: {
    id: 'p', name: 'Jeu', mimeType: 'application/pdf', scalePxPerM: null,
    annotations: [
      ECHELLE,
      rect(1, 12, 9, 'emprise'), sejour, couloir,
      rect(2, 12, 9, 'emprise'), chambre, mur, bain,
      repere(2, 'porte_paliere'), repere(2, 'porte_paliere', { origine: 'symbole' }), repere(2, 'fenetre', {}, true),
      facade, fenetre,
      { id: 'note', type: 'note', points: [{ x: 0, y: 0 }], page: 1, text: 'à voir' },
    ],
  },
  feuilles: {
    pages: {
      1: { type: 'plan_etage', numero: '101', titre: 'Plan du rez', niveau: 'Rez', etagesIdentiques: 1 },
      2: { type: 'plan_etage', numero: '102', titre: 'Étage type', niveau: '1er au 3e', etagesIdentiques: 3, hauteurEtage: 2.5 },
      3: { type: 'elevation', numero: '201', titre: 'Façade sud' },
    },
  },
}]

const panneau = panneauDesQuantites(jeu)
const sia = surfacesSia416(entreesSia416(panneau))
const parId = new Map(jeu[0].plan.annotations.map((a) => [a.id, a]))
const ctx: ContexteTableau = {
  feuille: (_planId, page) => {
    const f = jeu[0].feuilles.pages[String(page)]
    return { numero: f.numero ?? null, titre: f.titre ?? `Page ${page}` }
  },
  annotation: (_planId, id) => parId.get(id) ?? null,
  ouvrages: [
    { id: 'o281', cfcCode: '281', libelle: 'Revêtements de sol' },
    { id: 'o221', cfcCode: '221', libelle: 'Façades, crépis' },
  ],
}
const lignes = lignesDuTableau(panneau, sia, ctx)
const ligne = (id: string) => lignes.find((l) => l.id === id)!
const vue = (o: Partial<Parameters<typeof vueDuTableau>[2]> = {}) =>
  vueDuTableau(panneau, lignes, { filtres: SANS_FILTRE, regroupement: 'classification', tri: TRI_NATUREL, ...o })

describe('les lignes du tableau', () => {
  it('donne une ligne par forme métrée, dans l’ordre des feuilles, et rien pour une note', () => {
    expect(lignes).toHaveLength(12)
    expect(lignes.some((l) => l.id === 'note')).toBe(false)
    expect(lignes.map((l) => l.page)).toEqual([...lignes.map((l) => l.page)].sort((a, b) => a - b))
    expect(lignes.map((l) => l.ordre)).toEqual(lignes.map((_, i) => i))
  })

  it('reprend la forme telle que le panneau la compte : feuille, étage, quantité, dérivées', () => {
    const l = ligne(chambre.id)
    expect(l).toMatchObject({ feuille: { numero: '102', titre: 'Étage type' }, etage: '1er au 3e', multiplicateur: 3, nom: 'Chambre', classification: 'pieces', unite: 'm²' })
    expect(l.quantite).toBeCloseTo(20, 6)
    expect(l.derivees.find((d) => d.cle === 'plinthes')!.valeur).toBeCloseTo(18, 6)
    expect(ligne(mur.id).derivees.find((d) => d.cle === 'face')!.valeur).toBeCloseTo(50, 6)
    expect(ligne(facade.id).derivees.map((d) => d.cle)).toEqual(['ouvertures', 'nette'])
  })

  it('relie chaque forme à son ouvrage, et dit qu’un repère ne se rattache pas', () => {
    expect(ligne(sejour.id).ouvrage).toEqual({ id: 'o281', cfcCode: '281', libelle: 'Revêtements de sol' })
    expect(ligne(couloir.id).ouvrage).toBeNull()
    expect(ligne(couloir.id).rattachable).toBe(true)
    expect(lignes.find((l) => l.classification === 'elements')!.rattachable).toBe(false)
  })

  it('donne la catégorie SIA 416 des pièces : le choix, sinon le nom du local, à valider compris', () => {
    expect(ligne(chambre.id).sia416).toEqual({ categorie: 'SUS', parDefaut: false })
    expect(ligne(sejour.id).sia416).toEqual({ categorie: 'SUP', parDefaut: true })
    expect(ligne(couloir.id).sia416).toEqual({ categorie: 'SD', parDefaut: true })
    expect(ligne(bain.id).sia416).toEqual({ categorie: 'SUP', parDefaut: true })
    expect(ligne(mur.id).sia416).toBeNull()
  })

  it('dit d’où vient chaque forme, sa confiance et son statut', () => {
    expect(ligne(sejour.id)).toMatchObject({ provenance: 'ia_aimantee', statut: 'valide', compte: true, confiance: null })
    expect(ligne(couloir.id).provenance).toBe('manuel')
    expect(ligne(bain.id)).toMatchObject({ provenance: 'ia_aimantee', statut: 'a_valider', compte: false, confiance: 'basse' })
    expect(ligne(fenetre.id)).toMatchObject({ provenance: 'ia', confiance: 'moyenne' })
    expect(lignes.filter((l) => l.classification === 'elements').map((l) => l.provenance)).toEqual(['ia', 'symbole', 'ia'])
  })
})

describe('la provenance', () => {
  it('range chaque forme dans l’une des quatre familles', () => {
    expect(provenanceCourte(null)).toBe('manuel')
    expect(provenanceCourte({ typeZone: 'piece', origine: 'remplissage' })).toBe('manuel')
    expect(provenanceCourte({ typeZone: 'piece' })).toBe('ia')
    expect(provenanceCourte({ typeZone: 'piece', mesureExacte: true })).toBe('ia_aimantee')
    expect(provenanceCourte({ repere: { categorie: 'fenetre', numero: 1 }, origine: 'main' })).toBe('manuel')
  })
})

describe('les sous-totaux', () => {
  it('regroupés par classification, sans filtre : exactement les totaux du panneau', () => {
    const v = vue()
    expect(v.groupes.map((g) => g.cle)).toEqual(panneau.classifications.map((c) => c.cle))
    for (const g of v.groupes) {
      const c = panneau.classifications.find((x) => x.cle === g.cle)!
      expect(g.totaux).toHaveLength(1)
      expect(g.totaux[0].derivees).toEqual(c.derivees)
    }
    expect(v.totaux.map((t) => t.derivees)).toEqual(panneau.classifications.map((c) => c.derivees))
    expect(v.sia!.total).toEqual(sia.total)
  })

  it('reprend le panneau réduit à toutes ses formes sans rien changer', () => {
    expect(panneauDesLignes(panneau, () => true).classifications.map((c) => c.derivees)).toEqual(panneau.classifications.map((c) => c.derivees))
  })

  it('multiplie les étages types et laisse les propositions hors des totaux', () => {
    const g = vue({ regroupement: 'etage' }).groupes.find((x) => x.titre === '1er au 3e')!
    expect(g.detail).toBe('× 3 étages identiques')
    const pieces = g.totaux.find((t) => t.cle === 'pieces')!
    // Chambre 20 m² × 3 ; le bain proposé est listé, pas compté.
    expect(pieces.derivees[0].valeur).toBeCloseTo(60, 6)
    expect(pieces.aValider).toBe(1)
    expect(g.lignes.some((l) => l.id === bain.id)).toBe(true)
    expect(g.totaux.find((t) => t.cle === 'murs')!.derivees.find((d) => d.cle === 'face')!.valeur).toBeCloseTo(150, 6)
  })

  it('regroupe par ouvrage CFC dans l’ordre des codes, ce qui n’est rattaché à rien à la fin', () => {
    const v = vue({ regroupement: 'ouvrage' })
    expect(v.groupes.map((g) => g.titre)).toEqual(['221 · Façades, crépis', '281 · Revêtements de sol', 'Sans ouvrage rattaché'])
    const sol = v.groupes[1].totaux.find((t) => t.cle === 'pieces')!
    // Séjour 20 m² au rez, chambre 20 m² × 3.
    expect(sol.derivees[0].valeur).toBeCloseTo(20 + 60, 6)
  })

  it('regroupe par feuille, dans l’ordre du jeu', () => {
    expect(vue({ regroupement: 'feuille' }).groupes.map((g) => g.titre)).toEqual(['101 · Plan du rez', '102 · Étage type', '201 · Façade sud'])
    expect(vue({ regroupement: 'aucun' }).groupes).toHaveLength(1)
  })
})

describe('filtrer et trier', () => {
  it('filtre sur le statut et la classification', () => {
    const aValider = filtrerLignes(lignes, { ...SANS_FILTRE, statut: 'a_valider' })
    expect(aValider.map((l) => l.id).sort()).toEqual([bain.id, fenetre.id, lignes.find((l) => l.instance.aValider && l.classification === 'elements')!.id].sort())
    expect(filtrerLignes(lignes, { ...SANS_FILTRE, classification: 'murs' }).map((l) => l.id)).toEqual([mur.id])
    // Les lignes à valider se voient, leurs totaux restent nuls.
    const v = vue({ filtres: { ...SANS_FILTRE, statut: 'a_valider' } })
    expect(v.totaux.find((t) => t.cle === 'pieces')!.derivees[0].valeur).toBe(0)
    expect(v.aValider).toBe(3)
  })

  it('cherche dans le local, la feuille et l’ouvrage, accents ignorés', () => {
    expect(filtrerLignes(lignes, { ...SANS_FILTRE, recherche: 'sejour' }).map((l) => l.id)).toEqual([sejour.id])
    expect(filtrerLignes(lignes, { ...SANS_FILTRE, recherche: 'revetements' }).map((l) => l.id)).toEqual([sejour.id, chambre.id])
    expect(filtrerLignes(lignes, { ...SANS_FILTRE, recherche: '201' }).every((l) => l.page === 3)).toBe(true)
  })

  it('limite le tableau à la feuille choisie, SIA 416 compris', () => {
    const v = vue({ filtres: { ...SANS_FILTRE, feuille: { planId: 'p', page: 1 } } })
    expect(v.groupes.flatMap((g) => g.lignes).every((l) => l.page === 1)).toBe(true)
    expect(v.sia!.total.sn).toBeCloseTo(32, 6)
    expect(v.sia!.total.sp).toBeCloseTo(108, 6)
  })

  it('trie par quantité, ce qui n’a pas de mesure toujours en dernier', () => {
    const sans: LigneTableau = { ...ligne(couloir.id), cle: 'p#x', id: 'x', quantite: null }
    const avec = [...lignes.filter((l) => l.classification === 'pieces'), sans]
    const desc = trierLignes(avec, { colonne: 'quantite', sens: 'desc' })
    expect(desc.map((l) => l.quantite)).toEqual([20, 20, 12, 4, null].map((x) => (x == null ? null : expect.closeTo(x, 6))))
    expect(trierLignes(avec, { colonne: 'quantite', sens: 'asc' }).at(-1)!.id).toBe('x')
  })

  it('trie par confiance et par statut, l’ordre naturel départageant', () => {
    const r = trierLignes(lignes, { colonne: 'confiance', sens: 'asc' })
    expect(r.slice(0, 2).map((l) => l.confiance)).toEqual(['moyenne', 'basse'])
    expect(trierLignes(lignes, { colonne: 'statut', sens: 'asc' }).slice(0, 3).every((l) => l.statut === 'a_valider')).toBe(true)
  })
})
