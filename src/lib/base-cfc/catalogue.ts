/**
 * La base CFC telle que le diagnostic la présente : étape par étape.
 *
 * Ce module fait la jonction entre la base du bureau et l'écran de visite. Il
 * ne calcule ni prix ni quantité, c'est l'affaire des autres modules ; il
 * répond à une seule question, celle que se pose le diagnostiqueur sur place :
 * qu'est-ce qu'il me reste à relever, et où ?
 *
 * Deux principes s'y appliquent.
 *
 * Le relevé est le couple (article, étape). Un article de plusieurs étapes
 * donne autant de lignes à remplir, et chacune a son état, ses photos et sa
 * quantité.
 *
 * Rien ne disparaît. Un relevé dont l'article n'a pas de repreneur dans la
 * base reste rendu à part plutôt que d'être tu : un diagnostic déjà fait ne
 * doit pas perdre une observation parce que le catalogue a changé.
 */

import type {
  ApiArticle, ApiArticleEtat, ApiBaseCfc, ApiDiagnosticItem, ApiEtapeVisite, BuildingType,
} from '../api-types'
import { cle, type EtatArticle } from './normaliser'
import { cleDuReleve } from './etapes'

/**
 * Intitulé de l'étape des surfaces principales, selon l'affectation.
 *
 * Un diagnostic ne porte pas que sur du logement. Devant une école,
 * « Appartements » n'a aucun sens : on relève des salles de classe. Le contenu
 * de l'étape ne change pas, ce sont les mêmes revêtements et les mêmes portes,
 * mais son intitulé doit désigner ce qu'on a devant soi.
 */
export const SURFACES_PRINCIPALES: Record<BuildingType, string> = {
  LOGEMENT: 'Appartements',
  VILLA: 'Pièces du logement',
  CHALET: 'Pièces du logement',
  SCOLAIRE: 'Salles de classe',
  BUREAU: 'Bureaux',
  ADMINISTRATIF: 'Bureaux',
  INDUSTRIEL: 'Halles et ateliers',
  HOTEL: 'Chambres',
  COMMERCIAL: 'Surfaces de vente',
  AUTRE: 'Surfaces principales',
}

/** Le nom que porte l'étape des logements dans la base. */
const ETAPE_DES_LOGEMENTS = 'Appartements'

/** Intitulé d'une étape pour un bâtiment donné. */
export function nomDeLEtapePourLeBatiment(etape: ApiEtapeVisite, type?: BuildingType | null): string {
  if (etape.nom !== ETAPE_DES_LOGEMENTS || !type) return etape.nom
  return SURFACES_PRINCIPALES[type] ?? etape.nom
}

export interface LigneDeVisite {
  /** « A100@2 » : l'article dans son étape. */
  cle: string
  article: ApiArticle
  etapeNumero: number
  /** Zone de l'étape : Extérieur, Communs, Logements, Bâtiment entier. */
  zone: string
  ordreDansEtape: number
  /** Le relevé existant, ou null s'il reste à faire. */
  releve: ApiDiagnosticItem | null
}

export interface DomaineDEtape {
  /** Chapitre du rapport : « Extérieur », « Intérieur, murs », etc. */
  nom: string
  lignes: LigneDeVisite[]
  attendus: number
  faits: number
}

export interface EtapeDuDiagnostic {
  numero: number
  /** Intitulé affiché, qui suit l'affectation du bâtiment. */
  nom: string
  zone: string
  domaines: DomaineDEtape[]
  attendus: number
  faits: number
}

export interface ParcoursDuDiagnostic {
  etapes: EtapeDuDiagnostic[]
  /**
   * Relevés dont l'article n'appartient pas à la base, ou qui n'ont pas d'étape.
   * Rendus à part, jamais masqués.
   */
  horsBase: ApiDiagnosticItem[]
  attendus: number
  faits: number
}

/** Un relevé compte comme fait quand il porte un état. */
export const releveFait = (r: ApiDiagnosticItem | null | undefined): boolean => !!r && r.state !== null

/**
 * Le parcours de visite d'un diagnostic.
 *
 * Les articles désactivés ne se proposent plus, sauf si un relevé les utilise
 * déjà : on ne retire pas de l'écran un ouvrage que le diagnostiqueur a
 * observé, on arrête seulement d'en proposer de nouveaux.
 */
