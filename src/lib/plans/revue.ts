/**
 * La file de revue de l'outil Métrés : tout ce qui attend d'être validé, sur
 * toutes les feuilles du jeu, du moins sûr au plus sûr.
 *
 * Corriger coûte bien plus que détecter : c'est la revue qu'il faut rendre
 * rapide. Plutôt que de passer feuille par feuille, la file parcourt d'un
 * trait les propositions de l'IA (zones et repères), en commençant par celles
 * qu'il faut vraiment regarder : confiance basse d'abord, puis, à confiance
 * égale, les zones que l'aimantation n'a pas pu accrocher au dessin, et enfin
 * celles dont les cotes lues contredisent la mesure. Chaque élément dit d'où
 * il vient : de quoi décider sans ouvrir de fenêtre.
 *
 * Module pur, sans canevas ni réseau, pour être vérifiable par les tests.
 */
import type { ConfianceZone, FeuillesPlan, PlanAnnotation } from '../api-types'
import { CATEGORIE } from '../base-cfc/comptages'
import { echelleDePage } from '../plan-quantites'
import { NOMS_TYPES_ZONE, ecartAuxCotes, mesureDeLaZone, nomDuRepere } from './analyse-ia'
import { enAttente, estPdf, feuilleDe, libelleFeuille } from './feuilles'
import type { PlanPourQuantites } from './quantites'

export interface ElementRevue {
  id: string
  planId: string
  page: number
  /** « Pièce », « Fenêtre », « Repère · Porte palière ». */
  type: string
  libelle: string
  /** null pour un repère : l'IA donne sa confiance par catégorie, pas par repère. */
  confiance: ConfianceZone | null
  /** La provenance, en clair : « IA, aimantée sur le dessin (4/4 sommets) ». */
  provenance: string
  /** « Cotes lues : 1.20 × 1.40 = 1,68 m², concordent » ; null sans cotes. */
  cotes: string | null
  /** La mesure de la forme ; null sans échelle, ou pour un repère. */
  mesure: { valeur: number; unite: 'm²' | 'ml'; exacte: boolean } | null
  remarque: string | null
  /** La feuille, telle que le navigateur la nomme. */
  feuille: string
}

/** Le rang d'un élément dans la file : plus il est petit, plus il faut le regarder. */
function rang(a: PlanAnnotation, ecart: number | null): number {
  const p = a.proposition
  const base = p ? { basse: 0, moyenne: 3, haute: 6 }[p.confiance] : 3
  // Un repère n'a pas de confiance propre : il passe après les zones moyennes, avant les sûres.
  if (!p) return base + 1.5
  // À confiance égale : non aimantée avant aimantée, cotes contredites avant cotes concordantes.
  return base + (p.aimantee ? 1 : 0) + (ecart != null && ecart > 0.03 ? -0.5 : 0) + (ecart != null && ecart <= 0.03 ? 1 : 0)
}

const fr = (v: number, d = 2) => v.toFixed(d).replace('.', ',')

export function fileDeRevue(jeu: PlanPourQuantites[]): ElementRevue[] {
  const elements: { e: ElementRevue; r: number; ordre: number }[] = []
  let ordre = 0
  for (const [rangPlan, { plan, feuilles }] of jeu.entries()) {
    const pdf = estPdf(plan)
    for (const a of plan.annotations ?? []) {
      if (!enAttente(a)) continue
      const page = pdf ? a.page ?? 1 : 1
      const echelle = echelleDePage(plan, page)
      const feuille = libelleFeuille(feuilleDe(feuilles as FeuillesPlan, page), page, plan.name)
      const p = a.proposition
      const ecart = p ? ecartAuxCotes(a, echelle) : null
      const m = p ? mesureDeLaZone(a, echelle) : null
      elements.push({ r: rang(a, ecart), ordre: rangPlan * 1_000_000 + page * 1000 + ordre++, e: {
        id: a.id,
        planId: plan.id,
        page,
        type: p ? NOMS_TYPES_ZONE[p.type] : a.repere ? `Repère · ${CATEGORIE[a.repere.categorie].singulier}` : 'Élément',
        libelle: p ? p.libelle : nomDuRepere(a),
        confiance: p?.confiance ?? null,
        provenance: p
          ? (p.aimantee
            ? `IA, aimantée sur le dessin (${p.sommetsAimantes}/${a.points.length} sommets)`
            : `IA, placée à l’œil (${p.sommetsAimantes}/${a.points.length} sommets aimantés)`)
          : 'IA, repère posé là où l’élément a été vu',
        cotes: p && p.valeurCotee != null
          ? `Cotes lues : ${p.cotes ? `${p.cotes} = ` : ''}${fr(p.valeurCotee)} ${a.type === 'hatch' ? 'm²' : 'm'}${ecart == null ? '' : ecart > 0.03 ? `, écart ${fr(ecart * 100, 1)} %` : ', concordent'}`
          : null,
        mesure: m == null ? null : { valeur: m, unite: a.type === 'hatch' ? 'm²' : 'ml', exacte: !!p?.aimantee },
        remarque: p?.remarque ?? a.text ?? null,
        feuille,
      } })
    }
  }
  return elements.sort((x, y) => x.r - y.r || x.ordre - y.ordre).map((x) => x.e)
}
