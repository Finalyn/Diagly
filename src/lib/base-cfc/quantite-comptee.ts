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
 * Les rapports lisent la quantité et le coût écrits sur le relevé, pas ce
 * calcul : corriger un comptage doit donc réécrire les relevés concernés, ce
 * que fait `recalculsDesComptages`. L'éditeur, lui, recale le relevé qu'on
 * ouvre (DiagnosticDetail, synchronisation de la quantité automatique).
 */
import type { ApiArticle, ApiDiagnosticItem } from '../api-types'
import { computeCost, getMarketCoeff } from '../diagnostic-auto'
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
export function recalculsDesComptages(
  items: ApiDiagnosticItem[],
  articles: ApiArticle[],
  batiment: DonneesBatiment,
  categories: CategorieComptee[],
): Recalcul[] {
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

  const recalculs: Recalcul[] = []
  for (const it of items) {
    if (it.quantityManual) continue
    const categorie = categorieDuReleve(it, articles)
    if (!categorie || !categories.includes(categorie)) continue
    const ouvrage = ouvrageDuReleve(it, articles)
    if (!ouvrage) continue
    const groupe = groupes.find((g) => g.membres.some((m) => m.id === it.id))
    const quantite = quantiteAutomatique(it, ouvrage, batiment, {
      repartition: repartitions.find((r) => r.categorie === categorie) ?? null,
      groupe: groupe ? { membres: groupe.membres.length, sharePct: it.sharePct ?? null } : null,
    })
    const area = quantite ?? null
    if (area === it.area) continue
    const patch: Partial<ApiDiagnosticItem> = { area }
    if (!it.costManual && it.state) {
      patch.estimatedCost = (computeCost(ouvrage, it.state, quantite) ?? null) as unknown as string | null
      patch.costIndex = getMarketCoeff()
    }
    recalculs.push({ releveId: it.id, patch })
  }
  return recalculs
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