export function parcoursDuDiagnostic(
  base: Pick<ApiBaseCfc, 'articles' | 'etapes'>,
  releves: ApiDiagnosticItem[],
  type?: BuildingType | null,
): ParcoursDuDiagnostic {
  const parCle = new Map<string, ApiDiagnosticItem>()
  for (const r of releves) {
    if (r.articleId && r.etapeNumero != null) parCle.set(cleDuReleve(r.articleId, r.etapeNumero), r)
  }

  const utilises = new Set(releves.map((r) => r.articleId).filter((v): v is string => !!v))
  const places = new Set<string>()

  const etapes: EtapeDuDiagnostic[] = [...base.etapes]
    .sort((a, b) => a.numero - b.numero)
    .map((etape) => {
      const lignes: LigneDeVisite[] = []
      for (const article of base.articles) {
        const lien = article.etapes.find((e) => e.etapeNumero === etape.numero)
        if (!lien) continue
        if (!article.actif && !utilises.has(article.id)) continue
        const cle = cleDuReleve(article.id, etape.numero)
        const releve = parCle.get(cle) ?? null
        if (releve) places.add(releve.id)
        lignes.push({
          cle, article, etapeNumero: etape.numero, zone: etape.zone,
          ordreDansEtape: lien.ordreDansEtape, releve,
        })
      }
      lignes.sort((a, b) => a.ordreDansEtape - b.ordreDansEtape || a.article.id.localeCompare(b.article.id))

      const domaines = grouperParDomaine(lignes)
      return {
        numero: etape.numero,
        nom: nomDeLEtapePourLeBatiment(etape, type),
        zone: etape.zone,
        domaines,
        attendus: lignes.length,
        faits: lignes.filter((l) => releveFait(l.releve)).length,
      }
    })
    .filter((e) => e.attendus > 0)

  const horsBase = releves.filter((r) => !places.has(r.id))
  return {
    etapes,
    horsBase,
    attendus: etapes.reduce((s, e) => s + e.attendus, 0),
    faits: etapes.reduce((s, e) => s + e.faits, 0),
  }
}

/**
 * Regroupe les lignes d'une étape par chapitre du rapport.
 *
 * L'ordre des chapitres suit celui des articles, qui suit le code CFC : le
 * diagnostiqueur retrouve dans l'étape l'ordre qu'il connaît du rapport, sans
 * qu'on impose une liste de chapitres en dur qui vieillirait mal.
 */
function grouperParDomaine(lignes: LigneDeVisite[]): DomaineDEtape[] {
  const par = new Map<string, LigneDeVisite[]>()
  for (const l of lignes) {
    const nom = l.article.domaineRapport
    if (!par.has(nom)) par.set(nom, [])
    par.get(nom)!.push(l)
  }
  return [...par.entries()].map(([nom, dedans]) => ({
    nom,
    lignes: dedans,
    attendus: dedans.length,
    faits: dedans.filter((l) => releveFait(l.releve)).length,
  }))
}

/** L'état d'un article, ou undefined si le catalogue ne le décrit pas. */
export function etatDeLArticle(article: ApiArticle, etat: EtatArticle): ApiArticleEtat | undefined {
  return article.etats.find((e) => e.etat === etat)
}

/** Le prix de l'état Mauvais, dont dépend le calcul de l'état moyen. */
export function prixMauvaisDe(article: ApiArticle): number | null {
  return etatDeLArticle(article, 'mauvais')?.prix ?? null
}

/** Les états que le catalogue chiffre ou décrit pour cet article. */
export function etatsRenseignes(article: ApiArticle): ApiArticleEtat[] {
  return article.etats.filter((e) => e.travaux !== null || e.prix !== null)
}

/** Index par identifiant, pour retrouver l'article d'un relevé. */
export function indexDesArticles(articles: ApiArticle[]): Map<string, ApiArticle> {
  return new Map(articles.map((a) => [a.id, a]))
}

/**
 * Localisation au sens de l'ancien relevé, déduite de la zone de l'étape.
 *
 * Le rapport et le devis distinguent encore les communs des logements par ce
 * champ, pour écrire « peinture des murs, communs ». La zone de l'étape dit la
 * même chose, en mieux : on la traduit tant que les deux coexistent, de sorte
 * qu'un relevé fait dans la nouvelle base garde son suffixe au devis.
 */
export function localisationDeLaZone(zone: string): 'COMMUNS' | 'LOGEMENTS' | null {
  if (zone === 'Communs') return 'COMMUNS'
  if (zone === 'Logements') return 'LOGEMENTS'
  return null
}

/**
 * Le parcours réduit à ce qui répond à une recherche.
 *
 * Insensible aux accents et à la casse, sur le code CFC, le nom de l'article et
 * le chapitre du rapport : on tape « facade » sans cédille et « crepi » sans
 * accent, parce qu'on cherche d'une main en tenant une tablette.
 *
 * Les étapes et les chapitres vides disparaissent : une recherche qui laisse
 * sept titres d'étape vides ne montre pas ses résultats, elle les cache.
 */
export function filtrerLeParcours(etapes: EtapeDuDiagnostic[], recherche: string): EtapeDuDiagnostic[] {
  const q = cle(recherche.trim())
  if (!q) return etapes
  const correspond = (l: LigneDeVisite) =>
    cle(l.article.cfcCode).includes(q)
    || cle(l.article.nom).includes(q)
    || cle(l.article.domaineRapport).includes(q)

  return etapes
    .map((e) => {
      const domaines = e.domaines
        .map((d) => {
          const lignes = d.lignes.filter(correspond)
          return { ...d, lignes, attendus: lignes.length, faits: lignes.filter((l) => releveFait(l.releve)).length }
        })
        .filter((d) => d.lignes.length > 0)
      const lignes = domaines.flatMap((d) => d.lignes)
      return {
        ...e, domaines,
        attendus: lignes.length,
        faits: lignes.filter((l) => releveFait(l.releve)).length,
      }
    })
    .filter((e) => e.domaines.length > 0)
}
