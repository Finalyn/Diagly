/**
 * Le devis du dossier : un seul calcul, pour tous les documents.
 *
 * La synthèse, le rapport complet, le devis original, l'onglet Coûts et le
 * lien de partage comptaient chacun leurs lignes, et pas les mêmes : la
 * synthèse additionnait les améliorations sans les postes de chantier, le
 * rapport les postes sans les améliorations. Deux exports du même dossier
 * donnaient deux totaux. Il n'y a plus qu'un calcul, ici, et la règle est :
 *
 *     total général = postes de chantier + toutes les lignes du devis
 *
 * Les totaux par enveloppe (réparation, mise aux normes, amélioration) et par
 * priorité sont des sous-ensembles de ce même calcul : leur somme retombe
 * toujours sur le total général.
 *
 * Ce module tient aussi les règles qui viennent de la base du bureau et non de
 * la saisie du diagnostiqueur :
 *
 *  - un ouvrage relevé dans deux étapes donne deux lignes, distinguées par le
 *    nom de leur étape : « Peinture intérieure, murs · Cage d'escalier » et
 *    « ... · Appartements ». Sans ce sous-titre, deux lignes identiques à des
 *    montants différents se lisent comme un doublon ;
 *  - des postes s'ajoutent d'office, dont les prix sont lus dans la table des
 *    postes automatiques et jamais écrits ici ;
 *  - un travail prescrit sans prix ne disparaît pas : il reste au devis,
 *    marqué « à chiffrer », et le total le dit. Un état Mauvais à 0 CHF faisait
 *    sortir une étanchéité de toiture du total sans que personne ne le voie ;
 *  - une amélioration qui demande un échafaudage que les autres travaux ne
 *    montent pas porte ce complément dans sa propre enveloppe, pour que
 *    renoncer à l'amélioration retire aussi son échafaudage.
 *
 * Le calcul est ici, hors des composants, pour être vérifiable par des tests :
 * un devis faux ne se voit pas à l'écran, il se voit chez le client.
 */
import { getMarketCoeff, priceForState } from './diagnostic-auto'
import { cfcPositionCode } from './cfc'
import { comparerCodesCfc } from './base-cfc/devis-cfc'
import { aucunTravail } from './base-cfc/normaliser'
import { ouvrageDeLArticle } from './base-cfc/pont'
import {
  plusUrgente, postesAutomatiques, surfaceEchafaudee,
  type Priorite, type ReleveDuDevis,
} from './base-cfc/postes'
import type { DonneesBatiment } from './base-cfc/quantites'
import { corrigerTexte, nomDuReleve } from './textes'
import type {
  ApiArticle, ApiDiagnosticItem, ApiEtapeVisite, ApiPosteAutomatique, Priority,
} from './api-types'

/** TVA suisse appliquée au sous-total travaux + honoraires + réserve + frais. */
export const TVA = 0.081

/** Ordre de lecture : le plus urgent d'abord. */
export const PRIORITES: Priority[] = ['I', 'II', 'III']

/**
 * Horizon d'intervention associé à chaque priorité, dit en clair dans le devis.
 * Barème du bureau : 0-5 ans, 5-10 ans, au-delà de 10 ans.
 */
export const HORIZON: Record<Priority, string> = {
  I: '0 à 5 ans',
  II: '5 à 10 ans',
  III: 'au-delà de 10 ans',
}

export type Enveloppe = 'Poste de chantier' | 'Réparation' | 'Mise aux normes' | 'Amélioration'

/** Les enveloppes, dans l'ordre du devis et du récapitulatif. */
export const ENVELOPPES: Enveloppe[] = ['Poste de chantier', 'Réparation', 'Mise aux normes', 'Amélioration']

/** Ce qu'on dit d'une enveloppe au client, une phrase chacune. */
export const SENS_DES_ENVELOPPES: Record<Enveloppe, string> = {
  'Poste de chantier': 'Ce qui accompagne tout chantier : protection, échafaudages, nettoyage.',
  'Réparation': "Remettre les ouvrages en état. C'est ce que la dégradation constatée impose.",
  'Mise aux normes': "Corriger un écart avec une norme actuelle, même sur un ouvrage en bon état.",
  'Amélioration': "Faire mieux qu'à l'origine : énergie, confort, valeur. C'est un choix du propriétaire.",
}

