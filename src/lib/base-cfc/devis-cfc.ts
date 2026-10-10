/**
 * Le devis, trié par code CFC, une ligne par étape.
 *
 * Deux ordres cohabitent dans un diagnostic et il ne faut pas les confondre.
 * Le rapport d'état suit l'ordre de visite, parce qu'il raconte le tour du
 * bâtiment. Le devis suit le code CFC, parce que c'est ainsi qu'une régie et
 * une entreprise suisses lisent un chiffrage, et qu'elles comparent deux
 * offres position par position.
 *
 * Quand un même ouvrage se relève dans plusieurs étapes, il donne autant de
 * lignes, chacune avec le nom de son étape en sous-titre. Deux lignes
 * « Peinture intérieure, murs » à des montants différents, sans rien pour les
 * distinguer, se lisent comme un doublon et font douter de tout le devis.
 *
 * Le montant est toujours recalculé depuis la quantité et le prix unitaire.
 * Jamais recopié d'une édition précédente : une quantité corrigée sur place
 * doit se voir dans le total, et un total qui ne suit pas sa ligne est la pire
 * des erreurs de devis.
 *
 * La note du diagnostiqueur n'entre pas dans ce module. C'est une consigne
 * interne, et elle ne s'imprime jamais chez le client.
 */

import { aucunTravail, type EtatArticle, type Unite } from './normaliser'
import { montant as montantDe, prixUnitaire } from './prix'
import { nomDeLEtape, type EtapeDeVisite } from './etapes'

/** Les états qui chiffrent des travaux. Les deux autres sont des options. */
export const ETATS_DU_DEVIS: EtatArticle[] = ['tres_bon', 'bon', 'moyen', 'mauvais']

/** Les états chiffrés hors du total principal, au tableau des options. */
export const ETATS_DES_OPTIONS: EtatArticle[] = ['amelioration', 'normes']

/** La ligne d'état du catalogue : le texte, le prix et l'unité de cet état. */
export interface EtatChiffre {
  travaux: string | null
  prix: number | null
  partPrixMauvais: number | null
  unite: Unite
}

export interface ReleveAChiffrer {
  articleId: string
  cfcCode: string
  /** Nom de l'article. Le sous-titre est ajouté par ce module. */
  nom: string
  etapeNumero: number | null
  etat: EtatArticle
  etatDuCatalogue: EtatChiffre
  /** Prix de l'état Mauvais du même article, dont dépend l'état moyen. */
  prixMauvais: number | null
  /** Part retenue par le diagnostiqueur pour l'état moyen. */
  partChoisie?: number | null
  quantite: number | null
  /** Prix unitaire saisi à la main, quand le prix est en note (règle 6). */
  prixUnitaireManuel?: number | null
}

export interface LigneDevis {
  /** Unique dans le devis : l'article, son étape et son état. */
  cle: string
  cfcCode: string
  article: string
  /** Nom de l'étape, affiché en sous-titre. null quand l'ouvrage n'en a qu'une. */
  sousTitre: string | null
  /** « Peinture intérieure, murs · Cage d'escalier », pour une seule colonne. */
  libelle: string
  etat: EtatArticle
  travaux: string
  quantite: number | null
  unite: Unite
  prixUnitaire: number | null
  /** null quand la quantité ou le prix manque : à compléter, pas zéro franc. */
  montant: number | null
}

/**
 * Compare deux codes CFC à l'usage suisse.
 *
 * Segment par segment et numériquement, pour que 281.9 précède 281.10 et que
 * 226.1 ne se range pas entre 22 et 221 comme le ferait un tri de texte. Un
 * code plus court passe avant celui qui le prolonge : 211 avant 211.1.
 */
export function comparerCodesCfc(a: string, b: string): number {
  const ga = a.split('.')
  const gb = b.split('.')
  for (let i = 0; i < Math.max(ga.length, gb.length); i++) {
    const va = ga[i]
    const vb = gb[i]
    if (va === undefined) return -1
    if (vb === undefined) return 1
    const na = Number(va)
    const nb = Number(vb)
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      const t = va.localeCompare(vb, 'fr')
      if (t !== 0) return t
      continue
    }
    if (na !== nb) return na - nb
  }
  return 0
}

/**
 * Une ligne de devis, ou null quand il n'y a rien à chiffrer.
 *
 * « Néant » n'est pas un travail : l'état est décrit au rapport, et il ne
 * produit aucune ligne. Un texte de travaux sans prix en produit une, sans
 * montant, parce qu'il faut qu'elle soit vue et complétée.
 */
export function ligneDeDevis(
  releve: ReleveAChiffrer,
  etapes: EtapeDeVisite[] = [],
  avecSousTitre = true,
): LigneDevis | null {
  const { etatDuCatalogue: ligne } = releve
  if (aucunTravail(ligne.travaux)) return null
  if (!ligne.travaux && ligne.prix === null) return null

  const unitaire = releve.prixUnitaireManuel ?? prixUnitaire(releve.etat, ligne, {
    prixMauvais: releve.prixMauvais,
    partChoisie: releve.partChoisie,
  })

  const sousTitre = avecSousTitre ? nomDeLEtape(releve.etapeNumero, etapes) : null
  return {
    cle: `${releve.articleId}@${releve.etapeNumero ?? '-'}:${releve.etat}`,
    cfcCode: releve.cfcCode,
    article: releve.nom,
    sousTitre,
    libelle: sousTitre ? `${releve.nom} · ${sousTitre}` : releve.nom,
    etat: releve.etat,
    travaux: ligne.travaux ?? '',
    quantite: releve.quantite,
    unite: ligne.unite,
    prixUnitaire: unitaire,
    montant: montantDe(releve.quantite, unitaire),
  }
}

/**
 * Le devis trié, avec le sous-titre d'étape là où il est nécessaire.
 *
 * Le sous-titre ne s'ajoute qu'aux ouvrages relevés dans plusieurs étapes.
 * Mettre « Façade » sous un crépi de façade n'apprend rien et alourdit la
 * lecture ; le mettre sous une peinture relevée deux fois est indispensable.
 */
export function lignesDuDevis(releves: ReleveAChiffrer[], etapes: EtapeDeVisite[] = []): LigneDevis[] {
  const etapesParArticle = new Map<string, Set<number>>()
  for (const r of releves) {
    if (r.etapeNumero === null) continue
    if (!etapesParArticle.has(r.articleId)) etapesParArticle.set(r.articleId, new Set())
    etapesParArticle.get(r.articleId)!.add(r.etapeNumero)
  }

  return releves
    .map((r) => ligneDeDevis(r, etapes, (etapesParArticle.get(r.articleId)?.size ?? 0) > 1))
    .filter((l): l is LigneDevis => l !== null)
    .sort((a, b) =>
      comparerCodesCfc(a.cfcCode, b.cfcCode)
      || a.article.localeCompare(b.article, 'fr')
      || (a.sousTitre ?? '').localeCompare(b.sousTitre ?? '', 'fr'))
}

/** Total des lignes chiffrées. Les lignes à compléter n'y entrent pas. */
export function totalDesLignes(lignes: LigneDevis[]): number {
  return lignes.reduce((s, l) => s + (l.montant ?? 0), 0)
}

/** Les lignes qu'il faut compléter avant d'éditer le devis. */
export function lignesACompleter(lignes: LigneDevis[]): LigneDevis[] {
  return lignes.filter((l) => l.montant === null)
}
