import { ArrowLeft, ArrowRight, Camera, Check, Images, Minus, PanelLeft, Plus, Trash2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarqueIA } from '../ui'
import { PhotoPorte } from './Illustrations'

/**
 * La fiche d'un ouvrage dans l'éditeur de relevé, sur iPad : photo, Guide
 * IA, état et répartition des éléments comptés. Libellés repris de
 * pages/app/DiagnosticDetail.tsx et components/comptages/. Le parcours par
 * étapes et le compteur sur iPhone sont dans EcranTerrain.tsx.
 */

const ETATS = [
  { nom: 'Très bon', point: 'bg-green-500', constat: 'Comme neuve, sans usure visible.', travaux: 'Néant.' },
  { nom: 'Bon', point: 'bg-green-400', constat: 'Usure légère, fermeture correcte.', travaux: 'Entretien courant.' },
  { nom: 'Moyen', point: 'bg-orange-400', constat: 'Vernis usé en partie basse, réglages à reprendre.', travaux: 'Ponçage et vernis, réglage de la quincaillerie.' },
  { nom: 'Mauvais', point: 'bg-red-500', constat: 'Vantail déformé, fermeture défaillante.', travaux: 'Remplacement de la porte palière.' },
]

export function Etape({ n, titre }: { n: number; titre: string }) {
  return (
    <p className="flex items-center gap-2 text-[15px] font-semibold">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0167EA] text-[12px] font-bold text-white">{n}</span>
      {titre}
    </p>
  )
}

/** Le compteur « Portes palières en bois [−] 2 [+] / 6 ». */
export function Repartition({ grand }: { grand?: boolean }) {
  return (
    <div className={cn('space-y-2.5 rounded-xl border border-[#e8e8ed] bg-[#f8f8fa]', grand ? 'p-4' : 'p-3')}>
      <p className={cn('font-medium', grand ? 'text-[14px]' : 'text-[12px]')}>
        Portes palières<span className="font-normal text-[#6e6e73]"> · six comptées sur les plans</span>
      </p>
      <div className="flex items-center gap-2">
        <p className={cn('min-w-0 flex-1 font-medium leading-snug', grand ? 'text-[16px]' : 'text-[14px]')}>Portes palières en bois</p>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e8e8ed] bg-white"><Minus className="h-5 w-5" /></span>
        <span className="w-10 text-center text-[20px] font-semibold tabular-nums">2</span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e8e8ed] bg-white"><Plus className="h-5 w-5" /></span>
        <span className="w-10 text-[14px] tabular-nums text-[#6e6e73]">/ 6</span>
      </div>
      <p className="text-[12px] text-[#6e6e73]">Réparties : 2 en bois, 4 en métal</p>
      <div className="flex justify-between border-t border-black/[0.06] pt-2 text-[11px] text-[#6e6e73]">
        <span>Portes palières en métal</span><span className="tabular-nums">4/6</span>
      </div>
    </div>
  )
}

