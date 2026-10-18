import { ArrowLeft, ArrowRight, Check, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarqueIA } from '../ui'

/**
 * La carte de la revue des Métrés (components/metres/RevueMetres.tsx) : un
 * élément proposé par l'IA à la fois, sa mesure, sa confiance, ce que disent
 * les cotes, et les deux gestes qui décident.
 */
export function CarteRevue({ className }: { className?: string }) {
  return (
    <div className={cn('w-[560px] rounded-2xl border border-[#e8e8ed] bg-white/95 p-3 shadow-[0_24px_50px_-18px_rgba(16,36,80,0.45)]', className)}>
      <div className="flex items-center gap-2">
        <MarqueIA className="h-4 w-4" />
        <p className="min-w-0 flex-1 text-[11px] font-medium uppercase tracking-wide text-[#6e6e73]">
          Revue · <span className="tabular-nums text-[#1d1d1f]">1 / 3</span>
          <span className="ml-2 normal-case tracking-normal">0 validé · 0 rejeté</span>
        </p>
        <X className="h-4 w-4 text-[#6e6e73]" />
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] text-[#6e6e73]">Repère · porte intérieure · A-101 · Étage type (1er au 3e)</p>
          <p className="truncate text-[16px] font-semibold">Logement B, porte de la chambre</p>
        </div>
        <p className="shrink-0 text-[18px] font-semibold tabular-nums">1 pce</p>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">Confiance haute</span>
        <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5">IA, repère posé là où l’élément a été vu</span>
      </div>
      <p className="mt-1 text-[12px] italic text-[#6e6e73]">Porte battante, ouverture vers la chambre.</p>
      <div className="mt-3 grid grid-cols-[auto_1fr_1fr_auto] gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#e8e8ed] opacity-40"><ArrowLeft className="h-5 w-5" /></span>
        <span className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-[14px] font-semibold text-red-700"><Trash2 className="h-4 w-4" />Rejeter</span>
        <span className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] text-[14px] font-semibold text-white"><Check className="h-4 w-4" />Valider</span>
        <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#e8e8ed]"><ArrowRight className="h-5 w-5" /></span>
      </div>
      <p className="mt-2 text-center text-[11px] text-[#6e6e73]">Entrée valider · Suppr rejeter · ← → précédent, suivant · Échap quitter</p>
    </div>
  )
}
