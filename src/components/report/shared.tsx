/**
 * Briques communes aux rapports.
 *
 * Ces éléments étaient définis dans ProjectRapports et servaient à ses quatre
 * variantes. Le rapport complet les réutilise tels quels : un en-tête de marque
 * ou une case d'état qui diverge d'un rapport à l'autre se remarque tout de suite
 * quand les deux documents partent chez le même client.
 */
import { stateColors, stateLabels } from '@/data/mock'
import { cn } from '@/lib/utils'
import type { ElementState } from '@/lib/api-types'
import { useAuth } from '@/stores/auth'

/** En-tête de marque du rapport : logo + identité de l'entreprise (Paramètres → Entreprise). */
export function ReportBrand({ canton }: { canton: string }) {
  const company = useAuth((s) => s.user?.preferences?.company)
  const name = company?.name?.trim()
  const line2 = [company?.postalCode, company?.city].filter(Boolean).join(' ')
  return (
    <div className="text-right text-sm shrink-0">
      {company?.logo && <img src={company.logo} alt="" className="h-12 ml-auto mb-1 object-contain" />}
      <p className="font-semibold">{name || 'Diagly'}</p>
      {company?.address && <p className="text-muted-foreground">{company.address}</p>}
      <p className="text-muted-foreground">{line2 || `${canton} · Suisse`}</p>
      {company?.vatNumber && <p className="text-muted-foreground text-xs">{company.vatNumber}</p>}
    </div>
  )
}

/** Case à cocher du modèle papier : l'état constaté est coché et coloré. */
export function CaseEtat({ etat, actif }: { etat: ElementState; actif: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap', actif ? 'font-semibold' : 'text-muted-foreground')}>
      <span className={cn('inline-flex h-3 w-3 items-center justify-center border text-[9px] leading-none',
        actif ? `${stateColors[etat]} border-transparent text-white` : 'border-current')}
      >{actif ? '×' : ''}</span>
      {stateLabels[etat]}
    </span>
  )
}

/** Paragraphe du modèle : intitulé souligné, puis le texte à la suite. */
export function Ligne({ titre, texte }: { titre: string; texte: string }) {
  return (
    <p className="mt-1 text-sm">
      <span className="underline">{titre}</span> : <span className="text-muted-foreground">{texte}</span>
    </p>
  )
}

export function Info({ l, v }: { l: string; v: string }) {
  return <p><span className="text-muted-foreground">{l} :</span> {v}</p>
}

export function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className={strong ? 'font-semibold' : ''}>{v}</span></div>
}
