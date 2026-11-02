/**
 * La quantité automatique d'un relevé, comptages compris, et ce qu'il faut
 * réécrire quand un comptage change.
 *
 * Trois règles se superposent, et ce module les applique dans le même ordre
 * partout où une quantité se calcule (éditeur de relevé, ajout depuis le plan,
 * import d'un document, carte des éléments comptés) :
 *  1. une quantité reprise à la main n'est jamais recalculée ;
 *  2. un ouvrage d'une catégorie comptée prend ses unités du comptage ;
 *  3. sinon, la règle de la base, partagée entre les types d'un groupe
 *     d'alternatives selon leur part de surface.
 *
 * Les rapports lisent la quantité et le coût écrits sur le relevé : corriger
 * un comptage ou une dimension de la fiche doit donc réécrire les relevés
 * concernés, ce que font `recalculsDesComptages` et `recalculsDuBatiment`.
 * L'éditeur, lui, recale le relevé qu'on ouvre (DiagnosticDetail,
 * synchronisation de la quantité automatique).
 */
import type { ApiArticle, ApiDiagnosticItem } from '../api-types'
import { computeCost, computeCostFromPrice, getMarketCoeff } from '../diagnostic-auto'
import { groupesDuReleve, partEffective, quantiteDuType } from '../groupes-surface'
import { cleDuReleve } from './etapes'
import { ouvrageDuReleve, resolutionDeQuantite, type OuvrageSaisi } from './pont'
import type { DonneesBatiment } from './quantites'
import {
  categorieDeLArticle, categorieDuReleve, quantiteDuTypeCompte, repartitionsDuDossier, unitesAFixerALAjout, unitesEffectives,
  type CategorieComptee, type EtatRepartition,
} from './comptages'

/** Ce qu'il faut savoir de l'entourage d'un relevé pour en calculer la quantité. */
export interface ContexteDuReleve {
  /** La répartition de sa catégorie comptée, quand le dossier en a un comptage. */
  repartition: EtatRepartition | null
  /** Sa part dans son groupe d'alternatives, quand il en a un et pas de comptage. */
  groupe: { membres: number; sharePct: number | null } | null
}

/**
 * La quantité que le calcul donne à un relevé, sans tenir compte d'une
 * saisie à la main (c'est au relevé de dire qu'il en porte une).
 */
export function quantiteAutomatique(
  releve: { id: string },
  ouvrage: OuvrageSaisi,
  batiment: DonneesBatiment,
  contexte: ContexteDuReleve,
): number | undefined {
  const resolution = resolutionDeQuantite(ouvrage, batiment)
  if (contexte.repartition) {
    const type = contexte.repartition.types.find((t) => t.id === releve.id)
    return quantiteDuTypeCompte(resolution.quantity, type?.effectives ?? null, contexte.repartition.comptage, ouvrage.unit)
  }
  if (contexte.groupe) {
    return quantiteDuType(resolution.quantity, partEffective({ id: releve.id, cfcLabel: '', sharePct: contexte.groupe.sharePct }, contexte.groupe.membres))
  }
  return resolution.quantity
}

/**
 * Ce que reçoit un ouvrage qu'on ajoute au relevé : sa quantité de départ,
 * et les unités à fixer sur le type déjà là quand il rejoint une catégorie
 * comptée (comptages.ts, unitesAFixerALAjout).
 *
 * Seul de sa catégorie, il prend tout le comptage ; deuxième, il arrive sans
 * nombre ni quantité, à préciser par celui qui l'a vu.
 */
export function quantiteALAjout(
  ouvrage: OuvrageSaisi,
  batiment: DonneesBatiment,
  releves: { id: string; articleId?: string | null; cfcLabel: string; unites?: number | null }[],
  articles: { id: string; nom: string; uniteEntretien?: string | null }[],
): { quantity: number | undefined; aFixer: { id: string; unites: number }[] } {
  const resolution = resolutionDeQuantite(ouvrage, batiment)
  const categorie = categorieDeLArticle({ id: ouvrage.articleId, nom: ouvrage.description, uniteEntretien: ouvrage.unit })
  const comptage = categorie ? batiment.comptages?.[categorie] : undefined
  if (!categorie || !comptage) return { quantity: resolution.quantity, aFixer: [] }
  const existants = releves.filter((r) => categorieDuReleve(r, articles) === categorie)
  const effectives = existants.length === 0 ? comptage.nombre : null
  return {
    quantity: quantiteDuTypeCompte(resolution.quantity, effectives, comptage, ouvrage.unit),
    aFixer: unitesAFixerALAjout(existants, comptage),
  }
}

/** Une modification à envoyer par la file d'envoi, comme une saisie. */
export interface Recalcul {
  releveId: string
  patch: Partial<ApiDiagnosticItem>
}

/**
 * La quantité que le calcul donne à chaque relevé du dossier, qu'il porte ou
 * non une quantité reprise à la main.
 *
 * Sert à savoir si une quantité dite « relevée sur place » l'est vraiment :
 * égale au calcul (fenêtres = 30 % de la façade), elle ne l'est pas.
 */
