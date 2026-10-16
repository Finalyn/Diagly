/**
 * Quantités relevées sur les plans.
 *
 * Une zone tracée sur un plan étalonné connaît sa surface, un trait sa longueur.
 * Tant que ces mesures restaient de simples annotations, elles s'arrêtaient à
 * l'écran : le relevé continuait d'estimer la façade à partir du périmètre et du
 * nombre d'étages, alors que le plan, lui, la donnait exactement.
 *
 * Ce module fait le lien : une annotation porte l'identifiant de l'ouvrage du
 * diagnostic qu'elle mesure, et ce qui est tracé sur l'ensemble des plans
 * s'additionne par ouvrage. Le calcul est pur et séparé de l'éditeur : c'est lui
 * qui décide si une quantité est reportable, et il doit pouvoir être relu sans
 * ouvrir un canvas.
 */
import type { PlanAnnotation, PlanPoint } from './api-types'

/** Ce qu'une mesure produit : une surface, une longueur, ou rien de chiffrable. */
export type NatureQuantite = 'surface' | 'longueur' | 'aucune'

/** Aire d'un polygone fermé, en pixels carrés (formule du lacet). */
export function airePolygone(pts: PlanPoint[]): number {
  if (pts.length < 3) return 0
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    s += pts[i].x * pts[j].y - pts[j].x * pts[i].y
  }
  return Math.abs(s) / 2
}

/** Longueur d'une polyligne ouverte, en pixels. */
export function longueurPolyligne(pts: PlanPoint[]): number {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  return s
}

/**
 * Échelle qui s'applique à une page donnée.
 *
 * Un PDF peut mêler une coupe au 1:50 sur A3 et un détail sur A4 : toutes les
 * pages sont rendues à la même largeur en pixels, donc une page plus grande
 * couvre plus de mètres pour le même nombre de pixels. Mesurer une zone de la
 * page 3 avec l'échelle de la page 1 donnerait un résultat faux sans prévenir.
 */
export function echelleDansTable(
  table: Record<string, number> | undefined,
  echelleDuPlan: number | null,
  page: number | undefined,
): number | null {
  // Une table existe dès qu'on a étalonné page par page : elle fait alors
  // autorité, et une page absente n'a pas d'échelle. Sans cette règle, « appliquer
  // à cette page seule » ne voudrait rien dire, puisque toutes les autres
  // retomberaient sur l'échelle du plan.
  if (table && Object.keys(table).length > 0) return table[String(page ?? 1)] ?? null
  // Pas de table : le plan a été étalonné d'un bloc, avant que les pages ne
  // soient distinguées. Son échelle vaut pour tout le document.
  return echelleDuPlan
}

export function echelleDePage(
  plan: { scalePxPerM: number | null; annotations: PlanAnnotation[] },
  page: number | undefined,
): number | null {
  return echelleDansTable(
    plan.annotations?.find((a) => a.type === 'pages')?.pageScales,
    plan.scalePxPerM,
    page,
  )
}

/**
 * Ce que le tracé mesure, qu'il soit validé ou seulement proposé.
 *
 * Sert à l'éditeur, qui affiche la surface d'une zone proposée par l'IA avant
 * qu'elle soit validée. Pour savoir ce qui compte dans le métré, c'est
 * `natureDe` qu'il faut lire.
 */
export function natureDuTrace(a: Pick<PlanAnnotation, 'type' | 'points'>): NatureQuantite {
  if (a.type === 'hatch') return a.points.length >= 3 ? 'surface' : 'aucune'
  if (a.type === 'measure') return a.points.length >= 2 ? 'longueur' : 'aucune'
  return 'aucune'
}

/**
 * Ce que cette annotation apporte au métré.
 *
 * Une zone proposée par l'analyse du plan n'apporte rien tant qu'elle n'est
 * pas validée : une proposition de l'IA n'a pas à entrer dans un devis sans
 * que personne ne l'ait regardée. Tout ce qui additionne des quantités passe
 * par ici, et l'exclusion vaut donc partout d'un coup.
 */
export function natureDe(a: Pick<PlanAnnotation, 'type' | 'points' | 'proposition'>): NatureQuantite {
  if (a.proposition) return 'aucune'
  return natureDuTrace(a)
}

/**
 * Mesure d'une annotation en unités réelles : m² pour une zone, m pour un trait.
 *
 * `null` quand le plan n'est pas étalonné : des pixels ne sont pas des mètres, et
 * reporter un nombre de pixels dans un devis serait pire que ne rien reporter.
 */
