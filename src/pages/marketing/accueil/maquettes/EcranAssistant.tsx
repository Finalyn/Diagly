import { ArrowUp } from 'lucide-react'
import { MarqueIA } from '../ui'

/**
 * Une conversation avec l'assistant (pages/app/AssistantPage.tsx) : une
 * question sur un dossier rattaché, et la carte de question à choix que
 * l'assistant pose quand la demande est ambiguë. Format 520 × 640.
 */
export function EcranAssistant() {
  return (
    <div className="flex h-full w-full flex-col bg-[#fafafb] text-[#1d1d1f]">
      <div className="flex items-center gap-2.5 border-b border-[#ededf1] bg-white px-5 py-3.5">
        <MarqueIA className="h-6 w-6" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Assistant Diagly</p>
          <p className="text-[12px] text-[#6e6e73]">Dossier rattaché : Les Tilleuls</p>
        </div>
      </div>
      <div className="flex-1 space-y-4 px-5 py-5">
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[#0167EA] px-4 py-2.5 text-[14px] leading-snug text-white">
            Prépare un budget de travaux pour la gérance.
          </p>
        </div>
        <p className="max-w-[88%] text-[14px] leading-relaxed">
          Le relevé des Tilleuls compte 42 éléments, dont 3 en priorité I. Avant de chiffrer, une précision :
        </p>
        <div className="w-[92%] rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: 'rgba(1, 103, 234, 0.3)' }}>
          <span className="rounded-full bg-[#0167EA]/10 px-2.5 py-1 text-[11px] font-semibold uppercase leading-none tracking-wider text-[#0167EA]">Horizon</span>
          <p className="mt-2.5 text-[15px] font-semibold leading-snug">Sur quelle période la gérance veut-elle planifier ?</p>
          <div className="mt-3 space-y-2">
            {[
              { l: 'Les cinq prochaines années', d: 'Priorité I seulement, le plus urgent', r: true },
              { l: 'Dix ans', d: 'Priorités I et II, avec les horizons', r: false },
              { l: 'Tout le relevé', d: 'Les trois priorités, au-delà de dix ans compris', r: false },
            ].map((o, i) => (
              <div key={o.l} className={i === 0 ? 'rounded-xl border border-[#0167EA]/40 bg-[#0167EA]/[0.06] px-3.5 py-2.5' : 'rounded-xl border border-[#e8e8ed] bg-white px-3.5 py-2.5'}>
                <p className="text-[14px] font-medium leading-snug">{o.l}{o.r && <span className="ml-1.5 text-[12px] font-normal text-[#0167EA]/80">(recommandé)</span>}</p>
                <p className="mt-0.5 text-[12px] leading-snug text-neutral-500">{o.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex h-11 items-center gap-1 rounded-xl border border-[#e8e8ed] bg-neutral-50 pl-3.5 pr-1 text-[14px] text-neutral-400">
            <span className="flex-1">Autre réponse…</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0167EA] text-white opacity-30"><ArrowUp className="h-4 w-4" /></span>
          </div>
        </div>
      </div>
      <div className="border-t border-[#ededf1] bg-white px-4 py-3">
        <div className="flex h-11 items-center gap-2 rounded-xl border border-[#e8e8ed] px-3 text-[14px] text-neutral-400">
          <span className="flex-1">Posez une question sur vos diagnostics…</span>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1d1d1f] text-white"><ArrowUp className="h-4 w-4" /></span>
        </div>
      </div>
    </div>
  )
}
