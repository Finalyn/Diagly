/**
 * Le contrôle avant envoi : ce qui rend un rapport faux ou incomplet.
 *
 * Un premier rapport comparé à un devis d'architecte sortait 30 % plus bas.
 * L'écart ne venait pas des prix, mais d'une toiture à 0 CHF, d'un poste
 * absent, de trois saisies du même carrelage et de façades dont la somme
 * dépassait la façade du bâtiment. Rien de cela ne se voit en lisant le
 * rapport : il faut le chercher. Ce module le cherche, pour la page Rapports.
 *
 * Deux gravités :
 *  - bloquant : le total est faux ou contradictoire. Le rapport peut sortir en
 *    brouillon, mais la page le dit avant chaque téléchargement ou partage ;
 *  - à vérifier : le total tient, mais un lecteur averti le remarquerait.
 */
import { donneesDuBatiment, type FicheDuBatiment } from './base-cfc/batiment'
import { quantiteDeBase } from './base-cfc/quantites'
import { cleDuReleve } from './base-cfc/etapes'
import { groupesDuReleve } from './groupes-surface'
import { bonEtatSuspect, dureeVieResiduelle } from './duree-vie'
import { LIBELLE_LOCALISATION } from './localisation'
import { nomDuReleve } from './textes'
import type { Devis, DevisLigne } from './devis'
import type { ApiArticle, ApiDiagnosticItem, ApiEtapeVisite, ElementState } from './api-types'

export type GraviteControle = 'bloquant' | 'a-verifier'

export type GenreControle =
  | 'sans-prix' | 'poste-sans-quantite' | 'installation' | 'doublon' | 'surface-depassee'
  | 'sans-observation' | 'non-evalue' | 'duree-incoherente' | 'variantes'

export interface ControleRapport {
  cle: string
  genre: GenreControle
  gravite: GraviteControle
  titre: string
  detail: string
  /** Les relevés en cause, pour y mener. */
  releveIds: string[]
}

const ETAT: Record<ElementState, string> = { TRES_BON: 'Très bon', BON: 'Bon', MOYEN: 'Moyen', MAUVAIS: 'Mauvais' }

/** Le lieu d'un relevé, dit en clair : « Façade », « Cage d'escalier · Communs ». */
function lieu(it: ApiDiagnosticItem, etapes: Map<number, string>): string {
  const etape = it.etapeNumero != null ? etapes.get(it.etapeNumero) : undefined
  const loc = it.localisation ? LIBELLE_LOCALISATION[it.localisation] : undefined
  return [etape, loc].filter(Boolean).join(' · ') || 'hors étape'
}

/**
 * Les doublons : le même ouvrage relevé deux fois dans la même zone.
 *
 * La même étape et la même localisation (communs ou logements) : la peinture
 * de la cage et celle des appartements sont deux relevés, pas un doublon.
 */
export function doublons(items: ApiDiagnosticItem[]): ApiDiagnosticItem[][] {
  const paquets = new Map<string, ApiDiagnosticItem[]>()
  for (const it of items) {
    const ouvrage = it.articleId ?? `${it.cfcCode}|${it.cfcLabel.trim().toLowerCase()}`
    const cle = `${ouvrage}#${it.etapeNumero ?? ''}#${it.localisation ?? ''}`
    if (!paquets.has(cle)) paquets.set(cle, [])
    paquets.get(cle)!.push(it)
  }
  return [...paquets.values()].filter((p) => p.length > 1)
}

export interface Fusion {
  /** Le relevé gardé, et ce qu'il reçoit des autres. */
  garde: string
  patch: Partial<ApiDiagnosticItem>
  /** Les relevés à retirer une fois la fusion écrite. */
  retires: string[]
}

/**
 * La fusion de relevés en double : on garde celui qu'on choisit, avec son
 * état et son prix, et il reçoit les photos et les observations des autres.
 * Rien de ce qui a été vu sur place ne se perd.
 */
export function fusionner(groupe: ApiDiagnosticItem[], gardeId: string): Fusion {
  const garde = groupe.find((i) => i.id === gardeId) ?? groupe[0]
  const autres = groupe.filter((i) => i.id !== garde.id)
  const photos = [...new Set([...garde.photos, ...autres.flatMap((i) => i.photos)])]
  const notes = [...new Set([garde.notes, ...autres.map((i) => i.notes)].map((n) => n?.trim()).filter((n): n is string => !!n))]
  const patch: Partial<ApiDiagnosticItem> = {}
  if (photos.length !== garde.photos.length) patch.photos = photos
  const texte = notes.join('\n')
  if (texte !== (garde.notes ?? '').trim()) patch.notes = texte
  if (garde.yearInstalled == null) {
    const annee = autres.find((i) => i.yearInstalled != null)?.yearInstalled
    if (annee != null) patch.yearInstalled = annee
  }
  return { garde: garde.id, patch, retires: autres.map((i) => i.id) }
}

