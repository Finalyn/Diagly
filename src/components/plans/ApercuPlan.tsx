/**
 * Aperçu d'un plan, vignette comme grande image.
 *
 * La liste des plans ne montrait une image que pour les plans déjà en image : un
 * PDF, c'est-à-dire la quasi-totalité des plans d'architecte, n'avait droit qu'à
 * une icône de document. On choisissait donc son plan au nom du fichier.
 *
 * Ici le PDF est rendu comme dans l'éditeur, sa première page sert d'aperçu, et
 * les zones tracées sont reposées par-dessus : on voit d'un coup d'œil ce qui a
 * déjà été relevé sur quel plan.
 */
import { useEffect, useState } from 'react'
import { Loader2, FileWarning } from 'lucide-react'
import { api } from '@/lib/api'
import { loadPdfjs } from '@/lib/pdf'
import { cn } from '@/lib/utils'
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

function useRenduPlan(plan: ApiPlan | null, largeurCible: number) {
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

/**
 * Aperçu du plan, avec les zones tracées en surimpression.
 *
 * `zonesLiees` reçoit les identifiants des zones rattachées à un ouvrage : elles
 * sont pleines, les autres seulement cerclées. Un plan où rien n'est rattaché se
 * distingue ainsi d'un plan déjà exploité, sans avoir à l'ouvrir.
 */
export function ApercuPlan({ plan, largeurCible = 640, zonesLiees, className }: {
  plan: ApiPlan
  largeurCible?: number
  zonesLiees?: Set<string>
  className?: string
}) {
  const { rendu, erreur } = useRenduPlan(plan, largeurCible)
  const zones = (plan.annotations ?? []).filter((a) => a.type === 'hatch' && a.points.length >= 3)

  if (erreur) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-1.5 bg-muted/40 text-muted-foreground', className)}>
        <FileWarning className="h-6 w-6" />
        <span className="text-xs">Aperçu indisponible</span>
      </div>
    )
  }
  if (!rendu) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/40', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden bg-white', className)}>
      <img src={rendu.url} alt={plan.name} className="h-full w-full object-contain" />
      {zones.length > 0 && (
        <svg
          viewBox={`0 0 ${rendu.largeur} ${rendu.hauteur}`}
          preserveAspectRatio="xMidYMid meet"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          {zones.map((z) => {
            const liee = zonesLiees?.has(z.id) ?? false
            const couleur = z.color ?? '#ef4444'
            return (
              <polygon
                key={z.id}
                points={z.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={couleur}
                fillOpacity={liee ? 0.28 : 0.08}
                stroke={couleur}
                strokeWidth={rendu.largeur / 320}
                strokeDasharray={liee ? undefined : `${rendu.largeur / 120} ${rendu.largeur / 180}`}
              />
            )
          })}
        </svg>
      )}
    </div>
  )
}