export function calculateurDesQuantites(
  items: ApiDiagnosticItem[],
  articles: ApiArticle[],
  batiment: DonneesBatiment,
): (it: ApiDiagnosticItem) => { ouvrage: OuvrageSaisi; quantite: number | undefined } | null {
  const comptages = batiment.comptages ?? {}
  const repartitions = repartitionsDuDossier(comptages, items, articles)
  const parId = new Map(articles.map((a) => [a.id, a]))

  // Les groupes de surface, sans les types dont la catégorie est comptée : le
  // pourcentage ne s'applique plus à eux, leurs unités le remplacent.
  const groupes = groupesDuReleve(
    items.map((it) => ({
      id: it.id,
      cfcLabel: it.cfcLabel,
      sharePct: it.sharePct,
      etapeNumero: it.etapeNumero ?? null,
      cleArticle: it.articleId && it.etapeNumero != null ? cleDuReleve(it.articleId, it.etapeNumero) : null,
      catalogItemId: it.catalogItemId,
    })),
    items.flatMap((it) => {
      const a = it.articleId ? parId.get(it.articleId) : undefined
      if (!a || it.etapeNumero == null) return []
      const cat = categorieDeLArticle(a)
      const compte = cat ? comptages[cat] : undefined
      return [{ id: cleDuReleve(a.id, it.etapeNumero), surfaceGroup: compte ? null : a.groupeAlternatives }]
    }),
  )

  return (it) => {
    const ouvrage = ouvrageDuReleve(it, articles)
    if (!ouvrage) return null
    const categorie = categorieDuReleve(it, articles)
    const groupe = groupes.find((g) => g.membres.some((m) => m.id === it.id))
    return {
      ouvrage,
      quantite: quantiteAutomatique(it, ouvrage, batiment, {
        repartition: categorie ? repartitions.find((r) => r.categorie === categorie) ?? null : null,
        groupe: groupe ? { membres: groupe.membres.length, sharePct: it.sharePct ?? null } : null,
      }),
    }
  }
}

/** Une quantité reprise à la main qui diffère vraiment du calcul. */
export function vraimentRelevee(it: ApiDiagnosticItem, calcul: ReturnType<typeof calculateurDesQuantites>): boolean {
  if (!it.quantityManual) return false
  const auto = calcul(it)?.quantite
  return auto == null || it.area == null || Math.abs(auto - it.area) > Math.max(0.5, auto * 0.005)
}

/**
 * Les relevés dont la quantité automatique ne correspond plus aux comptages
 * du dossier, avec la quantité et le coût à réécrire.
 *
 * `categories` limite la passe à celles qui viennent de changer : un
 * comptage ajouté, corrigé ou retiré. Retiré, la catégorie retombe sur la
 * règle de la base et sur les parts de surface, exactement comme avant.
 *
 * Une quantité reprise à la main n'est jamais touchée, un coût forcé non
 * plus. Un relevé dont l'article a quitté la base est laissé tel quel.
 */
/** Montant enregistré d'un relevé, 0 quand il n'y en a pas encore. */
const num = (v: string | number | null | undefined) =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v) || 0

