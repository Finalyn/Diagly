/**
 * Le nombre de pages d'un PDF, lu sans rien rendre.
 *
 * La file d'analyse doit savoir combien de feuilles compte chaque document
 * avant de les mettre en file, y compris sur le téléphone, où le navigateur
 * des feuilles n'affiche pas de vignettes. Ouvrir le document suffit : pdf.js
 * en donne le nombre de pages sans en peindre aucune.
 *
 * Dans son propre fichier parce que c'est un hook et non un composant : un
 * module qui exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { loadPdfjs } from '@/lib/pdf'
import type { ApiPlan } from '@/lib/api-types'

const cache = new Map<string, Promise<number>>()

async function compter(plan: ApiPlan): Promise<number> {
  const buf = await (await fetch(api.plans.fileUrl(plan))).arrayBuffer()
  const pdfjsLib = await loadPdfjs()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const n = pdf.numPages
  void pdf.destroy()
  return n
}

/** Le nombre de pages du document ; 1 pour une image, null le temps de le lire. */
export function useNombreDePages(plan: ApiPlan): number | null {
  const pdf = plan.mimeType === 'application/pdf'
  const [resultat, setResultat] = useState<{ id: string; n: number } | null>(null)
  useEffect(() => {
    if (!pdf) return
    let abandonne = false
    let p = cache.get(plan.id)
    if (!p) {
      p = compter(plan)
      cache.set(plan.id, p)
      p.catch(() => cache.delete(plan.id))
    }
    p.then((n) => { if (!abandonne) setResultat({ id: plan.id, n }) }).catch(() => undefined)
    return () => { abandonne = true }
    // Le nombre de pages ne dépend que du document : l'URL signée change à
    // chaque rafraîchissement de la liste sans que le fichier change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, pdf])
  if (!pdf) return 1
  return resultat?.id === plan.id ? resultat.n : null
}
