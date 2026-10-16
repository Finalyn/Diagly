/**
 * Les éléments qui se comptent : portes, fenêtres, balcons, cuisines,
 * appareils sanitaires.
 *
 * La base CFC chiffre ces ouvrages à la pièce, et leur quantité se déduisait
 * jusqu'ici d'une règle : une porte palière par logement, une porte d'entrée
 * par cage. Une règle ne voit pas l'immeuble où deux logements se partagent un
 * palier, ni celui dont les combles ont été aménagés. Des plans d'étage, eux,
 * montrent chaque porte : l'IA les compte, le diagnostiqueur relit, et le
 * nombre trouvé remplace la règle.
 *
 * Un nombre ne suffit pourtant pas. Six portes palières comptées ne disent pas
 * qu'il y en a deux en bois et quatre en métal, et ce sont deux articles du
 * catalogue. Le comptage donne donc le total de la catégorie, et chaque type
 * relevé dit combien d'unités lui reviennent : « 2/6 en bois ». C'est la même
 * idée que la part de surface des groupes d'alternatives (groupes-surface.ts),
 * en nombre plutôt qu'en pourcent, parce qu'on ne dit pas « trente-trois pour
 * cent de portes en bois ».
 *
 * Les articles se rattachent à leur catégorie par leur identifiant et, en
 * repli, par leur nom : un article ajouté plus tard au classeur (« Portes
 * palières en métal ») rejoint la bonne catégorie sans toucher au code.
 *
 * Module pur, sans réseau : le serveur garde sa propre liste des catégories
 * (server/src/lib/comptages.ts), et un test y vérifie que les deux concordent.
 */

/** Les catégories, sous les clés que le serveur, l'IA et le dossier partagent. */
export type CategorieComptee =
  | 'porte_entree' | 'porte_paliere' | 'porte_interieure' | 'fenetre'
  | 'fenetre_toit' | 'balcon' | 'cuisine' | 'appareil_sanitaire'

export interface DefinitionCategorie {
  cle: CategorieComptee
  /** Titre de la catégorie : « Portes palières ». */
  libelle: string
  singulier: string
  pluriel: string
  /** Pour accorder « comptées » ou « comptés ». */
  feminin: boolean
  /** Articles de la base rattachés d'office. */
  articles: readonly string[]
  /** Repli sur le nom de l'article, accents et casse ignorés. */
  motif: RegExp
  /**
   * Le début de nom que partagent les types de la catégorie : retiré, il
   * laisse ce qui les distingue (« en bois », « en métal »).
   */
  prefixe: RegExp | null
  /**
   * Unité du chiffrage. Les fenêtres se chiffrent au mètre carré mais se
   * comptent aussi : le nombre répartit la surface entre les types.
   */
  unite: 'pce' | 'm2'
}