export interface DevisLigne {
  /** Unique dans le devis : un ouvrage peut produire plusieurs lignes. */
  cle: string
  /** Le relevé d'où vient la ligne ; null pour un poste de chantier. */
  releveId: string | null
  cfcCode: string
  libelle: string
  enveloppe: Enveloppe
  /** Priorité du relevé, ou du plus urgent des ouvrages qui déclenchent le poste. */
  priorite: Priority | null
  quantite: number | null
  unite: string | null
  /** Prix unitaire réellement appliqué = montant ÷ quantité. null sans quantité. */
  prixUnitaire: number | null
  /** 0 quand la ligne est à chiffrer : elle n'entre pas au total, et le total le dit. */
  montant: number
  /** Un travail prescrit sans prix, ou un poste sans quantité. */
  aChiffrer: boolean
  /** Pourquoi la ligne est à chiffrer, dit à celui qui doit la compléter. */
  raisonAChiffrer: string | null
  /** Travaux décrits pour cette enveloppe, ou la règle pour un poste de chantier. */
  remarque: string
  /** true pour les postes imposés par la base, absents du diagnostic. */
  automatique: boolean
  /**
   * Prix unitaire de la base, indexé, pour cette enveloppe et cet état. Sert à
   * signaler un prix modifié et à y revenir. null quand la base n'en a pas.
   */
  prixBase: number | null
  /** Le prix a été repris à la main, ou s'écarte de la base. */
  prixModifie: boolean
  /**
   * Le prix du catalogue avant indexation, quand l'indice le change : un texte
   * qui annonce 260 CHF/m² à côté d'un calcul à 383,75 doit dire pourquoi.
   */
  indexation: { prixCatalogue: number; coeff: number } | null
  /**
   * Le texte annonce plusieurs variantes (« A OU / ET B ») pour un seul
   * montant : il faut une ligne par variante, avec leur lien.
   */
  variantesADetailler: boolean
  /**
   * Pour une réparation rendue inutile par une amélioration : la clé de la
   * ligne d'amélioration, sous laquelle la déduction se range.
   */
  rattacheA: string | null
}

/** Ce que le devis a besoin de connaître de la base. */
export interface BaseDuDevis {
  articles: ApiArticle[]
  postes: ApiPosteAutomatique[]
  etapes: ApiEtapeVisite[]
}

export interface DevisPosition {
  /** Code CFC à 3 chiffres ("226"), "" si le code de l'ouvrage n'en porte pas. */
  code: string
  label: string
  lignes: DevisLigne[]
  montant: number
}

export interface Cascade {
  ht: number
  honoraires: number
  reserve: number
  /** Frais secondaires du dossier (autorisations, taxes, assurances, prorata). */
  frais: number
  detailFrais: { libelle: string; montant: number }[]
  sousTotal: number
  tva: number
  total: number
}

export interface DevisEnveloppe {
  cle: Enveloppe
  lignes: DevisLigne[]
  positions: DevisPosition[]
  ht: number
  cascade: Cascade
  /** Lignes de l'enveloppe encore sans prix. */
  aChiffrer: number
}

export interface DevisPriorite {
  /** Priorité, ou 'NC' pour les lignes sans priorité arbitrée. */
  cle: Priority | 'NC'
  titre: string
  horizon: string
  /** Nombre de lignes de travaux : le seul compteur, repris partout. */
  lignes: number
  ht: number
}

export interface Devis {
  /** Toutes les lignes, triées par code CFC : le devis unique. */
  lignes: DevisLigne[]
  /** Les mêmes lignes, groupées par position CFC à 3 chiffres. */
  positions: DevisPosition[]
  /** Les sous-ensembles par enveloppe, dans l'ordre de ENVELOPPES, vides compris. */
  enveloppes: DevisEnveloppe[]
  /** Les lignes de travaux (hors postes de chantier) par priorité. */
  priorites: DevisPriorite[]
  ht: number
  cascade: Cascade
  /** Les lignes qui attendent un prix : tant qu'il y en a, le devis est incomplet. */
  aChiffrer: DevisLigne[]
  /** Règles appliquées d'office, à énoncer sous le devis. */
  reglesAppliquees: string[]
  /**
   * La surface d'échafaudage de façade chiffrée, pour qu'elle soit la même
   * partout où elle est citée. null quand le devis n'en compte pas.
   */
  surfaceEchafaudee: number | null
}

/** Un frais secondaire du dossier : un pourcentage des travaux, ou un montant. */
export interface FraisSecondaire {
  libelle: string
  pct: number | null
  montant: number | null
}

/** L'installation de chantier : un pourcentage des travaux, avec un minimum. */
export interface ReglageInstallation {
  pct: number | null
  minimum: number | null
}

export interface DevisOptions {
  honoraryPct: number | null
  reservePct: number | null
  /** Données du bâtiment, dont les postes automatiques tirent leurs quantités. */
  batiment: DonneesBatiment
  frais?: FraisSecondaire[] | null
  /**
   * undefined = pas encore réglée : la ligne paraît « à chiffrer ». Un
   * pourcentage et un minimum à zéro disent qu'il n'y en a pas.
   */
  installation?: ReglageInstallation | null
  /** Prix d'un poste de chantier propre au dossier, déjà indexé : il remplace celui de la base. */
  prixPostes?: Record<string, number> | null
}

