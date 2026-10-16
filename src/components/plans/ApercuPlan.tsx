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
import { Loader2, FileWarning } from 'lucide-react'
import { useRenduPlan } from './rendu'
import { cn } from '@/lib/utils'
import type { ApiPlan } from '@/lib/api-types'

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
  // L'aperçu montre la première page : on n'y pose que ses zones, et pas les
  // propositions de l'IA, qui ne sont pas encore validées.
  const zones = (plan.annotations ?? []).filter((a) => a.type === 'hatch' && a.points.length >= 3 && !a.proposition && (a.page ?? 1) === 1)

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