/**
 * Les surfaces d'un groupe d'alternatives qui dépassent la surface du
 * bâtiment : pierre, crépi et peinture saisis sur plus de façade que la
 * façade n'en a, ou plus de toiture que la toiture.
 */
export function surfacesDepassees(
  items: ApiDiagnosticItem[],
  articles: ApiArticle[],
  fiche: FicheDuBatiment,
): { nom: string; etapeNumero: number | null; saisi: number; reference: number; releveIds: string[] }[] {
  const batiment = donneesDuBatiment(fiche)
  const parId = new Map(articles.map((a) => [a.id, a]))
  const groupes = groupesDuReleve(
    items.map((it) => ({
      id: it.id, cfcLabel: it.cfcLabel, sharePct: it.sharePct, etapeNumero: it.etapeNumero ?? null,
      cleArticle: it.articleId && it.etapeNumero != null ? cleDuReleve(it.articleId, it.etapeNumero) : null,
    })),
    items.flatMap((it) => {
      const a = it.articleId ? parId.get(it.articleId) : undefined
      return a && it.etapeNumero != null ? [{ id: cleDuReleve(a.id, it.etapeNumero), surfaceGroup: a.groupeAlternatives }] : []
    }),
  )
  const sortie = []
  for (const g of groupes) {
    const membres = g.membres.map((m) => items.find((i) => i.id === m.id)!).filter(Boolean)
    const article = membres.map((m) => (m.articleId ? parId.get(m.articleId) : undefined)).find(Boolean)
    if (!article || article.baseQuantite === 'saisie_manuelle' || article.baseQuantite === 'forfait') continue
    // La surface du groupe, avant tout partage entre ses types.
    const reference = quantiteDeBase({ baseQuantite: article.baseQuantite, coefficient: article.coefficient }, batiment)
    if (reference == null || reference <= 0) continue
    const saisi = membres.reduce((s, m) => s + (m.area ?? 0), 0)
    if (saisi > reference * 1.02 + 0.5) {
      sortie.push({ nom: g.nom, etapeNumero: g.etapeNumero, saisi: Math.round(saisi), reference: Math.round(reference), releveIds: membres.map((m) => m.id) })
    }
  }
  return sortie
}

export interface DonneesDuControle {
  items: ApiDiagnosticItem[]
  articles: ApiArticle[]
  etapes: ApiEtapeVisite[]
  fiche: FicheDuBatiment
  devis: Devis
}

