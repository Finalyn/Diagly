/**
 * Coût d'une variante de projet.
 *
 * Une variante ne rejoue pas le diagnostic : elle porte seulement les arbitrages
 * qui changent. « Isolation par l'intérieur » remplace l'ouvrage d'isolation
 * périphérique et laisse le reste intact ; « chauffage à pellets » remplace la
 * production de chaleur. Le total se lit donc :
 *
 *     variante = diagnostic de base
 *              − les ouvrages que la variante remplace
 *              + les lignes de la variante
 *
 * C'est ce qui permet de corriger un ouvrage une seule fois, dans le diagnostic,
 * et de voir les trois variantes bouger ensemble — au lieu de trois copies qui
 * divergent dès la première correction.
 */
import { cascadeDe, type Cascade } from './devis'
import { computeCost, resolveQuantity, type QuantityContext } from './diagnostic-auto'
import type { ApiCatalogItem, ApiDiagnosticItem, ApiVariant, ApiVariantLine, ElementState } from './api-types'

const num = (v: string | number | null | undefined) =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v)

/** Montant total des travaux d'un ouvrage : réparation + amélioration + normes. */
export function montantOuvrage(it: ApiDiagnosticItem): number {
  return num(it.estimatedCost) + num(it.improvementCost) + num(it.normsCost)
}

/**
 * Montant d'une ligne de variante, calculé depuis le catalogue.
 *
 * C'est ce qui rend la plus-value automatique : on choisit l'article retenu
 * (fenêtres bois-métal au lieu de PVC) et l'état visé (moyen, ou mauvais si on
 * veut chiffrer un remplacement complet), et le prix sort du catalogue comme pour
 * un ouvrage du diagnostic — même table de prix, même indexation.
 *
 * undefined quand le calcul n'est pas possible : article inconnu, état non choisi,
 * quantité absente, ou prix non renseigné pour cet état. Le montant saisi à la
 * main prend alors le relais, et c'est aussi ce qui se passe si l'utilisateur a
 * explicitement forcé la valeur.
 */
export function montantDepuisCatalogue(
  article: ApiCatalogItem | null | undefined,
  state: ElementState | null | undefined,
  quantite: number | null | undefined,
): number | undefined {
  if (!article || !state) return undefined
  return computeCost(article, state, quantite)
}

/**
 * De quoi rechiffrer une ligne depuis la base : le catalogue et les dimensions du
 * bâtiment. Facultatif — sans lui, la ligne garde la quantité et le montant figés
 * au moment où elle a été créée.
 */
export interface ContexteChiffrage {
  catalogue: Map<number, ApiCatalogItem>
  qtyCtx: QuantityContext
}

/**
 * Quantité et montant d'une ligne, rechiffrés depuis la base.
 *
 * Une variante promet de suivre le dossier : corriger le périmètre du bâtiment doit
 * déplacer les mètres carrés de fenêtres de la variante comme ceux du diagnostic.
 * Les valeurs enregistrées ne servent donc que de repli — quand le montant a été
 * repris à la main, quand l'article n'est plus au catalogue, ou quand la quantité
 * ne se déduit d'aucune dimension.
 */
function chiffrerLigne(
  ligne: ApiVariantLine,
  remplace: ApiDiagnosticItem | null,
  contexte?: ContexteChiffrage,
): { quantite: number | null; montant: number; baseMetre: string | null } {
  const fige = { quantite: ligne.area, montant: num(ligne.amount), baseMetre: null }
  if (ligne.costManual || !contexte || ligne.catalogItemId == null || !ligne.state) return fige

  const article = contexte.catalogue.get(ligne.catalogItemId)
  if (!article) return fige

  // Une mesure prise sur place l'emporte sur une formule, ici comme au diagnostic.
  const mesure = remplace?.quantityManual && remplace.area != null ? remplace.area : undefined
  const resolution = resolveQuantity(article, contexte.qtyCtx)
  const quantite = mesure ?? resolution.quantity ?? ligne.area
  const montant = computeCost(article, ligne.state, quantite)
  if (montant == null) return fige
  return {
    quantite: quantite ?? null,
    montant,
    // Sur quoi la quantité est prise. Une base aberrante — doubler des parois sur
    // l'emprise au sol, par exemple — ne se voit pas dans le montant seul : elle se
    // voit dans sa base. C'est ce qui a permis de trouver l'erreur de catalogue sur
    // l'isolation par l'intérieur.
    baseMetre: mesure != null ? 'relevé sur place' : (resolution.basis ?? null),
  }
}

