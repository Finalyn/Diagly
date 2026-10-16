/**
 * L'analyse d'un plan par l'IA, côté navigateur.
 *
 * Le navigateur a le plan sous la main et pdf.js chargé : c'est lui qui rend
 * chaque page en image, à la plus grande résolution que le modèle lit sans la
 * réduire, et qui extrait la géométrie vectorielle pour l'aimantation. Il
 * envoie les images, suit l'analyse jusqu'à ce qu'elle soit prête, puis
 * transforme la réponse en zones à valider dans le repère de l'éditeur.
 *
 * Dans son propre fichier parce que c'est un hook et non un composant : un
 * module qui exporte les deux casse le rafraîchissement à chaud de Vite.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { loadPdfjs } from '@/lib/pdf'
import type { ApiDiagnosticItem, ApiPlan, PageAnalysee, ZoneEcartee } from '@/lib/api-types'
import { dimensionsPourLeModele, propositionsDeLAnalyse, type PageRendue, type Propositions } from '@/lib/plans/analyse-ia'
import { IndexGeometrie, extraireSegments, type OpsPdf } from '@/lib/plans/geometrie-vectorielle'

/** Largeur du canevas de l'éditeur : le repère des annotations. */
export const LARGEUR_CANEVAS = 1600
/** Au-delà, une analyse coûte cher et dure trop : on analyse par lots. */
export const MAX_PAGES_ANALYSE = 8
/** Une image plus lourde part en JPEG : l'API n'en accepte pas plus de 5 Mo une fois encodée. */
const MAX_PNG = 3.6 * 1024 * 1024

export type EtatAnalyse =
  | { etape: 'repos' }
  | { etape: 'preparation'; fait: number; total: number }
  | { etape: 'analyse'; debut: number; pages: number }
  | { etape: 'erreur'; message: string }
  | { etape: 'non-configuree' }

export interface ResultatAnalyse extends Propositions {
  pages: PageAnalysee[]
  ecartees: ZoneEcartee[]
  remarques: string | null
  /** La réponse a été coupée : il peut manquer des zones. */
  tronque: boolean
  /** Pages sans géométrie vectorielle exploitable : leurs zones ne sont pas aimantées. */
  pagesSansGeometrie: number[]
}

function enBlob(canvas: HTMLCanvasElement, type: string, qualite?: number): Promise<Blob> {
  return new Promise((ok, ko) => canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Rendu de la page impossible.'))), type, qualite))
}

/** PNG pour garder les traits nets ; JPEG seulement si le PNG est trop lourd (un scan, une photo). */
async function imageDuCanevas(canvas: HTMLCanvasElement): Promise<Blob> {
  const png = await enBlob(canvas, 'image/png')
  if (png.size <= MAX_PNG) return png
  return enBlob(canvas, 'image/jpeg', 0.9)
}

interface PageAEnvoyer { rendue: PageRendue; image: Blob }

async function preparerPdf(plan: ApiPlan, numeros: number[], progres: (fait: number) => void): Promise<PageAEnvoyer[]> {
  const buf = await (await fetch(api.plans.fileUrl(plan))).arrayBuffer()
  const pdfjsLib = await loadPdfjs()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const sortie: PageAEnvoyer[] = []
  for (const [i, numero] of numeros.entries()) {
    const page = await pdf.getPage(numero)
    const base = page.getViewport({ scale: 1 })
    // Un PDF peut déclarer une unité plus grande que le point (UserUnit) : la
    // taille physique de la feuille en tient compte, l'échelle exacte aussi.
    const unite = (page as unknown as { userUnit?: number }).userUnit ?? 1
    const vueCanevas = page.getViewport({ scale: LARGEUR_CANEVAS / base.width })
    const taille = dimensionsPourLeModele(base.width, base.height, true)
    const vueImage = page.getViewport({ scale: taille.largeur / base.width })

    const canvas = document.createElement('canvas')
    canvas.width = taille.largeur
    canvas.height = taille.hauteur
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vueImage }).promise
    const image = await imageDuCanevas(canvas)

    // La géométrie, dans le repère du canevas de l'éditeur. Un PDF scanné n'a
    // pas de traits, un PDF trop chargé peut faire échouer la lecture : on se
    // passe alors d'aimantation, sans renoncer à l'analyse.
    let index: IndexGeometrie | null = null
    try {
      const liste = await page.getOperatorList()
      const geo = extraireSegments(liste, pdfjsLib.OPS as unknown as OpsPdf, vueCanevas.transform)
      if (geo.nombre > 0) index = new IndexGeometrie(geo)
    } catch {
      index = null
    }

    sortie.push({
      image,
      rendue: {
        numero,
        largeurImage: taille.largeur,
        hauteurImage: taille.hauteur,
        largeurCanevas: vueCanevas.width,
        hauteurCanevas: vueCanevas.height,
        largeurPagePt: base.width * unite,
        hauteurPagePt: base.height * unite,
        index,
      },
    })
    progres(i + 1)
  }
  return sortie
}