const num = (v: string | null | undefined) => (v ? Number(v) : 0)
const arrondi2 = (v: number) => Math.round(v * 100) / 100

/**
 * Honoraires, puis réserve, puis frais secondaires, puis TVA.
 *
 * La réserve porte sur le montant déjà majoré des honoraires. Les frais
 * secondaires s'ajoutent ensuite : un pourcentage des travaux, ou un montant
 * fixe. `part` est la fraction du dossier que représente `ht` : un total
 * d'enveloppe ne porte que sa part des frais fixes, pour que la somme des
 * enveloppes retombe sur le total.
 */
export function cascadeDe(
  ht: number,
  honoraryPct: number,
  reservePct: number,
  frais: FraisSecondaire[] = [],
  part = 1,
): Cascade {
  const honoraires = ht * honoraryPct / 100
  const apresHonoraires = ht + honoraires
  const reserve = apresHonoraires * reservePct / 100
  const detailFrais = frais
    .map((f) => ({
      libelle: f.libelle,
      montant: f.pct != null ? ht * f.pct / 100 : (f.montant ?? 0) * part,
    }))
    .filter((f) => f.montant !== 0)
  const montantFrais = detailFrais.reduce((s, f) => s + f.montant, 0)
  const sousTotal = apresHonoraires + reserve + montantFrais
  const tva = sousTotal * TVA
  return { ht, honoraires, reserve, frais: montantFrais, detailFrais, sousTotal, tva, total: sousTotal + tva }
}

/** Prix unitaire appliqué : ce que le client peut recalculer depuis la ligne. */
function prixUnitaire(montant: number, quantite: number | null): number | null {
  if (quantite == null || quantite <= 0 || montant <= 0) return null
  return arrondi2(montant / quantite)
}

/** Unité du catalogue débarrassée de son préfixe monétaire ("CHF/m²" -> "m²"). */
export function uniteCourte(unit: string | null | undefined): string | null {
  if (!unit) return null
  const u = unit.replace(/^CHF\s*\/?\s*/i, '').trim()
  // L'ancienne unité « U » se lisait collée au nombre : « 7U ».
  if (/^u$/i.test(u)) return 'pce'
  return u || null
}

/**
 * Le texte d'un travail, sans le prix qu'il annonce.
 *
 * « Isolation périphérique, à 260 CHF/m² » à côté d'une colonne qui applique
 * 383,75 : le texte et le calcul se contredisent, et c'est le texte qu'on
 * croit. Le prix appliqué est dans sa colonne ; le texte dit le travail.
 */