export function mesureDe(a: Pick<PlanAnnotation, 'type' | 'points' | 'proposition'>, scalePxPerM: number | null): number | null {
  const nature = natureDe(a)
  if (nature === 'aucune') return null
  if (!scalePxPerM || scalePxPerM <= 0) return null
  return nature === 'surface'
    ? airePolygone(a.points) / (scalePxPerM * scalePxPerM)
    : longueurPolyligne(a.points) / scalePxPerM
}

/**
 * Nature attendue par l'unité d'un ouvrage du catalogue.
 *
 * Les unités sont écrites à la main dans le catalogue (« CHF/m² », « CHF/m² SP »,
 * « CHF/ml », « Forfait »…) : on reconnaît la grandeur, pas la chaîne exacte.
 */
export function natureDeLUnite(unit: string | null | undefined): NatureQuantite {
  if (!unit) return 'aucune'
  const u = unit.toLowerCase()
  if (/m²|m2/.test(u)) return 'surface'
  if (/\bml\b|mètre linéaire|metre lineaire/.test(u)) return 'longueur'
  return 'aucune'
}

/** Une annotation liée, replacée dans son plan. */
export interface ZoneLiee {
  planId: string
  planName: string
  annotationId: string
  /** Page du PDF où elle est tracée. */
  page: number
  label: string | null
  nature: NatureQuantite
  /** En m² ou en m. null si le plan n'est pas étalonné. */
  valeur: number | null
}

/** Ce que les plans apportent pour un ouvrage donné. */
export interface ApportPlan {
  itemId: string
  nature: NatureQuantite
  /** Somme des mesures exploitables, en m² ou en m. */
  total: number
  zones: ZoneLiee[]
  /** Au moins une zone liée est sur un plan sans échelle : elle ne compte pas dans le total. */
  nonEtalonnees: number
}

export interface PlanMesurable {
  id: string
  name: string
  scalePxPerM: number | null
  annotations: PlanAnnotation[]
}

/**
 * Regroupe par ouvrage tout ce qui est tracé sur l'ensemble des plans.
 *
 * Quatre façades relevées sur quatre plans différents donnent un seul apport :
 * c'est bien la somme qui intéresse le devis, pas chaque plan pris à part.
 *
 * Une zone et un trait liés au même ouvrage ne s'additionnent pas : on ne mélange
 * pas des mètres carrés et des mètres. La première nature rencontrée gagne, et la
 * suivante est ignorée plutôt que de fabriquer un total qui ne veut rien dire.
 */
export function apportsDesPlans(plans: PlanMesurable[]): Map<string, ApportPlan> {
  const parOuvrage = new Map<string, ApportPlan>()

  for (const plan of plans) {
    for (const a of plan.annotations ?? []) {
      const itemId = a.itemId
      if (!itemId) continue
      const nature = natureDe(a)
      if (nature === 'aucune') continue

      let apport = parOuvrage.get(itemId)
      if (!apport) {
        apport = { itemId, nature, total: 0, zones: [], nonEtalonnees: 0 }
        parOuvrage.set(itemId, apport)
      }
      if (apport.nature !== nature) continue

      const valeur = mesureDe(a, echelleDePage(plan, a.page))
      apport.zones.push({
        planId: plan.id,
        planName: plan.name,
        annotationId: a.id,
        page: a.page ?? 1,
        label: a.text?.trim() || null,
        nature,
        valeur,
      })
      if (valeur == null) apport.nonEtalonnees++
      else apport.total += valeur
    }
  }

  return parOuvrage
}

/** Verdict sur le report d'un apport dans le diagnostic. */
export type Reportable =
  | { ok: true; quantite: number }
  | { ok: false; raison: 'non-etalonne' | 'unite-incompatible' | 'rien-a-reporter' | 'deja-a-jour' }

/** Arrondi d'affichage et de report : le centième suffit, et deux calculs identiques doivent donner le même nombre. */
export function arrondiQuantite(v: number): number {
  return Math.round(v * 100) / 100
}

/**
 * Peut-on reporter cet apport sur l'ouvrage ?
 *
 * On refuse plutôt que d'approximer : une surface posée sur un ouvrage facturé à
 * la pièce ou au forfait produirait un montant faux sans que personne ne le voie.
 */
export function reportPossible(
  apport: ApportPlan | undefined,
  ouvrage: { unit: string | null; area: number | null },
): Reportable {
  if (!apport || apport.zones.length === 0) return { ok: false, raison: 'rien-a-reporter' }
  if (apport.total <= 0) return { ok: false, raison: 'non-etalonne' }
  if (natureDeLUnite(ouvrage.unit) !== apport.nature) return { ok: false, raison: 'unite-incompatible' }
  const quantite = arrondiQuantite(apport.total)
  if (ouvrage.area != null && arrondiQuantite(ouvrage.area) === quantite) return { ok: false, raison: 'deja-a-jour' }
  return { ok: true, quantite }
}