export function recalculsDesComptages(
  items: ApiDiagnosticItem[],
  articles: ApiArticle[],
  batiment: DonneesBatiment,
  categories: CategorieComptee[] | 'tous',
): Recalcul[] {
  const calcul = calculateurDesQuantites(items, articles, batiment)

  const recalculs: Recalcul[] = []
  for (const it of items) {
    const categorie = categorieDuReleve(it, articles)
    if (categories !== 'tous' && (!categorie || !categories.includes(categorie))) continue
    const c = calcul(it)
    if (!c) continue
    const { ouvrage, quantite } = c

    // Le verrou de la quantité ne verrouille pas le prix.
    //
    // Une étanchéité de toiture mesurée au mètre sur place gardait bien sa
    // mesure — c'est ce qu'on veut — mais ne recevait jamais son montant : la
    // passe s'arrêtait avant. Le devis l'annonçait alors « aucun prix pour cet
    // état dans la base » alors que la base en a un, et la ligne sortait à
    // chiffrer au lieu de ses 34 835 CHF. Le verrou porte sur la quantité ;
    // c'est `costManual` qui protège un prix repris à la main.
    const figee = Boolean(it.quantityManual)
    if (!figee && quantite == null && categories === 'tous') continue
    // Une dimension manquante ne vide pas une quantité déjà là : la donnée
    // qui manque est une question, pas un zéro.
    const area = figee ? it.area ?? null : quantite ?? null
    const quantiteChange = !figee && area !== it.area
    // Un montant absent se calcule même quand la quantité ne bouge pas : sans
    // cela, un relevé bien mesuré mais jamais chiffré le restait pour toujours.
    const montantManque = !it.costManual && Boolean(it.state) && num(it.estimatedCost) === 0

    // Une amélioration ou une mise aux normes retenue sans montant.
    //
    // Leur coût ne s'écrivait qu'au moment où on les retenait dans l'éditeur,
    // et `suit` ne sait que faire suivre un montant déjà là. Retenue avant que
    // la base ait son prix — ou sur un relevé repris d'une version précédente
    // — l'enveloppe restait « à chiffrer » pour toujours, alors que la base
    // dit son prix : 310.-/m² pour une façade ventilée, par exemple.
    const enveloppeManque = (retenue: string | null, montant: string | null, prix: number | null) =>
      retenue != null && prix != null && num(montant) === 0
    const ameliorationManque = enveloppeManque(it.improvement, it.improvementCost, ouvrage.priceImprovement)
    const normesManquent = enveloppeManque(it.norms, it.normsCost, ouvrage.priceNorms)

    if (!quantiteChange && !montantManque && !ameliorationManque && !normesManquent) continue

    const patch: Partial<ApiDiagnosticItem> = {}
    if (quantiteChange) patch.area = area
    if (!it.costManual && it.state) {
      const cout = computeCost(ouvrage, it.state, area) ?? null
      // On n'écrase un montant existant que si la quantité a bougé.
      if (quantiteChange || cout != null) {
        patch.estimatedCost = cout as unknown as string | null
        patch.costIndex = getMarketCoeff()
      }
    }
    // L'amélioration et la mise aux normes suivent la quantité quand leur
    // montant est celui de la base : un montant repris à la main, non.
    const suit = (montant: string | null, prix: number | null) => {
      if (montant == null || prix == null) return undefined
      const avant = computeCostFromPrice(prix, it.area)
      if (avant == null || Math.abs(Number(montant) - avant) > Math.max(1, avant * 0.01)) return undefined
      return (computeCostFromPrice(prix, quantite) ?? null) as unknown as string | null
    }
    // Un montant absent se calcule ; un montant présent ne bouge que si la
    // quantité a bougé, et seulement s'il venait de la base. Aucune saisie
    // n'est écrasée : l'amélioration et la mise aux normes n'ont pas de verrou
    // « repris à la main », c'est donc l'absence qui sert de garde-fou.
    const combler = (prix: number | null) => (computeCostFromPrice(prix!, area) ?? null) as unknown as string | null
    if (ameliorationManque) patch.improvementCost = combler(ouvrage.priceImprovement)
    else if (quantiteChange && it.improvement != null) {
      const amelioration = suit(it.improvementCost, ouvrage.priceImprovement)
      if (amelioration !== undefined) patch.improvementCost = amelioration
    }
    if (normesManquent) patch.normsCost = combler(ouvrage.priceNorms)
    else if (quantiteChange && it.norms != null) {
      const normes = suit(it.normsCost, ouvrage.priceNorms)
      if (normes !== undefined) patch.normsCost = normes
    }
    recalculs.push({ releveId: it.id, patch })
  }
  return recalculs
}

/**
 * Les relevés dont la quantité ne suit plus la fiche du bâtiment : une
 * dimension corrigée, ou remplacée par les métrés des plans.
 *
 * Tous les relevés passent, comptés ou non. Une quantité reprise à la main
 * n'est jamais touchée, un coût forcé non plus.
 */
export function recalculsDuBatiment(
  items: ApiDiagnosticItem[],
  articles: ApiArticle[],
  batiment: DonneesBatiment,
): Recalcul[] {
  return recalculsDesComptages(items, articles, batiment, 'tous')
}

/** Les relevés, avec leurs recalculs appliqués : ce que le devis doit lire. */
export function appliquerRecalculs(items: ApiDiagnosticItem[], recalculs: Recalcul[]): ApiDiagnosticItem[] {
  if (recalculs.length === 0) return items
  const parId = new Map(recalculs.map((r) => [r.releveId, r.patch]))
  return items.map((it) => (parId.has(it.id) ? { ...it, ...parId.get(it.id)! } : it))
}

/**
 * Ce qu'il faut écrire sur un relevé dont on change le nombre d'unités :
 * le nombre, et la quantité et le coût qui en découlent. Une quantité reprise
 * à la main reste ce qu'elle est, un coût forcé aussi : seul le nombre change.
 */
export function patchDesUnites(
  releve: Pick<ApiDiagnosticItem, 'id' | 'quantityManual' | 'costManual' | 'state'>,
  unites: number | null,
  ouvrage: OuvrageSaisi,
  batiment: DonneesBatiment,
  repartition: EtatRepartition,
): Partial<ApiDiagnosticItem> {
  const patch: Partial<ApiDiagnosticItem> = { unites }
  if (releve.quantityManual) return patch
  const effectives = unitesEffectives(unites, Math.max(1, repartition.types.length), repartition.comptage)
  const quantite = quantiteDuTypeCompte(resolutionDeQuantite(ouvrage, batiment).quantity, effectives, repartition.comptage, ouvrage.unit)
  patch.area = quantite ?? null
  if (!releve.costManual && releve.state) {
    patch.estimatedCost = (computeCost(ouvrage, releve.state, quantite) ?? null) as unknown as string | null
    patch.costIndex = getMarketCoeff()
  }
  return patch
}