export interface LigneArbitrage {
  ligne: ApiVariantLine
  /** L'ouvrage remplacé, s'il existe encore dans le diagnostic. */
  remplace: ApiDiagnosticItem | null
  /** Montant de l'ouvrage remplacé, 0 pour un ajout. */
  montantRemplace: number
  /** Quantité retenue, rechiffrée depuis le bâtiment quand c'est possible. */
  quantite: number | null
  /** Grandeur du dossier sur laquelle la quantité est prise ; null si figée. */
  baseMetre: string | null
  /** Montant retenu pour cette ligne, rechiffré depuis le catalogue si possible. */
  montant: number
  /** Différence apportée par cet arbitrage : positive = plus cher. */
  ecart: number
}

export interface Variante {
  variant: ApiVariant
  arbitrages: LigneArbitrage[]
  /** Travaux conservés du diagnostic de base (hors ouvrages remplacés). */
  htConserve: number
  /** Travaux propres à la variante. */
  htArbitrages: number
  /** Total des travaux de la variante. */
  ht: number
  cascade: Cascade
  /** Écart de travaux par rapport au diagnostic de base. */
  ecartHt: number
}

export interface BaseProjet {
  ht: number
  cascade: Cascade
}

export interface OptionsVariante {
  honoraryPct: number | null
  reservePct: number | null
}

/**
 * Base de comparaison : le devis complet du chapitre 4, postes de chantier compris.
 *
 * On part du total du devis et non de la seule somme des ouvrages : le nettoyage,
 * la protection et l'échafaudage s'appliquent à la variante comme au diagnostic.
 * Les retrancher d'un côté et pas de l'autre donnerait un écart qui ne se recoupe
 * pas — c'est exactement ce qui arrivait quand l'écran et le rapport ne partaient
 * pas du même total.
 */
export function baseDuProjet(htDevis: number, options: OptionsVariante): BaseProjet {
  return { ht: htDevis, cascade: cascadeDe(htDevis, options.honoraryPct ?? 0, options.reservePct ?? 0) }
}

/**
 * Chiffre une variante contre le diagnostic de base.
 *
 * Une ligne dont l'ouvrage remplacé a disparu du diagnostic redevient un simple
 * ajout : la variante reste lisible plutôt que de compter en moins un montant
 * qui n'existe plus.
 */
export function calculerVariante(
  variant: ApiVariant,
  items: ApiDiagnosticItem[],
  options: OptionsVariante,
  /** Total HT du devis de base (chapitre 4), postes de chantier compris. */
  htDevis: number,
  contexte?: ContexteChiffrage,
): Variante {
  const parId = new Map(items.map((it) => [it.id, it]))

  const arbitrages: LigneArbitrage[] = variant.lines.map((ligne) => {
    const remplace = ligne.replacesItemId ? parId.get(ligne.replacesItemId) ?? null : null
    const montantRemplace = remplace ? montantOuvrage(remplace) : 0
    const { quantite, montant, baseMetre } = chiffrerLigne(ligne, remplace, contexte)
    return { ligne, remplace, montantRemplace, quantite, montant, baseMetre, ecart: montant - montantRemplace }
  })

  // Ce qui reste du devis de base une fois les ouvrages arbitrés retirés : les
  // postes de chantier y sont donc conservés, comme tous les ouvrages non cités.
  const htRemplace = arbitrages.reduce((s, a) => s + a.montantRemplace, 0)
  const htConserve = htDevis - htRemplace
  const htArbitrages = arbitrages.reduce((s, a) => s + a.montant, 0)
  const ht = htConserve + htArbitrages

  return {
    variant,
    arbitrages,
    htConserve,
    htArbitrages,
    ht,
    cascade: cascadeDe(ht, options.honoraryPct ?? 0, options.reservePct ?? 0),
    ecartHt: ht - htDevis,
  }
}

/** Chiffre toutes les variantes d'un projet, dans leur ordre d'affichage. */
export function calculerVariantes(
  variants: ApiVariant[],
  items: ApiDiagnosticItem[],
  options: OptionsVariante,
  htDevis: number,
  contexte?: ContexteChiffrage,
): Variante[] {
  return variants.map((v) => calculerVariante(v, items, options, htDevis, contexte))
}