const mots = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`

/** Tout ce que le contrôle trouve, les points bloquants d'abord. */
export function controlerLeRapport({ items, articles, etapes, fiche, devis }: DonneesDuControle): ControleRapport[] {
  const sortie: ControleRapport[] = []
  const nomEtape = new Map(etapes.map((e) => [e.numero, e.nom]))
  const parArticle = new Map(articles.map((a) => [a.id, a]))
  const nom = (it: ApiDiagnosticItem) => nomDuReleve(it, parArticle)
  const parId = new Map(items.map((i) => [i.id, i]))

  // 1. Ce qui n'a pas de prix : le total le compte zéro.
  for (const l of devis.aChiffrer) sortie.push(controleDePrix(l, parId))

  // 2. Les doublons.
  for (const groupe of doublons(items)) {
    const premier = groupe[0]
    const etats = groupe.map((i) => (i.state ? ETAT[i.state] : 'À évaluer'))
    sortie.push({
      cle: `doublon:${groupe.map((i) => i.id).join(',')}`,
      genre: 'doublon',
      gravite: 'bloquant',
      titre: `${nom(premier)} relevé ${groupe.length} fois`,
      detail: `${lieu(premier, nomEtape)} : ${etats.join(', ')}. Gardez un seul relevé ; les photos et les observations des autres le rejoignent.`,
      releveIds: groupe.map((i) => i.id),
    })
  }

  // 3. Les surfaces qui dépassent celle du bâtiment.
  for (const d of surfacesDepassees(items, articles, fiche)) {
    sortie.push({
      cle: `surface:${d.nom}@${d.etapeNumero ?? ''}`,
      genre: 'surface-depassee',
      gravite: 'bloquant',
      titre: `${d.nom} : ${d.saisi} m² saisis pour ${d.reference} m²`,
      detail: 'La somme des surfaces saisies dépasse celle du bâtiment. Corrigez les quantités reprises à la main, ou les parts de chaque type.',
      releveIds: d.releveIds,
    })
  }

  // 4. Les relevés eux-mêmes.
  const sansObservation: ApiDiagnosticItem[] = []
  const nonEvalues: ApiDiagnosticItem[] = []
  for (const it of items) {
    if (!it.state) { nonEvalues.push(it); continue }
    if ((it.state === 'MOYEN' || it.state === 'MAUVAIS') && !it.notes?.trim()) sansObservation.push(it)
    const vie = dureeVieResiduelle(it, {})
    if (bonEtatSuspect(it.state, vie)) {
      sortie.push({
        cle: `duree:${it.id}`,
        genre: 'duree-incoherente',
        gravite: 'a-verifier',
        titre: `${nom(it)} : état ${ETAT[it.state]}, durée de vie dépassée de ${vie!.depassement} ans`,
        detail: `Posé en ${vie!.anneePose} pour ${vie!.reference} ans de durée de vie. Vérifiez l'année de pose, ou l'état.`,
        releveIds: [it.id],
      })
    }
  }
  if (sansObservation.length > 0) {
    sortie.push({
      cle: 'sans-observation',
      genre: 'sans-observation',
      gravite: 'bloquant',
      titre: `${mots(sansObservation.length, 'ouvrage Moyen ou Mauvais', 'ouvrages Moyen ou Mauvais')} sans observation`,
      detail: `Un état dégradé s'explique au client : ${sansObservation.slice(0, 4).map(nom).join(', ')}${sansObservation.length > 4 ? '…' : '.'}`,
      releveIds: sansObservation.map((i) => i.id),
    })
  }
  if (nonEvalues.length > 0) {
    sortie.push({
      cle: 'non-evalue',
      genre: 'non-evalue',
      gravite: 'a-verifier',
      titre: `${mots(nonEvalues.length, 'ouvrage non évalué', 'ouvrages non évalués')}`,
      detail: `Ils ne figurent pas au devis, et le rapport les liste dans « Points à compléter » : ${nonEvalues.slice(0, 4).map(nom).join(', ')}${nonEvalues.length > 4 ? '…' : '.'}`,
      releveIds: nonEvalues.map((i) => i.id),
    })
  }

  // 5. Les variantes annoncées pour un seul montant.
  for (const l of devis.lignes.filter((x) => x.variantesADetailler)) {
    sortie.push({
      cle: `variantes:${l.cle}`,
      genre: 'variantes',
      gravite: 'a-verifier',
      titre: `${l.libelle} : plusieurs variantes pour un seul montant`,
      detail: `« ${l.remarque} ». Chiffrez une ligne par variante, et dites si elles s'excluent ou se cumulent.`,
      releveIds: l.releveId ? [l.releveId] : [],
    })
  }

  return sortie.sort((a, b) => (a.gravite === b.gravite ? 0 : a.gravite === 'bloquant' ? -1 : 1))
}

function controleDePrix(l: DevisLigne, parId: Map<string, ApiDiagnosticItem>): ControleRapport {
  if (l.cfcCode === '211.0' && l.automatique) {
    return {
      cle: `prix:${l.cle}`, genre: 'installation', gravite: 'bloquant',
      titre: 'Installation de chantier à régler',
      detail: "Fixez son pourcentage des travaux et son minimum dans l'onglet Coûts, ou mettez-les à zéro s'il n'y en a pas.",
      releveIds: [],
    }
  }
  if (l.automatique) {
    return {
      cle: `prix:${l.cle}`, genre: 'poste-sans-quantite', gravite: 'bloquant',
      titre: `${l.libelle} sans quantité`,
      detail: 'Le poste est compté d’office, mais une dimension du bâtiment manque à la fiche pour le chiffrer.',
      releveIds: [],
    }
  }
  const it = l.releveId ? parId.get(l.releveId) : undefined
  const etat = it?.state ? ` (${ETAT[it.state]}${it.priority ? `, priorité ${it.priority}` : ''})` : ''
  return {
    cle: `prix:${l.cle}`,
    genre: 'sans-prix',
    gravite: 'bloquant',
    titre: `${l.libelle}${etat} : ${l.enveloppe.toLowerCase()} sans prix`,
    detail: `Compté 0 CHF au total : ${l.raisonAChiffrer ?? 'montant à saisir'}. Saisissez le prix, ou la quantité.`,
    releveIds: l.releveId ? [l.releveId] : [],
  }
}

/** Les points bloquants seuls. */
export const bloquants = (c: ControleRapport[]) => c.filter((x) => x.gravite === 'bloquant')