/** La fiche d'un ouvrage sur iPad (820 × 1180). */
export function EcranFiche() {
  return (
    <div className="flex h-full w-full flex-col bg-white text-[#1d1d1f]">
      <div className="h-[24px] shrink-0" />
      <header className="flex h-[56px] shrink-0 items-center gap-3 border-b border-[#ededf1] px-5">
        <PanelLeft className="h-5 w-5 text-[#6e6e73]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">Les Tilleuls</p>
          <p className="truncate text-[12px] text-[#6e6e73]">Relevé · Cage d’escalier, 5 sur 8</p>
        </div>
        <span className="rounded-full bg-[#eef5ff] px-2.5 py-1 text-[12px] font-medium text-[#0167EA]">18 / 42 relevés</span>
      </header>
      <div className="flex shrink-0 items-center justify-center gap-2 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-800">
        <WifiOff className="h-3.5 w-3.5" />Hors-ligne : 3 saisies gardées sur l’appareil, envoi au retour du réseau
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-7 pt-5">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-[14px] font-medium text-[#6e6e73]"><ArrowLeft className="h-5 w-5" />Retour</span>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[15px] font-semibold">Portes palières en bois</p>
            <p className="text-[12px] text-[#6e6e73]">273 Menuiserie</p>
          </div>
          <Trash2 className="h-5 w-5 text-red-600" />
        </div>

        <div className="mt-5 space-y-6">
          <section className="space-y-3">
            <Etape n={1} titre="Prendre une photo" />
            <div className="flex gap-2.5">
              <span className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#d1d1d6] text-[14px] font-medium"><Camera className="h-5 w-5" />Prendre une photo</span>
              <span className="flex h-[52px] items-center justify-center gap-2 rounded-xl border border-[#e8e8ed] px-4 text-[14px] font-medium"><Images className="h-5 w-5" />Galerie</span>
            </div>
            <div className="flex gap-2">
              <div className="h-[88px] w-[88px] overflow-hidden rounded-lg border border-[#e8e8ed]"><PhotoPorte id="fiche-1" /></div>
              <div className="h-[88px] w-[88px] overflow-hidden rounded-lg border border-[#e8e8ed]"><PhotoPorte id="fiche-2" className="scale-[1.6]" /></div>
            </div>
          </section>

          {/* Le Guide IA : il propose, l'état ne change qu'à « Appliquer ». */}
          <section className="rounded-2xl border border-[#cfe0fb] bg-[#f4f8ff] p-4">
            <p className="flex items-center gap-2 text-[14px] font-semibold"><MarqueIA className="h-4 w-4" />Guide IA</p>
            <p className="mt-2 text-[13px] leading-snug"><span className="font-semibold">Je vois : </span>une porte palière en bois à panneaux, vernis usé en partie basse, quincaillerie en place.</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-emerald-700"><Check className="h-3.5 w-3.5" />Cohérent avec le CFC 273</p>
            <div className="mt-3 flex items-center gap-2">
              <p className="flex-1 text-[13px]"><span className="font-semibold">État suggéré : </span>Moyen</p>
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-bold text-white">P II</span>
              <span className="rounded-lg bg-[#0167EA] px-3 py-1.5 text-[12px] font-semibold text-white">Appliquer</span>
            </div>
          </section>

          <section className="space-y-3">
            <Etape n={2} titre="Évaluer l’état" />
            <div className="grid grid-cols-2 gap-2">
              {ETATS.map((e) => {
                const choisi = e.nom === 'Moyen'
                return (
                  <div key={e.nom} className={cn('rounded-xl border-2 p-3', choisi ? 'border-transparent bg-orange-400 text-white' : 'border-[#f0f0f3] bg-white')}>
                    <p className="flex items-center gap-2 text-[14px] font-semibold">
                      <span className={cn('h-2.5 w-2.5 rounded-full', choisi ? 'bg-white' : e.point)} />{e.nom}
                    </p>
                    <p className={cn('mt-1 text-[12px] leading-snug', choisi ? 'text-white/90' : 'text-[#6e6e73]')}>{e.constat}</p>
                    <p className={cn('mt-1 text-[12px] leading-snug', choisi ? 'text-white/90' : 'text-[#1d1d1f]/75')}>
                      <span className={cn('font-medium', choisi ? 'text-white' : 'text-[#1d1d1f]')}>Travaux : </span>{e.travaux}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="space-y-3">
            <Etape n={4} titre="Combien de ce type ?" />
            <Repartition />
          </section>
        </div>

        <div className="mt-auto pb-6 pt-4">
          <div className="flex items-start justify-between rounded-xl border border-[#e8e8ed] bg-[#fafafb] p-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#6e6e73]">Priorité · coût (auto)</p>
              <span className="mt-1 inline-flex rounded-full bg-orange-500 px-2 py-0.5 text-[12px] font-bold text-white">PII</span>
            </div>
            <p className="text-[19px] font-bold tabular-nums">1 860 CHF</p>
          </div>
          <span className="mt-3 flex h-[52px] items-center justify-center gap-2 rounded-xl bg-[#0167EA] text-[16px] font-semibold text-white">
            Suivant <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </div>
    </div>
  )
}
