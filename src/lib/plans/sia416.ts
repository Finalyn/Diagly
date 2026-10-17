/**
 * Les surfaces SIA 416 d'un jeu de plans, étage par étage.
 *
 * Les marchés publics romands demandent encore les quantités « sur la base de
 * la norme SIA 416 (édition 2003) », décomposées par étage et présentées de
 * façon à pouvoir être vérifiées. La hiérarchie est stricte :
 *
 *   SP = SN + SC        surface de plancher = nette + construction
 *   SN = SU + SD + SI   nette = utile + dégagement + installations
 *   SU = SUP + SUS      utile = principale + secondaire
 *
 * Ce que les plans donnent : la SP d'un étage par son emprise au nu extérieur
 * (ou, à défaut, par sa dalle), la SN par la somme de ses pièces, la SC par
 * différence. Reste à ranger chaque pièce dans sa catégorie : c'est le nom du
 * local qui le dit, par une table de mots-clés (séjour, chambre → SUP ; cave,
 * buanderie → SUS ; couloir, palier → SD ; chaufferie → SI), que l'on corrige
 * pièce par pièce. Une salle de bains ou un WC de logement sont en SUP, comme
 * le veut la norme ; des sanitaires communs relèveraient de la SUS, et c'est
 * l'utilisateur qui le dit.
 *
 * Tout ici reste une proposition à vérifier : la norme a des cas que des plans
 * ne tranchent pas (gaines accessibles ou non, jours d'escalier, embrasures).
 * L'écran et l'export le disent (MENTION_SIA416).
 *
 * Module pur, sans canevas ni réseau, pour être vérifiable par les tests.
 */

export type CategorieSia416 = 'SUP' | 'SUS' | 'SD' | 'SI'

export const CATEGORIES_SIA416: readonly CategorieSia416[] = ['SUP', 'SUS', 'SD', 'SI']

export const NOMS_SIA416: Record<CategorieSia416, string> = {
  SUP: 'Surface utile principale',
  SUS: 'Surface utile secondaire',
  SD: 'Surface de dégagement',
  SI: 'Surface d’installations',
}

/** Ce que l'écran et l'export disent toujours à côté des chiffres. */
export const MENTION_SIA416 = 'À vérifier, selon SIA 416:2003'

export function estUneCategorieSia416(v: unknown): v is CategorieSia416 {
  return typeof v === 'string' && (CATEGORIES_SIA416 as readonly string[]).includes(v)
}

