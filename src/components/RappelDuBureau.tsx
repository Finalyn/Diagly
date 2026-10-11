/**
 * Ce qui manque au bureau pour que ses rapports disent qui les écrit.
 *
 * Les réglages portent déjà la mention « 3 champs à remplir », mais on n'ouvre
 * pas les réglages sans raison : le manque doit se voir là où il compte, devant
 * le document qui va partir chez le client, et sur l'accueil qu'on traverse
 * chaque matin. Le rappel donne le chemin plutôt que le reproche : il ouvre la
 * section exacte à remplir.
 *
 * Rien ne s'affiche quand tout est en place : un bandeau qui reste pour
 * toujours cesse d'être lu.
 */
import type { ComponentType } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, ImagePlus } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { champsManquantsDuBureau } from '@/lib/reglages'
import { cn } from '@/lib/utils'

export function RappelDuBureau({ className }: { className?: string }) {
  const bureau = useAuth((s) => s.user?.preferences?.company)
  const manquants = champsManquantsDuBureau(bureau)

  // L'identité d'abord : sans elle, le rapport est anonyme. Le logo ensuite :
  // il manque souvent et ne rend pas le document faux.
  if (manquants.length > 0) {
    return (
      <Rappel
        className={className}
        grave
        icone={AlertTriangle}
        titre="Vos rapports ne disent pas encore qui les a écrits"
        phrase={`À remplir dans votre entreprise : ${manquants.join(', ')}.`}
        vers="/app/settings?s=bureau"
        action="Compléter mon entreprise"
      />
    )
  }
  if (!bureau?.logo) {
    return (
      <Rappel
        className={className}
        icone={ImagePlus}
        titre="Vos rapports portent le logo de Diagly"
        phrase="Le vôtre paraîtrait en haut de chaque page, au-dessus de votre raison sociale."
        vers="/app/settings?s=personnalisation"
        action="Ajouter mon logo"
      />
    )
  }
  return null
}

function Rappel({ icone: Icone, titre, phrase, vers, action, grave, className }: {
  icone: ComponentType<{ className?: string }>
  titre: string
  phrase: string
  vers: string
  action: string
  grave?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3 print:hidden',
        grave ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50',
        className,
      )}
    >
      <Icone className={cn('h-4 w-4 shrink-0', grave ? 'text-amber-600' : 'text-blue-600')} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium leading-tight', grave ? 'text-amber-900' : 'text-blue-900')}>{titre}</p>
        <p className={cn('mt-0.5 text-xs leading-snug', grave ? 'text-amber-800' : 'text-blue-800')}>{phrase}</p>
      </div>
      <Link
        to={vers}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/70',
          grave ? 'border-amber-200 text-amber-900' : 'border-blue-100 text-blue-800',
        )}
      >
        {action}<ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
