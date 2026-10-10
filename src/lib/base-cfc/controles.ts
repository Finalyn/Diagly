/**
 * Les contrôles qualité de la base, article par article.
 *
 * Ils ne bloquent rien : ils signalent. Une base de prix se tient à la main, et
 * la main se trompe. Ce qu'on cherche ici, ce sont les erreurs qui ne se voient
 * pas à la lecture et qui ressortent dans un devis, chez un client :
 *
 *  - un état « Néant » qui porte un prix : on ne facture pas une absence de
 *    travaux ;
 *  - des travaux décrits sans prix : la ligne partira au devis sans montant ;
 *  - un code CFC absent de la nomenclature : la position n'aura pas de libellé
 *    et le devis affichera un code nu ;
 *  - un article sans étape de visite : il ne se proposera jamais, donc il ne
 *    sera jamais relevé, donc il disparaîtra du rapport sans bruit ;
 *  - deux articles de même code et de nom proche : le doublon qu'on crée sans
 *    le vouloir.
 */

import type { ApiArticle } from '../api-types'
import { aucunTravail, cle } from './normaliser'

export type GraviteControle = 'erreur' | 'avertissement'

export type RaisonControle =
  | 'neant_avec_prix'
  | 'travaux_sans_prix'
  | 'code_inconnu'
  | 'sans_etape'
  | 'doublon_probable'

export interface Controle {
  articleId: string
  raison: RaisonControle
  gravite: GraviteControle
  message: string
}

/** Nom lisible de chaque état, pour les messages. */
const ETATS: Record<string, string> = {
  tres_bon: 'Très bon',
  bon: 'Bon',
  moyen: 'Moyen',
  mauvais: 'Mauvais',
  amelioration: 'Amélioration',
  normes: 'Normes',
}

/**
 * Ce qui cloche dans un article.
 *
 * `codesConnus` est l'index de la nomenclature ; sans lui, le contrôle du code
 * ne se fait pas plutôt que de signaler tous les codes comme inconnus.
 */
export function controlerLArticle(
  article: ApiArticle,
  codesConnus?: ReadonlySet<string>,
): Controle[] {
  const dedans: Controle[] = []
  const dire = (raison: RaisonControle, gravite: GraviteControle, message: string) =>
    dedans.push({ articleId: article.id, raison, gravite, message })

  for (const e of article.etats) {
    if (aucunTravail(e.travaux) && e.prix !== null && e.prix > 0) {
      dire('neant_avec_prix', 'erreur',
        `État ${ETATS[e.etat] ?? e.etat} : « Néant » avec un prix de ${e.prix}. Un ouvrage sans travaux ne se facture pas.`)
    }
    if (e.travaux && !aucunTravail(e.travaux) && e.prix === null) {
      dire('travaux_sans_prix', 'avertissement',
        `État ${ETATS[e.etat] ?? e.etat} : des travaux sont décrits sans prix. La ligne partira au devis sans montant.`)
    }
  }

  if (codesConnus && !codesConnus.has(article.cfcCode)) {
    dire('code_inconnu', 'erreur',
      `Le code CFC ${article.cfcCode} n'est pas dans la nomenclature : le devis affichera un code sans libellé.`)
  }

  if (article.etapes.length === 0 && article.actif) {
    dire('sans_etape', 'erreur',
      "Aucune étape de visite : cet article ne se proposera jamais au relevé.")
  }

  return dedans
}

/** Tous les contrôles de la base, article par article. */
export function controlerLaBase(articles: ApiArticle[], codesConnus?: ReadonlySet<string>): Controle[] {
  const dedans = articles.flatMap((a) => controlerLArticle(a, codesConnus))
  return [...dedans, ...doublonsProbables(articles)]
}

/** Les contrôles d'un article, retrouvés dans la liste complète. */
export function controlesDeLArticle(controles: Controle[], articleId: string): Controle[] {
  return controles.filter((c) => c.articleId === articleId)
}

/**
 * Les doublons probables : même code CFC et nom proche.
 *
 * Le rapprochement se fait sur les premiers mots du nom, parce que c'est la fin
 * qui distingue d'ordinaire deux articles voisins (« ... en bois » et « ... en
 * métal ») et que la confondre serait prendre deux ouvrages distincts pour un
 * doublon. Deux articles qui ne diffèrent que par leur fin ne sont donc pas
 * signalés : seuls le sont ceux dont le nom entier se ressemble.
 */
export function doublonsProbables(articles: ApiArticle[]): Controle[] {
  const dedans: Controle[] = []
  const parCode = new Map<string, ApiArticle[]>()
  for (const a of articles) {
    if (!a.actif) continue
    if (!parCode.has(a.cfcCode)) parCode.set(a.cfcCode, [])
    parCode.get(a.cfcCode)!.push(a)
  }

  for (const groupe of parCode.values()) {
    for (let i = 0; i < groupe.length; i++) {
      for (let j = i + 1; j < groupe.length; j++) {
        if (!nomsProches(groupe[i].nom, groupe[j].nom)) continue
        dedans.push({
          articleId: groupe[j].id,
          raison: 'doublon_probable',
          gravite: 'avertissement',
          message: `Article semblable existant : ${groupe[i].id} « ${groupe[i].nom} », même code CFC.`,
        })
      }
    }
  }
  return dedans
}

/** Deux noms se ressemblent-ils assez pour qu'on s'en inquiète ? */
export function nomsProches(a: string, b: string): boolean {
  const na = cle(a)
  const nb = cle(b)
  if (na === nb) return true
  const motsA = na.split(' ').filter(Boolean)
  const motsB = nb.split(' ').filter(Boolean)
  if (motsA.length === 0 || motsB.length === 0) return false
  // Même début et même longueur de nom : la différence est un détail, pas une
  // distinction de matériau.
  const communs = motsA.filter((m, i) => motsB[i] === m).length
  const plusLong = Math.max(motsA.length, motsB.length)
  return communs / plusLong >= 0.8
}

/** Un article à proposer avant d'en créer un nouveau, s'il en existe un semblable. */
export function articleSemblable(
  articles: ApiArticle[],
  nouveau: { cfcCode: string; nom: string },
): ApiArticle | null {
  return articles.find((a) => a.actif && a.cfcCode === nouveau.cfcCode && nomsProches(a.nom, nouveau.nom)) ?? null
}
