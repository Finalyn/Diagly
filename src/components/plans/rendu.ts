/**
 * Rendu d'un plan en image.
 *
 * Un PDF ne s'affiche pas tout seul : il faut le décoder et le peindre. Ce
 * module le fait une fois par plan et par résolution, et garde le résultat :
 * la vignette de la liste, le grand aperçu et le calque de référence de
 * l'éditeur tirent tous de la même source.
 *
 * Séparé des composants parce que c'est un hook et des fonctions : un module qui
 * exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { loadPdfjs } from '@/lib/pdf'
import type { ApiPlan } from '@/lib/api-types'

/**
 * Largeur du rendu dans l'éditeur. Les annotations sont enregistrées dans ce
 * repère : l'aperçu doit le reproduire pour poser les zones au bon endroit,
 * quelle que soit la résolution de l'image qu'il affiche.
 */
const LARGEUR_REPERE = 1600

export interface Rendu {
  url: string
  /** Dimensions du repère des annotations, pas celles du bitmap affiché. */
  largeur: number
  hauteur: number
}

/**
 * Un rendu par plan et par résolution demandée. Sans ce cache, revenir sur un
 * plan relançait le décodage complet du PDF, soit une seconde d'attente pour une
 * image déjà calculée.
 */
const cache = new Map<string, Promise<Rendu>>()

async function rendre(plan: ApiPlan, largeurCible: number): Promise<Rendu> {
  const url = api.plans.fileUrl(plan)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!

  if (plan.mimeType === 'application/pdf') {
    const buf = await (await fetch(url)).arrayBuffer()
    const pdfjsLib = await loadPdfjs()
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise
    const page = await pdf.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const repere = page.getViewport({ scale: LARGEUR_REPERE / base.width })
    const vue = page.getViewport({ scale: largeurCible / base.width })
    canvas.width = vue.width
    canvas.height = vue.height
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vue }).promise
    return { url: canvas.toDataURL('image/jpeg', 0.82), largeur: repere.width, hauteur: repere.height }
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((ok, ko) => {
    img.onload = () => ok()
    img.onerror = () => ko(new Error('image illisible'))
    img.src = url
  })
  // Le repère de l'éditeur ne grandit jamais une petite image : on reprend la
  // même règle, sinon les zones d'un plan basse résolution seraient décalées.
  const kRepere = Math.min(1, LARGEUR_REPERE / img.width)
  const k = Math.min(1, largeurCible / img.width)
  canvas.width = Math.round(img.width * k)
  canvas.height = Math.round(img.height * k)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return {
    url: canvas.toDataURL('image/jpeg', 0.82),
    largeur: Math.round(img.width * kRepere),
    hauteur: Math.round(img.height * kRepere),
  }
}

export function useRenduPlan(plan: ApiPlan | null, largeurCible: number) {
  const cle = plan ? `${plan.id}@${largeurCible}` : ''
  // L'état porte la clé du rendu qu'il contient. Sans elle, il faudrait remettre
  // l'état à zéro depuis l'effet au changement de plan, et l'aperçu précédent
  // resterait affiché un instant sous le nom du nouveau plan.
  const [resultat, setResultat] = useState<{ cle: string; rendu?: Rendu; erreur?: boolean } | null>(null)

  useEffect(() => {
    if (!plan) return
    let abandonne = false
    let p = cache.get(cle)
    if (!p) {
      p = rendre(plan, largeurCible)
      cache.set(cle, p)
      // Un rendu raté ne doit pas rester en cache : le plan réessaierait sur la
      // même promesse rejetée et paraîtrait définitivement cassé.
      p.catch(() => cache.delete(cle))
    }
    p.then((r) => { if (!abandonne) setResultat({ cle, rendu: r }) })
     .catch(() => { if (!abandonne) setResultat({ cle, erreur: true }) })
    return () => { abandonne = true }
  }, [plan, largeurCible, cle])

  const courant = resultat?.cle === cle ? resultat : null
  return { rendu: courant?.rendu ?? null, erreur: courant?.erreur ?? false }
}

/** Une page d'un PDF : sa vignette, et sa largeur physique en points. */
export interface ApercuPage {
  numero: number
  url: string
  /** Largeur de la feuille en points PDF (72 pt = 1 pouce), pour comparer les formats. */
  largeurBase: number
}

const cachePages = new Map<string, Promise<ApercuPage[]>>()

async function rendrePages(plan: ApiPlan): Promise<ApercuPage[]> {
  if (plan.mimeType !== 'application/pdf') return []
  const buf = await (await fetch(api.plans.fileUrl(plan))).arrayBuffer()
  const pdfjsLib = await loadPdfjs()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const out: ApercuPage[] = []
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const vue = page.getViewport({ scale: 200 / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = vue.width
    canvas.height = vue.height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vue }).promise
    out.push({ numero: n, url: canvas.toDataURL('image/jpeg', 0.7), largeurBase: base.width })
  }
  return out
}

/**
 * Vignettes de toutes les pages d'un PDF.
 *
 * Elles servent à deux choses : naviguer dans un document de plusieurs feuilles
 * sans avancer page par page à l'aveugle, et choisir à quelles pages s'applique
 * un étalonnage. `largeurBase` est là pour la seconde : deux feuilles de formats
 * différents n'ont pas la même échelle une fois rendues à la même largeur.
 */
export function useApercusPages(plan: ApiPlan | null, actif: boolean) {
  const voulu = !!plan && actif && plan.mimeType === 'application/pdf'
  const cle = voulu ? plan.id : ''
  // L'état porte la clé de ce qu'il contient : sans elle, il faudrait le remettre
  // à zéro depuis l'effet, et les vignettes du plan précédent resteraient un
  // instant sous le nom du nouveau.
  const [resultat, setResultat] = useState<{ cle: string; pages: ApercuPage[] } | null>(null)

  useEffect(() => {
    if (!voulu) return
    let abandonne = false
    let p = cachePages.get(cle)
    if (!p) {
      p = rendrePages(plan)
      cachePages.set(cle, p)
      p.catch(() => cachePages.delete(cle))
    }
    p.then((r) => { if (!abandonne) setResultat({ cle, pages: r }) })
     .catch(() => { if (!abandonne) setResultat({ cle, pages: [] }) })
    return () => { abandonne = true }
  }, [plan, voulu, cle])

  const courant = resultat?.cle === cle ? resultat.pages : null
  return { pages: courant ?? [], chargement: voulu && courant == null }
}