async function preparerImage(plan: ApiPlan): Promise<PageAEnvoyer[]> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((ok, ko) => {
    img.onload = () => ok()
    img.onerror = () => ko(new Error('Image du plan illisible.'))
    img.src = api.plans.fileUrl(plan)
  })
  // Même règle que l'éditeur : le canevas ne grandit jamais une petite image.
  const s = Math.min(1, LARGEUR_CANEVAS / img.width)
  const largeurCanevas = Math.round(img.width * s)
  const hauteurCanevas = Math.round(img.height * s)
  const taille = dimensionsPourLeModele(img.width, img.height, false)
  const canvas = document.createElement('canvas')
  canvas.width = taille.largeur
  canvas.height = taille.hauteur
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, taille.largeur, taille.hauteur)
  return [{
    image: await imageDuCanevas(canvas),
    rendue: {
      numero: 1,
      largeurImage: taille.largeur,
      hauteurImage: taille.hauteur,
      largeurCanevas,
      hauteurCanevas,
      largeurPagePt: null,
      hauteurPagePt: null,
      index: null,
    },
  }]
}

/**
 * Lance et suit l'analyse. `lancer` rend les propositions une fois prêtes,
 * ou null si l'analyse n'a rien donné (l'état dit alors pourquoi).
 */
export function useAnalyseIA(plan: ApiPlan, ouvrages: ApiDiagnosticItem[]) {
  const [etat, setEtat] = useState<EtatAnalyse>({ etape: 'repos' })
  const abandon = useRef<AbortController | null>(null)
  // Fermer l'éditeur arrête l'analyse, côté serveur compris : personne n'en lira le résultat.
  useEffect(() => () => abandon.current?.abort(), [])

  const lancer = useCallback(async (numeros: number[], identifiant: () => string): Promise<ResultatAnalyse | null> => {
    abandon.current?.abort()
    const controle = new AbortController()
    abandon.current = controle
    const estPdf = plan.mimeType === 'application/pdf'
    try {
      setEtat({ etape: 'preparation', fait: 0, total: numeros.length })
      const pages = estPdf
        ? await preparerPdf(plan, numeros, (fait) => setEtat({ etape: 'preparation', fait, total: numeros.length }))
        : await preparerImage(plan)
      if (controle.signal.aborted) return null

      setEtat({ etape: 'analyse', debut: Date.now(), pages: pages.length })
      const r = await api.plans.analyser(plan.id, {
        pages: pages.map((p) => ({ image: p.image, numero: p.rendue.numero, largeurPt: p.rendue.largeurPagePt, hauteurPt: p.rendue.hauteurPagePt })),
        ouvrages: ouvrages.map((o) => ({ id: o.id, cfcCode: o.cfcCode ?? null, libelle: o.cfcLabel, unite: o.unit ?? null })),
      }, controle.signal)
      if (controle.signal.aborted) return null

      if (!r.configured) { setEtat({ etape: 'non-configuree' }); return null }
      if (r.refus) { setEtat({ etape: 'erreur', message: 'L’IA a décliné l’analyse de ce plan.' }); return null }
      if (!r.analyse) {
        setEtat({ etape: 'erreur', message: 'La réponse de l’IA était illisible. Relancez l’analyse.' })
        return null
      }
      const propositions = propositionsDeLAnalyse(r.analyse, pages.map((p) => p.rendue), { estPdf, identifiant })
      setEtat({ etape: 'repos' })
      return {
        ...propositions,
        pages: r.analyse.pages,
        ecartees: r.analyse.ecartees,
        remarques: r.analyse.remarques,
        tronque: !!r.tronque,
        pagesSansGeometrie: estPdf ? pages.filter((p) => !p.rendue.index).map((p) => p.rendue.numero) : [],
      }
    } catch (e) {
      if (controle.signal.aborted || (e as Error)?.name === 'AbortError') { setEtat({ etape: 'repos' }); return null }
      setEtat({ etape: 'erreur', message: (e as Error)?.message || 'L’analyse a échoué.' })
      return null
    } finally {
      if (abandon.current === controle) abandon.current = null
    }
  }, [plan, ouvrages])

  const arreter = useCallback(() => {
    abandon.current?.abort()
    abandon.current = null
    setEtat({ etape: 'repos' })
  }, [])

  const oublierErreur = useCallback(() => setEtat({ etape: 'repos' }), [])

  return { etat, lancer, arreter, oublierErreur }
}
