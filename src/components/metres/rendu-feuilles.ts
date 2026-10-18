/**
 * Le dessin des feuilles pour la présentation des métrés.
 *
 * Une diapositive de repérage montre une feuille cadrée sur sa zone
 * dessinée : pdf.js ne rend que ce cadre, à une résolution qui tient à
 * l'impression (autour de 200 points par pouce), plutôt que toute la page
 * pour n'en garder qu'un coin. En retrait, le dessin passe en gris clair :
 * les formes de l'élément, posées par-dessus en vecteurs, ressortent.
 *
 * Chaque rendu est fait une fois par feuille, par cadre et par mode, gardé
 * pour la session, et les rendus passent l'un après l'autre : un jeu de
 * vingt feuilles ne doit pas ouvrir vingt canevas à la fois sur un iPad.
 *
 * Un hook et des fonctions, dans leur propre fichier : un module qui exporte
 * aussi des composants casse le rafraîchissement à chaud de Vite.
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { loadPdfjs } from '@/lib/pdf'
import type { ApiPlan } from '@/lib/api-types'
import type { Boite } from '@/lib/plans/formes'

/** Largeur du repère des annotations, celle du rendu de l'éditeur (PlanEditor, rendu.ts). */
const LARGEUR_REPERE = 1600
/** Le rendu d'un cadre tient dans ces dimensions : la place du plan, un peu plus de deux fois. */
const LARGEUR_RENDU = 1900
const HAUTEUR_RENDU = 1200
/** Au-delà, un petit cadre serait agrandi pour rien. */
const AGRANDISSEMENT_MAX = 4
/** Le dessin en retrait garde ce qu'il faut de ses traits pour situer les formes. */
const ENCRE_EN_RETRAIT = 0.36

export interface DemandeRendu {
  cle: string
  plan: ApiPlan
  page: number
  cadre: Boite
  attenue: boolean
}

/** La clé d'un rendu : la feuille, son cadre au pixel près, le mode. */
export function cleDuRendu(planId: string, page: number, cadre: Boite, attenue: boolean): string {
  const c = [cadre.x, cadre.y, cadre.largeur, cadre.hauteur].map((v) => Math.round(v)).join(',')
  return `${planId}#${page}@${c}@${attenue ? 'a' : 'c'}`
}

type DocumentPdf = Awaited<ReturnType<Awaited<ReturnType<typeof loadPdfjs>>['getDocument']>['promise']>

const documents = new Map<string, Promise<DocumentPdf>>()
const rendus = new Map<string, Promise<string>>()
/** Les rendus passent un par un. */
let file: Promise<unknown> = Promise.resolve()

function documentDe(plan: ApiPlan): Promise<DocumentPdf> {
  let d = documents.get(plan.id)
  if (!d) {
    d = (async () => {
      const buf = await (await fetch(api.plans.fileUrl(plan))).arrayBuffer()
      const pdfjs = await loadPdfjs()
      return pdfjs.getDocument({ data: buf }).promise
    })()
    documents.set(plan.id, d)
    d.catch(() => documents.delete(plan.id))
  }
  return d
}

function chargerImage(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, ko) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => ok(img)
    img.onerror = () => ko(new Error('image illisible'))
    img.src = url
  })
}

/** Le dessin en gris clair : chaque pixel garde une part de son encre. */
function mettreEnRetrait(ctx: CanvasRenderingContext2D, largeur: number, hauteur: number) {
  const image = ctx.getImageData(0, 0, largeur, hauteur)
  const p = image.data
  for (let i = 0; i < p.length; i += 4) {
    const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]
    const v = 255 - (255 - l) * ENCRE_EN_RETRAIT
    p[i] = v; p[i + 1] = v; p[i + 2] = v
  }
  ctx.putImageData(image, 0, 0)
}

async function rendre(d: DemandeRendu): Promise<string> {
  const { cadre } = d
  // Pixels du rendu par unité du repère.
  const k = Math.min(LARGEUR_RENDU / cadre.largeur, HAUTEUR_RENDU / cadre.hauteur, AGRANDISSEMENT_MAX)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(cadre.largeur * k))
  canvas.height = Math.max(1, Math.round(cadre.hauteur * k))
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (d.plan.mimeType === 'application/pdf') {
    const pdf = await documentDe(d.plan)
    // Une page disparue du document retombe sur la première, comme dans l'aperçu des plans.
    const page = await pdf.getPage(Math.min(Math.max(1, d.page), pdf.numPages))
    const base = page.getViewport({ scale: 1 })
    // Le repère fait 1600 unités de large ; le cadre y est posé, le décalage le ramène à l'origine du canevas.
    const vue = page.getViewport({ scale: (LARGEUR_REPERE / base.width) * k, offsetX: -cadre.x * k, offsetY: -cadre.y * k })
    await page.render({ canvasContext: ctx, viewport: vue }).promise
  } else {
    const img = await chargerImage(api.plans.fileUrl(d.plan))
    // Même repère que l'éditeur : une petite image n'y est jamais agrandie.
    const kRepere = Math.min(1, LARGEUR_REPERE / img.width)
    ctx.drawImage(img, -cadre.x * k, -cadre.y * k, img.width * kRepere * k, img.height * kRepere * k)
  }

  if (d.attenue) mettreEnRetrait(ctx, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.86))
  if (!blob) throw new Error('rendu impossible')
  return URL.createObjectURL(blob)
}

function rendu(d: DemandeRendu): Promise<string> {
  let r = rendus.get(d.cle)
  if (!r) {
    r = file.then(() => rendre(d))
    file = r.catch(() => undefined)
    rendus.set(d.cle, r)
    // Un rendu raté ne reste pas en cache : la feuille réessaiera.
    r.catch(() => rendus.delete(d.cle))
  }
  return r
}

/**
 * Les rendus de ces feuilles, à mesure qu'ils arrivent. `pret` dit que tout
 * est là, rendu ou en erreur : c'est ce que l'export attend pour imprimer.
 */
export function useRendusFeuilles(demandes: DemandeRendu[]): { urls: Record<string, string>; erreurs: Record<string, true>; pret: boolean } {
  // Les demandes changent d'objet à chaque rendu ; seules leurs clés comptent.
  const cles = demandes.map((d) => d.cle).join('|')
  const [etat, setEtat] = useState<{ urls: Record<string, string>; erreurs: Record<string, true> }>({ urls: {}, erreurs: {} })

  useEffect(() => {
    let abandonne = false
    for (const d of demandes) {
      rendu(d)
        .then((url) => { if (!abandonne) setEtat((e) => (e.urls[d.cle] === url ? e : { ...e, urls: { ...e.urls, [d.cle]: url } })) })
        .catch(() => { if (!abandonne) setEtat((e) => ({ ...e, erreurs: { ...e.erreurs, [d.cle]: true } })) })
    }
    return () => { abandonne = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- les clés disent tout ce qui change ; l'URL signée du plan change sans que le fichier change
  }, [cles])

  const pret = useMemo(() => demandes.every((d) => etat.urls[d.cle] || etat.erreurs[d.cle]),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- idem
    [cles, etat])
  return { urls: etat.urls, erreurs: etat.erreurs, pret }
}
