/**
 * La recherche d'un symbole sur tout le jeu de plans, côté navigateur.
 *
 * Chaque feuille vectorielle est lue une fois (pdf.js, liste d'opérateurs, au
 * repère du canevas de l'éditeur, courbes aplaties), puis gardée le temps de
 * la page : chercher un deuxième symbole ne relit rien. Une image ou un PDF
 * scanné n'a pas de traits, et n'est pas parcouru.
 *
 * Dans son propre fichier parce que ce n'est pas un composant : un module qui
 * exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { api } from '@/lib/api'
import { loadPdfjs } from '@/lib/pdf'
import type { ApiPlan } from '@/lib/api-types'
import { IndexGeometrie, extraireSegments, type OpsPdf } from '@/lib/plans/geometrie-vectorielle'
import { chercherSymbole, type Gabarit, type Occurrence } from '@/lib/plans/symboles'
import { LARGEUR_CANEVAS } from '@/components/plans/analyse'

type DocumentPdf = { getPage: (n: number) => Promise<{
  getViewport: (o: { scale: number }) => { width: number; transform: number[] }
  getOperatorList: () => Promise<{ fnArray: ArrayLike<number>; argsArray: ArrayLike<unknown> }>
}> }

const documents = new Map<string, Promise<DocumentPdf>>()
const geometries = new Map<string, Promise<IndexGeometrie | null>>()

function documentDe(plan: ApiPlan): Promise<DocumentPdf> {
  let d = documents.get(plan.id)
  if (!d) {
    d = (async () => {
      const buf = await (await fetch(api.plans.fileUrl(plan))).arrayBuffer()
      const pdfjsLib = await loadPdfjs()
      return (await pdfjsLib.getDocument({ data: buf }).promise) as unknown as DocumentPdf
    })()
    // Un échec ne doit pas rester en cache : on réessaiera à la prochaine recherche.
    d.catch(() => documents.delete(plan.id))
    documents.set(plan.id, d)
  }
  return d
}

/** Les traits d'une page, courbes aplaties, au repère du canevas ; null sans dessin vectoriel. */
export function geometrieDeLaPage(plan: ApiPlan, numero: number): Promise<IndexGeometrie | null> {
  const cle = `${plan.id}#${plan.fileName}#${numero}`
  let g = geometries.get(cle)
  if (!g) {
    g = (async () => {
      if (plan.mimeType !== 'application/pdf') return null
      const pdf = await documentDe(plan)
      const pdfjsLib = await loadPdfjs()
      const page = await pdf.getPage(numero)
      const base = page.getViewport({ scale: 1 })
      const vue = page.getViewport({ scale: LARGEUR_CANEVAS / base.width })
      const geo = extraireSegments(await page.getOperatorList(), pdfjsLib.OPS as unknown as OpsPdf, vue.transform, undefined, { courbes: true })
      return geo.nombre > 0 ? new IndexGeometrie(geo) : null
    })().catch(() => null)
    geometries.set(cle, g)
  }
  return g
}

export interface OccurrencesDeLaFeuille {
  planId: string
  page: number
  occurrences: Occurrence[]
}

/** Cherche le gabarit sur chaque feuille vectorielle du jeu, l'une après l'autre. */
export async function chercherDansLeJeu(
  feuilles: { plan: ApiPlan; page: number }[],
  gabarit: Gabarit,
  progres: (fait: number, total: number) => void,
  signal?: AbortSignal,
): Promise<OccurrencesDeLaFeuille[]> {
  const sortie: OccurrencesDeLaFeuille[] = []
  for (const [i, f] of feuilles.entries()) {
    if (signal?.aborted) break
    const index = await geometrieDeLaPage(f.plan, f.page)
    if (index) {
      const occurrences = chercherSymbole(index, gabarit)
      if (occurrences.length) sortie.push({ planId: f.plan.id, page: f.page, occurrences })
    }
    progres(i + 1, feuilles.length)
    // Laisser respirer l'interface entre deux feuilles.
    await new Promise((r) => setTimeout(r, 0))
  }
  return sortie
}
