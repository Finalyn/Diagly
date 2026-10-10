/**
 * Les deux cas où l'article ne porte pas son propre prix.
 *
 * Règle 5, l'article lié : l'amélioration d'un chauffage électrique direct,
 * c'est une pompe à chaleur. Le classeur ne la chiffre donc pas sur A068, il
 * renvoie à A064. Plutôt que de laisser un diagnostiqueur chercher pourquoi la
 * case est vide, l'application propose l'autre article avec son prix.
 *
 * Règle 6, le prix en note : quelques articles portent leur prix dans la note
 * du diagnostiqueur, parce qu'il dépend de quelque chose qui ne se calcule pas
 * (le nombre de luminaires, par exemple). On l'extrait pour l'afficher à la
 * saisie, et la ligne devient saisissable à la main.
 */

export interface ArticleLiable {
  id: string
  nom: string
  /** Article qui porte l'amélioration de celui-ci. */
  articleLieId: string | null
}

export interface AmeliorationDeLArticle {
  travaux: string | null
  prix: number | null
}

export interface PropositionAmelioration {
  articleAProposer: string
  message: string
}

/**
 * Ce qu'il faut proposer quand on retient une amélioration non chiffrée.
 *
 * Seulement quand les trois conditions tiennent : l'article renvoie à un
 * autre, son amélioration est décrite, et elle n'a pas de prix. Si elle en a
 * un, le renvoi serait une complication inutile.
 */
export function propositionAmelioration(
  article: ArticleLiable,
  amelioration: AmeliorationDeLArticle,
  nomDeLArticleLie?: string,
): PropositionAmelioration | null {
  if (!article.articleLieId) return null
  if (amelioration.prix !== null) return null
  if (!amelioration.travaux) return null
  const cible = nomDeLArticleLie ?? article.articleLieId
  return {
    articleAProposer: article.articleLieId,
    message: `L'amélioration de « ${article.nom} » est chiffrée sur « ${cible} ». Voulez-vous l'ajouter au relevé ?`,
  }
}

export interface PrixIndicatif {
  montant: number
  /** Ce que le prix compte : « par luminaire », « m² ». Null si la note ne le dit pas. */
  parQuoi: string | null
  /** La phrase d'où il vient, pour l'afficher telle quelle. */
  source: string
}

/** « 400.- », « 310 CHF », « CHF 1'250 », « 250.– ». */
const MONTANT = /(?:chf\s*)?(\d[\d'’\s]*(?:[.,]\d+)?)\s*(?:\.-|\.–|chf|frs?\b)/i
/** Ce que le prix compte, juste après le montant. */
const PAR_QUOI = /(?:\/\s*(m²|m2|ml|pce|logement)|par\s+([a-zà-ÿ'’-]+))/i

/**
 * Le prix indicatif caché dans une note, s'il y en a un.
 *
 * Volontairement prudent : une note qui ne suit pas la forme attendue ne rend
 * rien, plutôt qu'un nombre attrapé au hasard dans une phrase. Un prix faux
 * dans un devis coûte plus cher qu'un prix absent.
 */
export function prixIndicatifDeLaNote(note: string | null): PrixIndicatif | null {
  if (!note) return null
  const m = MONTANT.exec(note)
  if (!m) return null
  const montant = Number(m[1].replace(/['’\s]/g, '').replace(',', '.'))
  if (!Number.isFinite(montant) || montant <= 0) return null

  const apres = note.slice(m.index + m[0].length)
  const q = PAR_QUOI.exec(apres)
  const parQuoi = q ? (q[1] ?? q[2]) : null

  // La phrase qui porte le montant, pour que le diagnostiqueur lise le
  // raisonnement et pas seulement le chiffre.
  const phrases = note.split(/(?<=[.;])\s+/)
  const source = phrases.find((p) => MONTANT.test(p)) ?? note
  return { montant, parQuoi: parQuoi ? parQuoi.replace('m2', 'm²') : null, source: source.trim() }
}