/** Dans l'ordre où un diagnostiqueur les passe en revue : de l'entrée aux logements. */
export const CATEGORIES_COMPTEES: readonly DefinitionCategorie[] = [
  {
    cle: 'porte_entree', libelle: 'Portes d’entrée d’immeuble', singulier: 'porte d’entrée', pluriel: 'portes d’entrée',
    feminin: true, articles: ['A027', 'A028', 'A029', 'A030', 'A031', 'A032', 'A033', 'A034'],
    motif: /^portes?\s+(exterieures?|d'entree)/, prefixe: /^portes?\s+exterieures?\s*/, unite: 'pce',
  },
  {
    cle: 'porte_paliere', libelle: 'Portes palières', singulier: 'porte palière', pluriel: 'portes palières',
    feminin: true, articles: ['A134'],
    motif: /portes?\s+palieres?/, prefixe: /^portes?\s+palieres?\s*/, unite: 'pce',
  },
  {
    cle: 'porte_interieure', libelle: 'Portes intérieures', singulier: 'porte intérieure', pluriel: 'portes intérieures',
    feminin: true, articles: ['A124', 'A135'],
    motif: /^portes?\s+(interieures?|de\s+communication)/, prefixe: /^portes?\s+(interieures?\s*)?/, unite: 'pce',
  },
  {
    cle: 'fenetre', libelle: 'Fenêtres et portes-fenêtres', singulier: 'fenêtre', pluriel: 'fenêtres',
    feminin: true, articles: ['A019', 'A020', 'A021', 'A022', 'A023', 'A024'],
    motif: /^(fenetres?|portes?-fenetres?|vitrines?)(\s|$|,)/, prefixe: /^fenetres?\s*/, unite: 'm2',
  },
  {
    cle: 'fenetre_toit', libelle: 'Fenêtres de toit et lanterneaux', singulier: 'fenêtre de toit', pluriel: 'fenêtres de toit',
    feminin: true, articles: ['A046', 'A047'],
    motif: /fenetres?\s+de\s+toit|lanterneaux?|tabatieres?/, prefixe: null, unite: 'pce',
  },
  {
    cle: 'balcon', libelle: 'Balcons', singulier: 'balcon', pluriel: 'balcons',
    feminin: false, articles: ['A005'],
    motif: /^balcons?(\s|$|,)/, prefixe: /^balcons?\s*/, unite: 'pce',
  },
  {
    cle: 'cuisine', libelle: 'Cuisines', singulier: 'cuisine', pluriel: 'cuisines',
    feminin: true, articles: ['A086'],
    motif: /^(agencements?\s+de\s+)?cuisines?(\s|$|,)/, prefixe: null, unite: 'pce',
  },
  {
    // Les éviers de cuisine n'y sont pas : ils font partie de l'agencement de
    // cuisine, compté à part. Les compter deux fois chiffrerait deux fois l'évier.
    cle: 'appareil_sanitaire', libelle: 'Appareils sanitaires', singulier: 'appareil sanitaire', pluriel: 'appareils sanitaires',
    feminin: false, articles: ['A081', 'A082'],
    motif: /^appareils?\s+sanitaires?/, prefixe: /^appareils?\s+sanitaires?\s*/, unite: 'pce',
  },
]

/** La définition d'une catégorie, par sa clé. */
export const CATEGORIE: Record<CategorieComptee, DefinitionCategorie> = Object.fromEntries(
  CATEGORIES_COMPTEES.map((c) => [c.cle, c]),
) as Record<CategorieComptee, DefinitionCategorie>

export const CLES_CATEGORIES = CATEGORIES_COMPTEES.map((c) => c.cle)

export function estUneCategorie(v: unknown): v is CategorieComptee {
  return typeof v === 'string' && (CLES_CATEGORIES as string[]).includes(v)
}

// ---------------------------------------------------------------- le comptage

export type SourceComptage = 'plans' | 'analyse' | 'saisie'
export type ConfianceComptage = 'haute' | 'moyenne' | 'basse'

/** Ce que le dossier sait du nombre d'éléments d'une catégorie. */
export interface Comptage {
  categorie: CategorieComptee
  /** Entier, zéro compris : « aucun balcon » est une réponse. */
  nombre: number
  /** Surface totale en m², pour les fenêtres seulement, quand elle a été mesurée. */
  surface?: number | null
  /** Lu au démarrage sur les plans, compté dans l'outil Plan, ou saisi à la main. */
  source: SourceComptage
  /** Le calcul, en clair : « 2 par palier × 3 étages ». */
  detail: string | null
  /** Pages des plans d'où vient le compte. */
  pages: string[]
  confiance: ConfianceComptage | null
  /** Relu par le diagnostiqueur. Un compte lu par l'IA et jamais relu reste à vérifier. */
  valide: boolean
  /** Date de la dernière modification, en ISO. */
  majLe: string
}

export type Comptages = Partial<Record<CategorieComptee, Comptage>>

/** Au-delà, ce n'est plus un immeuble mais une erreur de lecture. */
export const NOMBRE_MAX = 5000

const SOURCES: readonly SourceComptage[] = ['plans', 'analyse', 'saisie']
const CONFIANCES: readonly ConfianceComptage[] = ['haute', 'moyenne', 'basse']

/**
 * Les comptages du dossier, relus depuis le JSON stocké.
 *
 * Le serveur les valide à l'écriture ; on les relit quand même sans rien
 * supposer, parce qu'un dossier mis en cache sur la tablette peut dater d'une
 * autre version. Une entrée illisible est écartée plutôt que de fausser un
 * devis.
 */
export function comptagesDuDossier(v: unknown): Comptages {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const r: Comptages = {}
  for (const [cle, brut] of Object.entries(v as Record<string, unknown>)) {
    if (!estUneCategorie(cle) || !brut || typeof brut !== 'object') continue
    const c = brut as Record<string, unknown>
    const nombre = c.nombre
    if (typeof nombre !== 'number' || !Number.isInteger(nombre) || nombre < 0 || nombre > NOMBRE_MAX) continue
    const surface = typeof c.surface === 'number' && Number.isFinite(c.surface) && c.surface > 0 ? c.surface : null
    r[cle] = {
      categorie: cle,
      nombre,
      surface: CATEGORIE[cle].unite === 'm2' ? surface : null,
      source: SOURCES.includes(c.source as SourceComptage) ? (c.source as SourceComptage) : 'saisie',
      detail: typeof c.detail === 'string' && c.detail.trim() ? c.detail.trim() : null,
      pages: Array.isArray(c.pages) ? c.pages.filter((p): p is string => typeof p === 'string' && !!p.trim()) : [],
      confiance: CONFIANCES.includes(c.confiance as ConfianceComptage) ? (c.confiance as ConfianceComptage) : null,
      valide: c.valide === true,
      majLe: typeof c.majLe === 'string' ? c.majLe : '',
    }
  }
  return r
}

/**
 * Un comptage relu à la main : confirmé tel quel, ou corrigé.
 *
 * Confirmé, il garde sa source et son calcul, et passe pour relu. Corrigé, il
 * devient une saisie : le calcul de l'IA ne décrit plus le nombre qu'on vient
 * d'écrire, il ne doit plus s'afficher à côté.
 */
export function comptageSaisi(categorie: CategorieComptee, nombre: number, avant?: Comptage | null, surface?: number | null): Comptage {
  const avecSurface = CATEGORIE[categorie].unite === 'm2'
  const nouvelleSurface = avecSurface ? (surface !== undefined ? surface : avant?.surface ?? null) : null
  const majLe = new Date().toISOString()
  if (avant && avant.nombre === nombre && (avant.surface ?? null) === nouvelleSurface) {
    return { ...avant, valide: true, majLe }
  }
  return {
    categorie, nombre, surface: nouvelleSurface, source: 'saisie',
    detail: null, pages: [], confiance: null, valide: true, majLe,
  }
}

// ---------------------------------------------------------------- rattachement

/** Accents, casse, apostrophes et espaces ramenés à une forme comparable. */
export function nomComparable(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim()
}

/** Les catégories dans l'ordre où leurs motifs se testent : les plus précis d'abord. */
const ORDRE_DES_MOTIFS: CategorieComptee[] = [
  'fenetre_toit', 'porte_paliere', 'porte_entree', 'porte_interieure', 'fenetre', 'balcon', 'cuisine', 'appareil_sanitaire',
]

/**
 * La catégorie comptée d'un article, ou null.
 *
 * L'identifiant d'abord : c'est le rattachement voulu. Le nom ensuite, pour
 * les articles que la liste ne connaît pas encore. L'unité tranche les cas
 * douteux : un article au mètre courant ou au forfait ne se compte pas, et
 * seules les fenêtres se comptent en étant chiffrées au mètre carré.
 */
export function categorieDeLArticle(article: { id?: string | null; nom?: string | null; uniteEntretien?: string | null }): CategorieComptee | null {
  const unite = article.uniteEntretien ? article.uniteEntretien.replace('²', '2').toLowerCase() : null
  const uniteAdmise = (c: DefinitionCategorie) => unite === null || unite === 'pce' || unite === c.unite
  if (article.id) {
    const parId = CATEGORIES_COMPTEES.find((c) => c.articles.includes(article.id!))
    if (parId) return uniteAdmise(parId) ? parId.cle : null
  }
  if (!article.nom) return null
  const nom = nomComparable(article.nom)
  for (const cle of ORDRE_DES_MOTIFS) {
    const c = CATEGORIE[cle]
    if (c.motif.test(nom)) return uniteAdmise(c) ? cle : null
  }
  return null
}

/**
 * Le nom court d'un type dans sa catégorie : « Portes palières en bois »
 * devient « en bois ». Ce qui reste vide (« Vitrines ») garde son nom entier.
 */
export function nomCourt(nom: string, categorie: CategorieComptee): string {
  const prefixe = CATEGORIE[categorie].prefixe
  if (!prefixe) return nom
  // Le motif lit la forme sans accents ; on coupe le nom d'origine au même
  // endroit, une fois ramené à la même longueur (lettres composées, espaces).
  const propre = nom.normalize('NFC').replace(/\s+/g, ' ').trim()
  const m = nomComparable(propre).match(prefixe)
  if (!m) return propre
  const reste = propre.slice(m[0].length).replace(/^[,\s]+/, '').trim()
  return reste || propre
}

// ---------------------------------------------------------------- accords

const accord = (n: number, feminin: boolean, racine: string) =>
  `${racine}${feminin ? 'e' : ''}${n >= 2 ? 's' : ''}`

/** « 6 portes palières », « 1 balcon ». */
export function enNombre(n: number, categorie: CategorieComptee): string {
  const c = CATEGORIE[categorie]
  return `${n} ${n >= 2 ? c.pluriel : c.singulier}`
}

/** « comptées », « compté ». */
export const comptees = (n: number, categorie: CategorieComptee) => accord(n, CATEGORIE[categorie].feminin, 'compté')
/** « réparties », « réparti ». */
export const reparties = (n: number, categorie: CategorieComptee) => accord(n, CATEGORIE[categorie].feminin, 'réparti')

const ORIGINES: Record<SourceComptage, string> = {
  plans: 'sur les plans',
  analyse: 'sur le plan analysé',
  saisie: 'au dossier',
}

/** D'où vient la quantité, en une ligne : « 6 portes palières comptées sur les plans ». */
export function phraseDuComptage(c: Comptage): string {
  const surface = c.surface != null ? `, ${String(Math.round(c.surface * 100) / 100).replace('.', ',')} m²` : ''
  return `${enNombre(c.nombre, c.categorie)} ${comptees(c.nombre, c.categorie)} ${ORIGINES[c.source]}${surface}`
}

// ---------------------------------------------------------------- quantité d'un type

/**
 * Les unités qui reviennent à un type.
 *
 * Seul dans sa catégorie et sans nombre, il prend tout : demander « 6 sur 6 »
 * pour un immeuble aux portes toutes pareilles serait une saisie pour rien,
 * comme la part de 100 % du premier type d'un groupe. Dès qu'il y a deux
 * types, le nombre de chacun devient une observation, et il est demandé.
 */
export function unitesEffectives(unites: number | null | undefined, nombreDeTypes: number, comptage: Pick<Comptage, 'nombre'>): number | null {
  if (unites != null) return unites
  return nombreDeTypes === 1 ? comptage.nombre : null
}

/**
 * Les unités à fixer quand un type rejoint sa catégorie.
 *
 * Le type déjà là prenait tout sans rien porter : il garde explicitement ce
 * qu'il avait, et le nouveau arrive sans nombre, « à préciser ». Jamais un
 * nombre inventé : partager six portes en trois et trois serait une
 * répartition que personne n'a vue.
 */
export function unitesAFixerALAjout(
  existants: { id: string; unites?: number | null }[],
  comptage: Pick<Comptage, 'nombre'>,
): { id: string; unites: number }[] {
  if (existants.length !== 1 || existants[0].unites != null) return []
  return [{ id: existants[0].id, unites: comptage.nombre }]
}

const arrondi2 = (v: number) => Math.round(v * 100) / 100

/**
 * La quantité d'un type d'une catégorie comptée.
 *
 * À la pièce, ce sont ses unités. Au mètre carré (les fenêtres), sa part de
 * la surface de la catégorie au prorata du nombre : 4 fenêtres sur 24 prennent
 * le sixième de la surface. `undefined` quand le nombre du type n'est pas
 * connu : mieux vaut pas de quantité qu'une quantité fausse.
 */
export function quantiteDuTypeCompte(
  totalDeLaCategorie: number | null | undefined,
  unites: number | null,
  comptage: Pick<Comptage, 'nombre'>,
  unite: string | null | undefined,
): number | undefined {
  if (unites == null) return undefined
  const auMetreCarre = !!unite && /m2|m²/i.test(unite)
  if (!auMetreCarre) return unites
  if (unites === 0) return 0
  if (totalDeLaCategorie == null || comptage.nombre <= 0) return undefined
  return arrondi2((totalDeLaCategorie * unites) / comptage.nombre)
}

// ---------------------------------------------------------------- répartition

export interface TypeReparti {
  /** Identifiant du relevé. */
  id: string
  nom: string
  /** « en bois » */
  court: string
  /** Ce que le relevé porte. */
  unites: number | null
  /** Ce qui lui revient : ses unités, ou tout s'il est seul et sans nombre. */
  effectives: number | null
}

export type RaisonRepartition = 'aucun-type' | 'unites-manquantes' | 'somme'

export interface EtatRepartition {
  categorie: CategorieComptee
  libelle: string
  comptage: Comptage
  types: TypeReparti[]
  comptees: number
  reparties: number
  /** Ce qui reste à attribuer ; négatif quand on en a réparti plus que compté. */
  reste: number
  /** Types relevés sans nombre. */
  sansUnites: number
  /** true quand les quantités peuvent être chiffrées sans rien inventer. */
  complet: boolean
  raison: RaisonRepartition | null
  /** « Portes palières : 5 réparties sur 6 comptées » */
  phrase: string
  /** « Réparties : 2 en bois, 4 en métal » ou « 2 en bois · 4 à préciser » */
  detail: string
}

/** L'état de la répartition d'une catégorie entre les types relevés. */
export function etatDeLaRepartition(
  comptage: Comptage,
  releves: { id: string; nom: string; unites?: number | null }[],
): EtatRepartition {
  const cat = comptage.categorie
  const N = comptage.nombre
  const types: TypeReparti[] = releves.map((r) => ({
    id: r.id,
    nom: r.nom,
    court: nomCourt(r.nom, cat),
    unites: r.unites ?? null,
    effectives: unitesEffectives(r.unites, releves.length, comptage),
  }))
  const somme = types.reduce((s, t) => s + (t.effectives ?? 0), 0)
  const sansUnites = types.filter((t) => t.effectives == null).length
  const reste = N - somme
  const libelle = CATEGORIE[cat].libelle
  const base = { categorie: cat, libelle, comptage, types, comptees: N, reparties: somme, reste, sansUnites }

  if (types.length === 0) {
    return {
      ...base, complet: false, raison: 'aucun-type',
      phrase: `${libelle} : ${N} ${comptees(N, cat)}, aucun type relevé`,
      detail: 'Aucun type relevé : à préciser pendant la visite',
    }
  }

  const raison: RaisonRepartition | null = sansUnites > 0 ? 'unites-manquantes' : reste !== 0 ? 'somme' : null
  const parts = types.filter((t) => t.effectives != null).map((t) => `${t.effectives} ${t.court}`)
  if (!raison) {
    return {
      ...base, complet: true, raison: null,
      phrase: `${libelle} : ${somme} ${reparties(somme, cat)} sur ${N} ${comptees(N, cat)}`,
      detail: `Réparties : ${parts.join(', ')}`,
    }
  }
  const suite = [
    ...parts,
    reste > 0 ? `${reste} à préciser` : reste < 0 ? `${-reste} de trop` : null,
    sansUnites > 0 && reste <= 0 ? `${sansUnites} type${sansUnites > 1 ? 's' : ''} sans nombre` : null,
  ].filter(Boolean)
  // Six réparties sur six, et pourtant incomplet : un type n'a pas son
  // nombre. La phrase le dit, sinon elle se lirait comme une répartition juste.
  const precision = sansUnites > 0 ? `, ${sansUnites} type${sansUnites > 1 ? 's' : ''} à préciser` : ''
  return {
    ...base, complet: false, raison,
    phrase: `${libelle} : ${somme} ${reparties(somme, cat)} sur ${N} ${comptees(N, cat)}${precision}`,
    detail: suite.join(' · '),
  }
}

/** Ce qu'il faut savoir d'un relevé pour le ranger dans sa catégorie. */
export interface ReleveDeCategorie {
  id: string
  articleId?: string | null
  cfcLabel: string
  unites?: number | null
}

/** La catégorie d'un relevé, par son article quand la base le connaît, par son libellé sinon. */
export function categorieDuReleve(
  r: Pick<ReleveDeCategorie, 'articleId' | 'cfcLabel'>,
  articles: { id: string; nom: string; uniteEntretien?: string | null }[],
): CategorieComptee | null {
  const article = r.articleId ? articles.find((a) => a.id === r.articleId) : undefined
  return categorieDeLArticle(article ?? { id: r.articleId ?? null, nom: r.cfcLabel })
}

/**
 * La répartition de chaque catégorie comptée du dossier, dans l'ordre des
 * catégories. Une catégorie sans comptage n'y figure pas : rien ne change
 * pour elle, ses quantités suivent la règle de la base.
 */
export function repartitionsDuDossier(
  comptages: Comptages,
  releves: ReleveDeCategorie[],
  articles: { id: string; nom: string; uniteEntretien?: string | null }[],
): EtatRepartition[] {
  const parCategorie = new Map<CategorieComptee, ReleveDeCategorie[]>()
  for (const r of releves) {
    const cat = categorieDuReleve(r, articles)
    if (!cat || !comptages[cat]) continue
    if (!parCategorie.has(cat)) parCategorie.set(cat, [])
    parCategorie.get(cat)!.push(r)
  }
  return CATEGORIES_COMPTEES.flatMap((c) => {
    const comptage = comptages[c.cle]
    if (!comptage) return []
    const membres = (parCategorie.get(c.cle) ?? []).map((r) => ({ id: r.id, nom: r.cfcLabel, unites: r.unites ?? null }))
    return [etatDeLaRepartition(comptage, membres)]
  })
}

/**
 * Les répartitions qui empêchent d'éditer le rapport.
 *
 * Une catégorie comptée sans aucun type relevé n'en fait pas partie : rien
 * n'y est chiffré de travers, il reste seulement à la voir pendant la visite.
 */
export function repartitionsIncompletes(etats: EtatRepartition[]): EtatRepartition[] {
  return etats.filter((e) => e.types.length > 0 && !e.complet)
}

/**
 * Ce qu'un nouveau jeu de comptages remplace, en phrases : à dire avant
 * d'écrire, parce qu'un compte relu à la main ne doit pas disparaître sans
 * qu'on l'ait vu partir.
 */
export function ceQuiChange(avant: Comptages, apres: Comptages): string[] {
  const NOMS: Record<SourceComptage, string> = { plans: 'lu sur les plans', analyse: 'compté sur un plan', saisie: 'saisi à la main' }
  const phrases: string[] = []
  for (const c of CATEGORIES_COMPTEES) {
    const a = avant[c.cle]
    const b = apres[c.cle]
    if (!a || !b) continue
    if (a.nombre === b.nombre && (a.surface ?? null) === (b.surface ?? null)) continue
    phrases.push(`${c.libelle} : ${a.nombre} (${NOMS[a.source]}) remplacé par ${b.nombre}`)
  }
  return phrases
}
