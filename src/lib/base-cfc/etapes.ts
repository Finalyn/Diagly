/**
 * L'ordre de visite : celui du tour du bâtiment, pas celui de la nomenclature.
 *
 * On commence dehors par la façade, on entre dans la cage d'escalier, on
 * regarde la structure, les locaux techniques, on monte dans les appartements,
 * on ressort par les aménagements extérieurs, et « Autres » recueille ce qui
 * n'a pas de lieu précis. Le catalogue se range dans cet ordre, puis par
 * ordre_dans_etape, qui suit le code CFC à l'intérieur de chaque étape.
 *
 * Le point important de ce module tient en une phrase : le relevé n'est pas
 * l'article, c'est le couple (article, étape). La peinture des murs se relève
 * deux fois, dans la cage d'escalier et dans les appartements, avec deux états,
 * deux quantités, deux séries de photos. Évaluer l'une ne remplit pas l'autre,
 * et les compteurs « X relevés sur Y » comptent des couples.
 */

export interface EtapeDeVisite {
  numero: number
  nom: string
  /** Extérieur, Communs, Logements, Bâtiment entier. */
  zone: string
}

export interface LienArticleEtape {
  articleId: string
  etapeNumero: number
  /** Rang dans l'étape, qui suit le code CFC. */
  ordreDansEtape: number
}

/** Le minimum qu'un article doit porter pour se ranger dans le parcours. */
export interface ArticleDuParcours {
  id: string
  actif?: boolean
}

/**
 * L'identité d'un relevé : un article dans une étape.
 *
 * Deux relevés du même article dans deux étapes sont deux relevés distincts.
 * Toute la règle 4 tient dans cette clé, et c'est pour cela qu'elle est
 * exportée plutôt que recalculée à chaque endroit qui en a besoin.
 */
export function cleDuReleve(articleId: string, etapeNumero: number): string {
  return `${articleId}@${etapeNumero}`
}

export interface LigneDuParcours<A extends ArticleDuParcours> {
  cle: string
  article: A
  etapeNumero: number
  ordreDansEtape: number
}

export interface GroupeDEtape<A extends ArticleDuParcours> {
  etape: EtapeDeVisite
  lignes: LigneDuParcours<A>[]
  /** Nombre de relevés attendus dans l'étape, d'après article_etapes. */
  attendus: number
  /** Nombre de relevés déjà faits. */
  faits: number
}

/**
 * Le catalogue rangé par étape de visite.
 *
 * Les articles inactifs sont écartés : ils restent en base pour les diagnostics
 * qui les utilisent déjà, mais ils ne doivent plus se proposer à la visite.
 * Un lien qui désigne un article inconnu est ignoré sans bruit ici, parce que
 * c'est articlesSansEtape et le contrôle d'import qui le signalent.
 */
export function parcoursDeVisite<A extends ArticleDuParcours>(
  etapes: EtapeDeVisite[],
  liens: LienArticleEtape[],
  articles: A[],
  relevesFaits: ReadonlySet<string> = new Set(),
): GroupeDEtape<A>[] {
  const parId = new Map(articles.map((a) => [a.id, a]))

  return [...etapes]
    .sort((a, b) => a.numero - b.numero)
    .map((etape) => {
      const lignes = liens
        .filter((l) => l.etapeNumero === etape.numero)
        .map((l) => ({ lien: l, article: parId.get(l.articleId) }))
        .filter((x): x is { lien: LienArticleEtape; article: A } => !!x.article && x.article.actif !== false)
        .map(({ lien, article }) => ({
          cle: cleDuReleve(lien.articleId, etape.numero),
          article,
          etapeNumero: etape.numero,
          ordreDansEtape: lien.ordreDansEtape,
        }))
        .sort((a, b) => a.ordreDansEtape - b.ordreDansEtape || a.article.id.localeCompare(b.article.id))

      return {
        etape,
        lignes,
        attendus: lignes.length,
        faits: lignes.filter((l) => relevesFaits.has(l.cle)).length,
      }
    })
}

/** « 12 relevés sur 32 », tel quel pour l'écran. */
export function compteurDEtape(groupe: GroupeDEtape<ArticleDuParcours>): string {
  const mot = groupe.faits === 1 ? 'relevé' : 'relevés'
  return `${groupe.faits} ${mot} sur ${groupe.attendus}`
}

/** Les étapes où un article se relève, dans l'ordre de la visite. */
export function etapesDeLArticle(articleId: string, liens: LienArticleEtape[]): number[] {
  return liens
    .filter((l) => l.articleId === articleId)
    .map((l) => l.etapeNumero)
    .sort((a, b) => a - b)
}

/**
 * Les articles actifs qui n'appartiennent à aucune étape.
 *
 * C'est une erreur d'import, pas une situation à gérer : un article sans étape
 * ne se propose jamais à la visite, donc il ne sera jamais relevé, donc il
 * disparaît du rapport sans que personne ne s'en aperçoive. « Autres » existe
 * précisément pour les ouvrages sans lieu précis.
 */
export function articlesSansEtape(articles: ArticleDuParcours[], liens: LienArticleEtape[]): string[] {
  const avec = new Set(liens.map((l) => l.articleId))
  return articles.filter((a) => a.actif !== false && !avec.has(a.id)).map((a) => a.id).sort()
}

/**
 * Le nom de l'étape d'un relevé, pour le sous-titre du devis.
 *
 * null quand l'étape est inconnue : mieux vaut une ligne sans sous-titre qu'un
 * sous-titre faux au-dessus d'un montant.
 */
export function nomDeLEtape(etapeNumero: number | null, etapes: EtapeDeVisite[]): string | null {
  if (etapeNumero === null) return null
  return etapes.find((e) => e.numero === etapeNumero)?.nom ?? null
}
