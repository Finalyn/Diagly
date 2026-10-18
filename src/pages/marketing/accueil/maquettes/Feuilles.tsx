import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PlanEtage } from './Plan'
import type { Echelle, Feuille, Vue } from './donnees'

/**
 * Les vignettes des feuilles du jeu de plans, et les pastilles qui disent où
 * en est chacune : les mêmes libellés et les mêmes teintes que le navigateur
 * des feuilles de l'outil Métrés (components/metres/NavigateurFeuilles.tsx).
 */

export function Miniature({ vue, className }: { vue: Vue; className?: string }) {
  if (vue === 'plan') return <PlanEtage cotes={false} className={className} />
  if (vue === 'facade') {
    return (
      <svg viewBox="0 0 120 70" className={cn('block h-auto w-full', className)}>
        <g fill="none" stroke="#374151" strokeWidth="0.8">
          <rect x="14" y="14" width="92" height="48" />
          <line x1="10" y1="62" x2="110" y2="62" />
          <line x1="14" y1="18" x2="106" y2="18" />
          {[0, 1, 2, 3].map((r) => [0, 1, 2, 3, 4, 5].map((c) => (
            <rect key={`${r}${c}`} x={20 + c * 14.5} y={22 + r * 10} width="7" height="6" />
          )))}
        </g>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 120 70" className={cn('block h-auto w-full', className)}>
      <g fill="none" stroke="#374151" strokeWidth="0.8">
        <path d="M14 62V18l46-10 46 10v44" />
        {[26, 36, 46, 56].map((y) => <line key={y} x1="14" y1={y} x2="106" y2={y} />)}
        <line x1="10" y1="62" x2="110" y2="62" />
        <path d="M54 62V26M66 62V26" strokeDasharray="2 1.5" />
      </g>
    </svg>
  )
}

const ECHELLES: Record<Echelle, { libelle: string; classe: string }> = {
  verifiee: { libelle: 'Échelle vérifiée', classe: 'bg-emerald-50 text-emerald-700' },
  posee: { libelle: 'Échelle posée', classe: 'bg-sky-50 text-sky-700' },
  a_verifier: { libelle: 'À vérifier', classe: 'bg-amber-50 text-amber-700' },
}

export function Pastille({ classe, children, className }: { classe: string; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none', classe, className)}>{children}</span>
}

export function CarteFeuille({ f, choisie }: { f: Feuille; choisie?: boolean }) {
  return (
    <div className={cn('flex items-start gap-2.5 rounded-xl border bg-white p-2', choisie ? 'border-[#1d1d1f] ring-1 ring-[#1d1d1f]' : 'border-[#e8e8ed]')}>
      <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#e8e8ed] bg-white p-0.5">
        <Miniature vue={f.vue} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium leading-tight text-[#1d1d1f]">{f.numero} · {f.titre}</p>
        <p className="truncate text-[11px] text-[#6e6e73]">{f.detail}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Pastille classe={ECHELLES[f.echelle].classe}>{ECHELLES[f.echelle].libelle}</Pastille>
          <Pastille classe="bg-emerald-50 text-emerald-700">Analysée</Pastille>
          {f.aValider ? <Pastille classe="bg-teal-50 text-teal-700">{f.aValider} à valider</Pastille> : null}
        </div>
      </div>
    </div>
  )
}
