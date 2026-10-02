/**
 * La recherche du centre d'aide.
 *
 * Un centre d'aide se juge à sa barre de recherche : personne ne parcourt des
 * catégories quand il a un problème précis. Elle cherche donc dans les trois
 * sources à la fois, articles, tutoriels et questions fréquentes, et elle
 * cherche dans le corps du texte, pas seulement dans les titres.
 *
 * Le calcul vit ici, séparé des écrans, parce qu'un classement se relit et se
 * teste bien plus facilement qu'il ne s'observe à travers une interface.
 */

import type { Article, Tutoriel } from '@/data/documentation'
import type { FaqCategory } from '@/data/support'

export type TypeResultat = 'article' | 'tutoriel' | 'faq'

export interface ResultatAide {
  type: TypeResultat
  /** Identifiant stable, pour la clé de liste. */
  cle: string
  titre: string
  /** Ce qui situe le résultat : sa catégorie, son niveau. */
  contexte: string
  /** Un passage du texte autour du terme cherché. */
  extrait: string
  /** Où aller, pour un article ou un tutoriel. */
  lien?: string
  /** La réponse elle-même, pour une question fréquente : elle se lit sur place. */
  reponse?: string
}

export interface SourcesAide {
  articles: Article[]
  tutoriels: Tutoriel[]
  faq: FaqCategory[]
}

/** Sans accents ni majuscules : « étalonnage » doit se trouver en tapant « etalonnage ». */
export function normaliser(texte: string): string {
  return texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Tout le texte d'un article, titres de sections compris, pour l'indexer. */
export function texteDeLArticle(article: Article): string {
  const morceaux = [article.titre, article.resume]
  for (const s of article.sections) {
    morceaux.push(s.titre)
    for (const b of s.blocs) {
      if (b.type === 'liste' || b.type === 'etapes') morceaux.push(...b.items)
      else morceaux.push(b.texte)
    }
  }
  return morceaux.join(' ')
}

/** Tout le texte d'un tutoriel. */
export function texteDuTutoriel(tuto: Tutoriel): string {
  return [
    tuto.titre,
    tuto.objectif,
    ...(tuto.prerequis ?? []),
    ...tuto.etapes.flatMap((e) => [e.titre, e.detail]),
  ].join(' ')
}

/**
 * Temps de lecture, en minutes.
 *
 * Il se calcule plutôt qu'il ne s'écrit : un chiffre saisi à la main devient
 * faux dès la première correction du texte, et personne ne pense à le reprendre.
 */
export function minutesDeLecture(article: Article): number {
  const mots = texteDeLArticle(article).trim().split(/\s+/).length
  return Math.max(1, Math.round(mots / 200))
}

/**
 * Un passage du texte autour du terme trouvé.
 *
 * Montrer le début de l'article n'apprend rien : ce qu'on veut voir, c'est la
 * phrase qui contient le mot cherché.
 */
export function extraitAutour(texte: string, terme: string, longueur = 150): string {
  const propre = texte.replace(/\s+/g, ' ').trim()
  const i = normaliser(propre).indexOf(normaliser(terme))
  if (i < 0) return propre.length > longueur ? `${propre.slice(0, longueur).trimEnd()}…` : propre
  const debut = Math.max(0, i - Math.floor((longueur - terme.length) / 2))
  const fin = Math.min(propre.length, debut + longueur)
  return `${debut > 0 ? '…' : ''}${propre.slice(debut, fin).trim()}${fin < propre.length ? '…' : ''}`
}

/** Combien de fois le terme revient dans un texte déjà normalisé. */
function occurrences(texte: string, q: string): number {
  let n = 0
  let i = texte.indexOf(q)
  while (i >= 0) { n++; i = texte.indexOf(q, i + q.length) }
  return n
}

/**
 * Un titre qui correspond vaut mieux qu'un corps de texte qui correspond.
 *
 * À égalité, c'est le texte qui revient le plus souvent sur le terme qui traite
 * vraiment le sujet : « étalonnage » cité une fois dans une liste d'onglets ne
 * vaut pas l'article qui lui est consacré.
 */
function score(titre: string, corps: string, q: string): number {
  const t = normaliser(titre)
  const c = normaliser(corps)
  const base = t.startsWith(q) ? 4 : t.includes(q) ? 3 : c.includes(q) ? 1 : 0
  if (base === 0) return 0
  return base + Math.min(occurrences(c, q), 9) / 10
}

/**
 * Cherche dans toute l'aide.
 *
 * Les résultats sont classés par pertinence, et les égalités gardent l'ordre
 * des sources : articles, puis tutoriels, puis questions fréquentes.
 */
export function chercherDansLAide(requete: string, sources: SourcesAide, maximum = 20): ResultatAide[] {
  const q = normaliser(requete.trim())
  if (q.length < 2) return []

  const trouves: { r: ResultatAide; note: number }[] = []

  for (const a of sources.articles) {
    const corps = texteDeLArticle(a)
    const note = score(a.titre, corps, q)
    if (note === 0) continue
    trouves.push({
      note,
      r: {
        type: 'article',
        cle: a.slug,
        titre: a.titre,
        contexte: 'Documentation',
        extrait: extraitAutour(normaliser(a.resume).includes(q) ? a.resume : corps, requete.trim()),
        lien: `/app/support/doc/${a.slug}`,
      },
    })
  }

  for (const t of sources.tutoriels) {
    const corps = texteDuTutoriel(t)
    const note = score(t.titre, corps, q)
    if (note === 0) continue
    trouves.push({
      note,
      r: {
        type: 'tutoriel',
        cle: t.slug,
        titre: t.titre,
        contexte: `Tutoriel · ${t.duree}`,
        extrait: extraitAutour(normaliser(t.objectif).includes(q) ? t.objectif : corps, requete.trim()),
        lien: `/app/support/tuto/${t.slug}`,
      },
    })
  }

  for (const cat of sources.faq) {
    cat.items.forEach((item, i) => {
      const note = score(item.q, item.a, q)
      if (note === 0) return
      trouves.push({
        note,
        r: {
          type: 'faq',
          cle: `${cat.id}-${i}`,
          titre: item.q,
          contexte: `Question fréquente · ${cat.label}`,
          extrait: extraitAutour(item.a, requete.trim()),
          reponse: item.a,
        },
      })
    })
  }

  return trouves
    .map((x, rang) => ({ ...x, rang }))
    .sort((a, b) => b.note - a.note || a.rang - b.rang)
    .slice(0, maximum)
    .map((x) => x.r)
}