export function sansPrixAnnonce(texte: string): string {
  return texte
    .replace(/,?\s*(?:à|a|au prix de|pour)?\s*\d[\d'’\s]*(?:[.,]\d+)?\s*CHF\s*(?:\/\s*[\wµ²³.]+)?/gi, '')
    .replace(/\s+([,.;·])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** « Réhaussement OU / ET remplissage » : plusieurs variantes pour un seul montant. */
export function annonceDesVariantes(texte: string): boolean {
  return /\bOU\s*\/\s*ET\b|\bET\s*\/\s*OU\b|\bOU\b/.test(texte)
}

const ETATS_BASE: Record<string, 'tres_bon' | 'bon' | 'moyen' | 'mauvais'> = {
  TRES_BON: 'tres_bon', BON: 'bon', MOYEN: 'moyen', MAUVAIS: 'mauvais',
}

/** Le prix de la base pour une enveloppe d'un relevé, avant indexation. */
function prixCatalogueDe(it: ApiDiagnosticItem, article: ApiArticle | undefined, enveloppe: Enveloppe): number | null {
  if (!article) return null
  const ouvrage = ouvrageDeLArticle(article, it.etapeNumero ?? null)
  if (enveloppe === 'Amélioration') return ouvrage.priceImprovement
  if (enveloppe === 'Mise aux normes') return ouvrage.priceNorms
  if (!it.state) return null
  const p = priceForState(ouvrage, it.state)
  return typeof p === 'number' ? p : p == null || p === '' ? null : Number(p)
}

/**
 * Un état qui appelle des travaux selon la base.
 *
 * Moyen et Mauvais prescrivent un travail, sauf quand la base dit « Néant »
 * pour cet état. Sans article (relevé d'avant la bascule), on s'en tient aux
 * travaux retenus sur le relevé : rien de retenu, rien de prescrit.
 */
function travailPrescrit(it: ApiDiagnosticItem, article: ApiArticle | undefined): boolean {
  if (it.state !== 'MOYEN' && it.state !== 'MAUVAIS') return false
  if (!article) return it.works.some((w) => w && w !== 'Néant')
  const ligne = article.etats.find((e) => e.etat === ETATS_BASE[it.state!])
  return !(ligne && aucunTravail(ligne.travaux))
}

/** Ce qui fait d'une ligne de relevé une ligne de devis. */
function ligneDuReleve(
  it: ApiDiagnosticItem,
  article: ApiArticle | undefined,
  sousTitre: string | null,
  enveloppe: Exclude<Enveloppe, 'Poste de chantier'>,
  montant: number,
  texte: string,
  aChiffrer: string | null,
): DevisLigne {
  const quantite = it.area ?? null
  const pu = prixUnitaire(montant, quantite)
  const catalogue = prixCatalogueDe(it, article, enveloppe)
  const coeff = getMarketCoeff()
  const prixBase = catalogue != null ? arrondi2(catalogue * coeff) : null
  // Un prix repris à la main, ou qui s'écarte de plus d'un pour cent de la
  // base : il faut le voir, et pouvoir y revenir.
  const ecart = pu != null && prixBase != null && prixBase > 0 && Math.abs(pu - prixBase) / prixBase > 0.01
  const prixModifie = !aChiffrer && ((enveloppe === 'Réparation' && Boolean(it.costManual)) || ecart)
  const indexation = !prixModifie && pu != null && catalogue != null && coeff !== 1 && Math.abs(pu - prixBase!) <= 0.01 * prixBase!
    ? { prixCatalogue: catalogue, coeff }
    : null

  return {
    cle: `${it.id}:${enveloppe}`,
    releveId: it.id,
    cfcCode: it.cfcCode,
    // Deux relevés du même article se suivent au devis, la peinture de la cage
    // d'escalier et celle des appartements. Sans le nom de leur étape, le
    // lecteur voit deux lignes identiques à des montants différents et croit
    // à un doublon.
    libelle: sousTitre ? `${nomDuReleve(it, article)} · ${sousTitre}` : nomDuReleve(it, article),
    enveloppe,
    priorite: it.priority ?? null,
    quantite,
    unite: uniteCourte(it.unit) ?? (article ? uniteCourte(ouvrageDeLArticle(article).unit) : null),
    prixUnitaire: pu,
    montant: aChiffrer ? 0 : montant,
    aChiffrer: aChiffrer != null,
    raisonAChiffrer: aChiffrer,
    remarque: corrigerTexte(sansPrixAnnonce(texte)),
    automatique: false,
    prixBase,
    prixModifie,
    indexation,
    variantesADetailler: enveloppe !== 'Réparation' && annonceDesVariantes(texte),
    rattacheA: null,
  }
}

/**
 * Les lignes d'un relevé : une par enveloppe retenue.
 *
 * Une réparation prescrite sans prix, une amélioration ou une mise aux normes
 * retenue sans montant restent au devis, à chiffrer. Un relevé sans état n'y
 * entre pas : il n'a encore rien prescrit, et il va aux points à compléter.
 */
function lignesDuReleve(it: ApiDiagnosticItem, article: ApiArticle | undefined, sousTitre: string | null): DevisLigne[] {
  const lignes: DevisLigne[] = []
  const travaux = it.works.filter((w) => w && w !== 'Néant').join(' · ')

  const reparation = num(it.estimatedCost)
  if (reparation > 0) {
    lignes.push(ligneDuReleve(it, article, sousTitre, 'Réparation', reparation, travaux, null))
  } else if (travailPrescrit(it, article)) {
    const raison = it.area == null ? 'quantité manquante' : 'aucun prix pour cet état dans la base'
    lignes.push(ligneDuReleve(it, article, sousTitre, 'Réparation', 0, travaux, raison))
  }

  if (it.norms != null) {
    const montant = num(it.normsCost)
    lignes.push(ligneDuReleve(it, article, sousTitre, 'Mise aux normes', montant, it.norms, montant > 0 ? null : 'mise aux normes retenue sans montant'))
  }

  if (it.improvement != null) {
    const montant = num(it.improvementCost)
    lignes.push(ligneDuReleve(it, article, sousTitre, 'Amélioration', montant, it.improvement, montant > 0 ? null : 'amélioration retenue sans montant'))
  }

  return lignes
}

/**
 * Le sous-titre de chaque relevé : le nom de son étape, et seulement quand il
 * en faut un.
 *
 * Mettre « Façade » sous un crépi de façade n'apprend rien et alourdit la
 * lecture. Le mettre sous une peinture relevée deux fois est indispensable.
 */
function sousTitresDesReleves(items: ApiDiagnosticItem[], etapes: ApiEtapeVisite[]): Map<string, string | null> {
  const etapesParArticle = new Map<string, Set<number>>()
  for (const it of items) {
    if (!it.articleId || it.etapeNumero == null) continue
    if (!etapesParArticle.has(it.articleId)) etapesParArticle.set(it.articleId, new Set())
    etapesParArticle.get(it.articleId)!.add(it.etapeNumero)
  }

  const nomDeLEtape = new Map(etapes.map((e) => [e.numero, e.nom]))
  const parReleve = new Map<string, string | null>()
  for (const it of items) {
    const plusieurs = it.articleId ? (etapesParArticle.get(it.articleId)?.size ?? 0) > 1 : false
    parReleve.set(it.id, plusieurs && it.etapeNumero != null ? nomDeLEtape.get(it.etapeNumero) ?? null : null)
  }
  return parReleve
}

/**
 * Les relevés, tels que les règles des postes automatiques les lisent.
 *
 * Un relevé dont l'article n'est pas dans la base n'y entre pas : on ne sait
 * pas s'il demande un échafaudage, et deviner ferait apparaître ou disparaître
 * un poste de plusieurs milliers de francs.
 *
 * `montant` dit quelles enveloppes comptent : les travaux engagés pour les
 * postes de chantier, tout compris pour savoir ce que les améliorations
 * ajoutent d'échafaudage.
 */
function relevesPourLesPostes(
  items: ApiDiagnosticItem[],
  articles: ApiArticle[],
  montant: (it: ApiDiagnosticItem) => number,
): ReleveDuDevis[] {
  const parId = new Map(articles.map((a) => [a.id, a]))
  const dedans: ReleveDuDevis[] = []
  for (const it of items) {
    const article = it.articleId ? parId.get(it.articleId) : undefined
    if (!article) continue
    dedans.push({
      articleId: article.id,
      nom: article.nom,
      etapeNumero: it.etapeNumero ?? 0,
      echafaudage: article.echafaudage,
      baseQuantite: article.baseQuantite,
      domaineRapport: article.domaineRapport,
      etat: it.state ? ETATS_BASE[it.state] ?? null : null,
      quantite: it.area ?? null,
      montant: montant(it),
      priorite: (it.priority as Priorite | null) ?? null,
    })
  }
  return dedans
}

/** Les travaux engagés d'un relevé : réparation et mise aux normes. */
const engages = (it: ApiDiagnosticItem) => num(it.estimatedCost) + num(it.normsCost)

/** Un poste de la base, indexé comme les prix du catalogue. */
function posteIndexe(p: ApiPosteAutomatique): ApiPosteAutomatique {
  return { ...p, prix: arrondi2(p.prix * getMarketCoeff()) }
}

/** Le poste tel que le dossier le chiffre : son propre prix s'il en a un, sinon celui de la base. */
function posteDuDossier(p: ApiPosteAutomatique, options: DevisOptions): ApiPosteAutomatique {
  const propre = options.prixPostes?.[p.cfcCode]
  return propre != null ? { ...p, prix: propre } : posteIndexe(p)
}

/** Une ligne de poste de chantier, habillée pour le devis. */
function lignePoste(l: {
  cfcCode: string; libelle: string; unite: string; quantite: number | null
  prixUnitaire: number | null; montant: number | null; priorite: Priority | null; remarque: string
}, enveloppe: Enveloppe = 'Poste de chantier', cle = `auto:${l.cfcCode}`): DevisLigne {
  const aChiffrer = l.montant == null
  return {
    cle,
    releveId: null,
    cfcCode: l.cfcCode,
    libelle: l.libelle,
    enveloppe,
    priorite: l.priorite,
    quantite: l.quantite,
    unite: l.unite === 'm2' ? 'm²' : l.unite,
    prixUnitaire: l.prixUnitaire,
    montant: aChiffrer ? 0 : Math.round(l.montant!),
    aChiffrer,
    raisonAChiffrer: aChiffrer ? 'quantité manquante au dossier' : null,
    remarque: l.remarque,
    automatique: true,
    prixBase: l.prixUnitaire,
    prixModifie: false,
    indexation: null,
    variantesADetailler: false,
    rattacheA: null,
  }
}

/**
 * Les postes que la base impose dans tout devis.
 *
 * Leurs prix sont lus dans la table : le bureau doit pouvoir changer le prix
 * d'un échafaudage sans qu'on touche au code. Ils suivent ensuite l'indice de
 * la construction comme les prix du catalogue, parce qu'un devis daté
 * d'aujourd'hui se chiffre au marché d'aujourd'hui.
 *
 * Un poste dont la quantité manque reste au devis, à chiffrer : un échafaudage
 * sans surface de façade n'est pas gratuit.
 *
 * Le calcul lui-même est dans base-cfc/postes.ts, avec ses tests. Ici, on
 * l'habille pour le devis.
 */
export function postesDeChantier(
  items: ApiDiagnosticItem[],
  base: BaseDuDevis,
  options: DevisOptions,
): DevisLigne[] {
  const releves = relevesPourLesPostes(items, base.articles, engages)
  return postesAutomatiques(releves, base.postes.map((p) => posteDuDossier(p, options)), {
    surfacePlancher: options.batiment.surfacePlancher,
    surfaceFacade: options.batiment.surfaceFacade,
    nombreCages: options.batiment.nombreCages,
  }).map((l) => {
    const ligne = lignePoste(l)
    // Le prix de la base, indexé : un prix propre au dossier s'en écarte, et doit se voir.
    const dela = base.postes.find((p) => p.cfcCode === l.cfcCode)
    const prixBase = dela ? posteIndexe(dela).prix : null
    const propre = options.prixPostes?.[l.cfcCode]
    return { ...ligne, prixBase, prixModifie: propre != null && prixBase != null && Math.abs(propre - prixBase) > 0.005 }
  })
}

/**
 * L'échafaudage que les améliorations ajoutent.
 *
 * Leurs prix sont donnés hors échafaudage : une isolation périphérique à 310
 * francs le mètre carré n'inclut pas les 35 francs de l'échafaudage. Si les
 * travaux engagés échafaudent déjà la façade, rien à ajouter ; sinon, ou s'ils
 * n'en échafaudent qu'une partie, le complément va dans l'enveloppe des
 * améliorations. Renoncer aux améliorations retire alors aussi leur
 * échafaudage, et l'arbitrage se fait sur le bon montant.
 */
function echafaudageDesAmeliorations(
  items: ApiDiagnosticItem[],
  base: BaseDuDevis,
  options: DevisOptions,
): DevisLigne | null {
  const poste = base.postes.find((p) => p.cfcCode === '211.1')
  if (!poste) return null
  const facade = options.batiment.surfaceFacade
  const avant = surfaceEchafaudee(relevesPourLesPostes(items, base.articles, engages), facade)
  const apres = surfaceEchafaudee(
    relevesPourLesPostes(items, base.articles, (it) => engages(it) + num(it.improvementCost)),
    facade,
  )
  if (apres.declencheurs.length === avant.declencheurs.length && apres.quantite === avant.quantite) return null

  const prix = posteDuDossier(poste, options).prix
  const declencheurs = apres.declencheurs.filter((d) => !avant.declencheurs.includes(d))
  const remarque = `Échafaudage demandé par ${listeEnClair(declencheurs)}, ${avant.declencheurs.length > 0 ? 'en complément de celui des travaux de réparation' : "qu'aucun autre travail ne monte"}.`
  if (apres.quantite == null) {
    return lignePoste({ cfcCode: poste.cfcCode, libelle: `${poste.libelle}, pour les améliorations`, unite: poste.unite, quantite: null, prixUnitaire: prix, montant: null, priorite: apres.priorite, remarque }, 'Amélioration', 'auto:211.1:amelioration')
  }
  const quantite = arrondi2(apres.quantite - (avant.quantite ?? 0))
  if (quantite <= 0) return null
  const priorite = plusUrgente(items.filter((it) => num(it.improvementCost) > 0).map((it) => (it.priority as Priorite | null) ?? null))
  return lignePoste({
    cfcCode: poste.cfcCode,
    libelle: `${poste.libelle}, pour les améliorations`,
    unite: poste.unite,
    quantite,
    prixUnitaire: prix,
    montant: arrondi2(quantite * prix),
    priorite,
    remarque,
  }, 'Amélioration', 'auto:211.1:amelioration')
}

/** « a, b et 2 autres ouvrages », avec l'accord juste. */
export function listeEnClair(noms: string[], max = 3): string {
  if (noms.length === 0) return ''
  const vus = noms.slice(0, max)
  const reste = noms.length - vus.length
  if (reste > 0) return `${vus.join(', ')} et ${reste} autre${reste > 1 ? 's' : ''} ouvrage${reste > 1 ? 's' : ''}`
  if (vus.length === 1) return vus[0]
  return `${vus.slice(0, -1).join(', ')} et ${vus[vus.length - 1]}`
}

/**
 * L'installation de chantier : un pourcentage des travaux, avec un minimum.
 *
 * Tant que le dossier ne l'a pas réglée, elle paraît à chiffrer plutôt que de
 * manquer : c'est son absence qui faisait sortir un premier devis à 30 % sous
 * celui d'un architecte.
 */
function installationDeChantier(travaux: number, reglage: ReglageInstallation | null | undefined): DevisLigne | null {
  const regle = (r: string) => lignePoste({
    cfcCode: '211.0', libelle: 'Installation de chantier', unite: 'forfait', quantite: 1,
    prixUnitaire: null, montant: null, priorite: null, remarque: r,
  })
  if (reglage == null || (reglage.pct == null && reglage.minimum == null)) {
    const l = regle('Un pourcentage des travaux, avec un minimum forfaitaire.')
    return { ...l, raisonAChiffrer: "pourcentage et minimum à fixer dans l'onglet Coûts", quantite: null }
  }
  const pct = reglage.pct ?? 0
  const minimum = reglage.minimum ?? 0
  if (pct <= 0 && minimum <= 0) return null
  const calcule = travaux * pct / 100
  const montant = Math.round(Math.max(calcule, minimum))
  const remarque = calcule >= minimum
    ? `${nombreFr(pct)} % des travaux${minimum > 0 ? `, minimum ${nombreFr(minimum)} CHF` : ''}.`
    : `Minimum forfaitaire${pct > 0 ? `, ${nombreFr(pct)} % des travaux donnant moins` : ''}.`
  return lignePoste({
    cfcCode: '211.0', libelle: 'Installation de chantier', unite: 'forfait', quantite: 1,
    prixUnitaire: montant, montant, priorite: null, remarque,
  })
}

function nombreFr(v: number): string {
  return new Intl.NumberFormat('fr-CH', { maximumFractionDigits: 2 }).format(v)
}

/** Regroupe des lignes par position CFC à 3 chiffres, triées par code. */
function grouperParPosition(lignes: DevisLigne[], labels: Map<string, string>): DevisPosition[] {
  const parCode = new Map<string, DevisLigne[]>()
  for (const l of lignes) {
    const code = cfcPositionCode(l.cfcCode) ?? ''
    if (!parCode.has(code)) parCode.set(code, [])
    parCode.get(code)!.push(l)
  }
  return Array.from(parCode.entries())
    .map(([code, dedans]) => ({
      code,
      label: code ? (labels.get(code) ?? `CFC ${code}`) : 'Hors nomenclature',
      lignes: dedans,
      montant: dedans.reduce((s, l) => s + l.montant, 0),
    }))
    // Tri par code CFC à l'usage suisse : 211.1 avant 221, et 281.9 avant 281.10.
    .sort((a, b) => comparerCodesCfc(a.code, b.code))
}

/**
 * Les réparations qu'une amélioration rend inutiles, en lignes à déduire.
 *
 * Si le propriétaire retient l'isolation périphérique, la réfection du crépi
 * et le nettoyage de la même façade disparaissent. Le relevé dit lesquels
 * (improvementReplaces) ; chaque réparation remplacée vient en déduction sous
 * l'amélioration, qui se lit alors à son montant net. Une même réparation ne
 * se déduit qu'une fois, même si deux améliorations la remplacent.
 */
function deductions(items: ApiDiagnosticItem[], lignes: DevisLigne[]): DevisLigne[] {
  const reparations = new Map(lignes.filter((l) => l.enveloppe === 'Réparation' && l.montant > 0).map((l) => [l.releveId!, l]))
  const deja = new Set<string>()
  const sortie: DevisLigne[] = []
  for (const it of items) {
    const amelioration = lignes.find((l) => l.releveId === it.id && l.enveloppe === 'Amélioration' && l.montant > 0)
    if (!amelioration) continue
    for (const id of it.improvementReplaces ?? []) {
      const r = reparations.get(id)
      if (!r || deja.has(id)) continue
      deja.add(id)
      sortie.push({
        ...r,
        cle: `${it.id}:deduction:${id}`,
        releveId: null,
        enveloppe: 'Amélioration',
        libelle: `À déduire : ${r.libelle}`,
        remarque: "Réparation rendue inutile par l'amélioration ci-dessus.",
        prixUnitaire: r.prixUnitaire != null ? -r.prixUnitaire : null,
        montant: -r.montant,
        prixModifie: false,
        indexation: null,
        variantesADetailler: false,
        rattacheA: amelioration.cle,
      })
    }
  }
  return sortie
}

/**
 * L'ordre du devis : le code CFC, puis le libellé, puis l'enveloppe. Une
 * déduction suit l'amélioration à laquelle elle se rattache.
 */
function trierLesLignes(lignes: DevisLigne[]): DevisLigne[] {
  const parCle = new Map(lignes.map((l) => [l.cle, l]))
  const tete = (l: DevisLigne) => (l.rattacheA ? parCle.get(l.rattacheA) ?? l : l)
  return [...lignes].sort((a, b) => {
    const ta = tete(a)
    const tb = tete(b)
    return comparerCodesCfc(ta.cfcCode, tb.cfcCode)
      || ta.libelle.localeCompare(tb.libelle, 'fr')
      || ENVELOPPES.indexOf(ta.enveloppe) - ENVELOPPES.indexOf(tb.enveloppe)
      || (a.rattacheA ? 1 : 0) - (b.rattacheA ? 1 : 0)
      || a.libelle.localeCompare(b.libelle, 'fr')
  })
}

/**
 * Le devis du dossier.
 *
 * `labels` est l'index de la nomenclature CFC (code -> libellé officiel), pour
 * que le client lise « 226 Crépissages de façade » et non un code nu.
 */
export function buildDevis(
  items: ApiDiagnosticItem[],
  labels: Map<string, string>,
  base: BaseDuDevis,
  options: DevisOptions,
): Devis {
  const honoraryPct = options.honoraryPct ?? 0
  const reservePct = options.reservePct ?? 0
  const frais = options.frais ?? []
  const sousTitres = sousTitresDesReleves(items, base.etapes)
  const articles = new Map(base.articles.map((a) => [a.id, a]))

  // 1. Les travaux relevés, une ligne par enveloppe retenue.
  const travaux = items.flatMap((it) =>
    lignesDuReleve(it, it.articleId ? articles.get(it.articleId) : undefined, sousTitres.get(it.id) ?? null))

  // 2. Les postes de chantier, et l'échafaudage que les améliorations ajoutent.
  const postes = postesDeChantier(items, base, options)
  const htTravaux = travaux.reduce((s, l) => s + l.montant, 0)
  const installation = travaux.length > 0 ? installationDeChantier(htTravaux, options.installation) : null
  if (installation) postes.push(installation)
  const complement = echafaudageDesAmeliorations(items, base, options)

  const lignes = trierLesLignes([...postes, ...travaux, ...deductions(items, travaux), ...(complement ? [complement] : [])])
  const ht = lignes.reduce((s, l) => s + l.montant, 0)

  const enveloppes: DevisEnveloppe[] = ENVELOPPES.map((cle) => {
    const dedans = lignes.filter((l) => l.enveloppe === cle)
    const htEnveloppe = dedans.reduce((s, l) => s + l.montant, 0)
    return {
      cle,
      lignes: dedans,
      positions: grouperParPosition(dedans, labels),
      ht: htEnveloppe,
      cascade: cascadeDe(htEnveloppe, honoraryPct, reservePct, frais, ht > 0 ? htEnveloppe / ht : 0),
      aChiffrer: dedans.filter((l) => l.aChiffrer).length,
    }
  })

  // 3. Les compteurs par priorité : les lignes tirées des relevés, et elles
  //    seules. La synthèse et le récapitulatif lisent ce même tableau.
  const lignesDeTravaux = lignes.filter((l) => l.releveId != null)
  const priorites: DevisPriorite[] = [...PRIORITES, 'NC' as const]
    .map((cle) => {
      const dedans = lignesDeTravaux.filter((l) => (l.priorite ?? 'NC') === cle)
      return {
        cle,
        titre: cle === 'NC' ? 'Priorité à arbitrer' : `Priorité ${cle}`,
        horizon: cle === 'NC' ? 'non déterminé' : HORIZON[cle],
        lignes: dedans.length,
        ht: dedans.reduce((s, l) => s + l.montant, 0),
      }
    })
    .filter((p) => p.cle !== 'NC' || p.lignes > 0)

  const echafaudage = postes.find((l) => l.cfcCode === '211.1')
  const surface = (echafaudage?.quantite ?? 0) + (complement?.quantite ?? 0)

  return {
    lignes,
    positions: grouperParPosition(lignes, labels),
    enveloppes,
    priorites,
    ht,
    cascade: cascadeDe(ht, honoraryPct, reservePct, frais),
    aChiffrer: lignes.filter((l) => l.aChiffrer),
    reglesAppliquees: postes.map((l) => `CFC ${l.cfcCode}, ${l.libelle} : ${l.remarque}`),
    surfaceEchafaudee: echafaudage || complement ? arrondi2(surface) : null,
  }
}

/** Le sous-ensemble d'une enveloppe. */
export function enveloppeDe(devis: Devis, cle: Enveloppe): DevisEnveloppe {
  return devis.enveloppes.find((e) => e.cle === cle)!
}

/** Le nombre de lignes de travaux, hors postes de chantier. */
export function nombreDeLignesDeTravaux(devis: Devis): number {
  return devis.priorites.reduce((s, p) => s + p.lignes, 0)
}