/** Accents, casse et apostrophes ramenés à une forme comparable. */
function comparable(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`]/g, "'")
}

/**
 * Les mots-clés, dans l'ordre où ils se testent. Les installations et les
 * locaux secondaires d'abord, parce que leur nom commence souvent par
 * « local » (local technique, local à vélos) ; les surfaces principales avant
 * les dégagements, pour qu'un « séjour avec hall » reste un séjour.
 */
const REGLES: readonly { categorie: CategorieSia416; motif: RegExp }[] = [
  { categorie: 'SI', motif: /\b(chaufferie|locaux? techniques?|local (de )?(chauffage|citerne|ventilation|electrique|technique)|gaines?|machinerie|citerne)\b/ },
  { categorie: 'SUS', motif: /\b(caves?|buanderies?|locaux? (a |aux |pour )?(velos?|poubelles|conteneurs)|velos|depots?|galetas|greniers?|abris?( pc| de protection civile)?|sechoir)\b/ },
  { categorie: 'SUP', motif: /\b(sejours?|salons?|salle a manger|coin repas|chambres?|cuisines?|bains?|salle de bains?|salle d'eau|douches?|wc|w\.c|toilettes?|bureaux?|living)\b/ },
  { categorie: 'SD', motif: /\b(halls?|halle|couloirs?|corridors?|degagements?|cage d'escaliers?|escaliers?|paliers?|vestibules?|sas|circulations?|entree|ascenseurs?)\b/ },
]

/** La catégorie que le nom du local suggère, ou null quand rien ne le dit. */
export function affectationParDefaut(nom: string | null | undefined): CategorieSia416 | null {
  if (!nom?.trim()) return null
  const t = comparable(nom)
  for (const r of REGLES) if (r.motif.test(t)) return r.categorie
  return null
}

/** Une pièce validée d'un étage. */
export interface PieceSia416 {
  id: string
  nom: string
  /** En m², pour un seul étage (avant multiplication). */
  surface: number
  /** L'affectation choisie à la main, qui l'emporte sur les mots-clés. */
  affectation?: CategorieSia416 | null
}

/** Ce qu'une feuille d'étage apporte. */
export interface EntreeEtageSia416 {
  cle: string
  nom: string
  /** Étages identiques que la feuille représente. */
  multiplicateur: number
  /** Surfaces d'emprise au nu extérieur, en m². */
  emprises: number[]
  dalles: number[]
  pieces: PieceSia416[]
}

export interface PieceAffectee extends PieceSia416 {
  categorie: CategorieSia416 | null
  /** Vrai quand la catégorie vient des mots-clés et non d'un choix. */
  parDefaut: boolean
}

export type Categories = Record<CategorieSia416, number>

export interface EtageSia416 {
  cle: string
  nom: string
  multiplicateur: number
  /** Valeurs d'un seul étage, avant multiplication. */
  sp: number | null
  sourceSp: 'emprise' | 'dalle' | null
  sn: number
  sc: number | null
  su: number
  categories: Categories
  nonAffectee: number
  pieces: PieceAffectee[]
  alertes: string[]
}

export interface TotalSia416 {
  /** null dès qu'un étage n'a pas de SP : un total partiel se lirait comme le total. */
  sp: number | null
  sn: number
  sc: number | null
  su: number
  categories: Categories
  nonAffectee: number
}

export interface Sia416 {
  etages: EtageSia416[]
  /** Étages identiques multipliés. */
  total: TotalSia416
  alertes: string[]
}

const zero = (): Categories => ({ SUP: 0, SUS: 0, SD: 0, SI: 0 })
const somme = (v: number[]) => v.reduce((s, x) => s + x, 0)
const fr2 = (v: number) => v.toFixed(2).replace('.', ',')

/** Les surfaces SIA 416 d'un étage. */
export function etageSia416(e: EntreeEtageSia416): EtageSia416 {
  const pieces: PieceAffectee[] = e.pieces.map((p) => {
    const choisie = p.affectation ?? null
    const categorie = choisie ?? affectationParDefaut(p.nom)
    return { ...p, categorie, parDefaut: !choisie && categorie != null }
  })
  const categories = zero()
  let nonAffectee = 0
  for (const p of pieces) {
    if (p.categorie) categories[p.categorie] += p.surface
    else nonAffectee += p.surface
  }
  const sn = somme(pieces.map((p) => p.surface))
  const sourceSp = e.emprises.length ? 'emprise' : e.dalles.length ? 'dalle' : null
  const sp = sourceSp === 'emprise' ? somme(e.emprises) : sourceSp === 'dalle' ? somme(e.dalles) : null
  const alertes: string[] = []
  if (sp == null && pieces.length) alertes.push('Pas d’emprise ni de dalle : SP et SC inconnues.')
  if (sourceSp === 'dalle') alertes.push('SP prise sur la dalle : vérifiez qu’elle est mesurée au nu extérieur.')
  if (sp != null && sn > sp + 1e-9) alertes.push(`SN (${fr2(sn)} m²) dépasse SP (${fr2(sp)} m²) : une pièce déborde, ou l’emprise est incomplète.`)
  if (nonAffectee > 0) {
    const n = pieces.filter((p) => !p.categorie).length
    alertes.push(`${n} pièce${n > 1 ? 's' : ''} sans affectation : choisissez sa catégorie.`)
  }
  return {
    cle: e.cle, nom: e.nom, multiplicateur: e.multiplicateur,
    sp, sourceSp, sn, sc: sp == null ? null : sp - sn,
    su: categories.SUP + categories.SUS,
    categories, nonAffectee, pieces, alertes,
  }
}

/**
 * Les surfaces SIA 416 du jeu : chaque étage, puis le total, étages identiques
 * multipliés. Une feuille sans pièce, sans emprise ni dalle (une façade, une
 * coupe) n'est pas un étage et n'y figure pas.
 */
export function surfacesSia416(entrees: EntreeEtageSia416[]): Sia416 {
  const etages = entrees
    .filter((e) => e.pieces.length || e.emprises.length || e.dalles.length)
    .map(etageSia416)
  const total: TotalSia416 = { sp: 0, sn: 0, sc: 0, su: 0, categories: zero(), nonAffectee: 0 }
  for (const e of etages) {
    const k = e.multiplicateur
    total.sp = total.sp == null || e.sp == null ? null : total.sp + e.sp * k
    total.sc = total.sc == null || e.sc == null ? null : total.sc + e.sc * k
    total.sn += e.sn * k
    total.su += e.su * k
    total.nonAffectee += e.nonAffectee * k
    for (const c of CATEGORIES_SIA416) total.categories[c] += e.categories[c] * k
  }
  if (!etages.length) { total.sp = null; total.sc = null }
  const alertes = etages.flatMap((e) => e.alertes.map((a) => `${e.nom} : ${a}`))
  return { etages, total, alertes }
}
