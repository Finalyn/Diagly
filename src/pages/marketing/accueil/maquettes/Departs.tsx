import type { ReactNode } from 'react'
import { Check, FileText, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Apparition } from '../ui'
import { typo } from '../typo'
import { PlanEtage } from './Plan'

/**
 * Les quatre façons d'ouvrir un dossier, présentées comme quatre outils :
 * une grande carte chacun, son visuel en haut (la pile de plans, l'adresse
 * et ses valeurs publiques, le document lu, l'étiquette énergétique), puis
 * son nom et ce qu'il fait, en une phrase.
 *
 * Les visuels sont dessinés en code, sans donnée de client : l'étage type
 * des plans d'essai, une adresse d'exemple, une étiquette sans bâtiment.
 */

const OUTILS: { titre: string; texte: string; recommande?: boolean; visuel: ReactNode; description: string }[] = [
  {
    titre: 'Vos plans',
    texte: 'Un PDF ou la photo d’un plan papier : l’IA en tire les métrés, qui deviennent les quantités du dossier.',
    recommande: true,
    visuel: <VisuelPlans />,
    description: 'Une pile de plans, le premier lu par l’IA : l’étage type aux pièces colorées, l’échelle 1:100 vérifiée.',
  },
  {
    titre: 'Une adresse',
    texte: 'Le registre des bâtiments et le cadastre remplissent l’année, les niveaux et l’emprise, en estimations à vérifier.',
    visuel: <VisuelAdresse />,
    description: 'Une adresse à Lausanne et ce que donnent les registres publics : année de construction, niveaux, emprise et logements.',
  },
  {
    titre: 'Un document',
    texte: 'Un PDF, un Word, un Excel ou un CSV : l’assistant en lit les données et vous les montre avant de créer le dossier.',
    visuel: <VisuelDocument />,
    description: 'Un document lu par l’assistant, avec les informations qu’il en a tirées.',
  },
  {
    titre: 'Un certificat CECB®',
    texte: 'Le certificat en PDF pré-remplit le bâtiment et son étiquette énergétique, que vous relisez avant de continuer.',
    visuel: <VisuelCECB />,
    description: 'Une étiquette énergétique de A à G.',
  },
]

export function Departs() {
  return (
    <ul className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-2">
      {OUTILS.map((o, i) => (
        <Apparition as="li" key={o.titre} delai={(i % 2) * 90} className="group flex flex-col overflow-hidden rounded-[28px] border border-black/[0.06] bg-[#f4f5f7]">
          <figure role="img" aria-label={o.description} className="relative m-0 h-[240px] overflow-hidden bg-gradient-to-b from-white via-[#f6f9fd] to-[#e7effc] sm:h-[270px]">
            <div aria-hidden="true" className="absolute inset-0">{o.visuel}</div>
          </figure>
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[clamp(1.35rem,2.2vw,1.65rem)] font-medium tracking-[-0.03em] text-[#0b1220]">{typo(o.titre)}</h3>
              {o.recommande && <span className="rounded-full bg-[#0167EA] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">Recommandé</span>}
            </div>
            <p className="mt-2 max-w-[30rem] text-pretty text-[15px] leading-[1.6] text-[#6b7280]">{typo(o.texte)}</p>
          </div>
        </Apparition>
      ))}
    </ul>
  )
}

/** Trois feuilles empilées ; celle du dessus porte l'étage type, lu par l'IA. */
function VisuelPlans() {
  return (
    <>
      <div className="absolute left-1/2 top-10 h-[200px] w-[74%] -translate-x-1/2 rotate-[-7deg] rounded-xl bg-white/70 ring-1 ring-black/[0.05]" />
      <div className="absolute left-1/2 top-9 h-[200px] w-[74%] -translate-x-1/2 rotate-[4deg] rounded-xl bg-white/85 ring-1 ring-black/[0.05]" />
      <div className="absolute left-1/2 top-7 w-[74%] -translate-x-1/2 rotate-[-1deg] rounded-xl bg-white p-3 shadow-[0_24px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.06] transition-transform duration-500 group-hover:-translate-y-1.5 group-hover:rotate-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#111827]">102 · Étage type</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f7ee] px-2 py-0.5 text-[10px] font-medium text-[#15803d]">
            <Check className="h-2.5 w-2.5" strokeWidth={3} />Échelle 1:100
          </span>
        </div>
        <PlanEtage pieces fenetres portes cotes={false} />
      </div>
    </>
  )
}

/** L'adresse cherchée, posée sur un fond de plan de ville, et ce qu'en disent les registres. */
function VisuelAdresse() {
  return (
    <>
      {/* Un fond de rues, très léger. */}
      <svg className="absolute inset-0 h-full w-full text-[#0167EA]/[0.10]" viewBox="0 0 400 270" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round">
          <path d="M-20 80 C 90 60, 160 120, 420 90" />
          <path d="M60 -20 L 120 290" />
          <path d="M260 -20 C 240 90, 300 180, 280 290" />
          <path d="M-20 210 L 420 230" />
        </g>
      </svg>
      <span className="absolute left-[22%] top-[22%] flex h-9 w-9 items-center justify-center rounded-full bg-[#0167EA] text-white shadow-[0_10px_24px_-6px_rgba(1,103,234,0.7)] ring-4 ring-white">
        <MapPin className="h-4 w-4" />
      </span>
      <div className="absolute bottom-5 right-5 w-[70%] rounded-2xl bg-white p-4 shadow-[0_24px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.06] transition-transform duration-500 group-hover:-translate-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">Valeurs publiques</p>
        <p className="mt-0.5 text-[13px] font-semibold text-[#111827]">Rue des Alpes 12, 1003 Lausanne</p>
        <dl className="mt-3 grid grid-cols-2 gap-1.5">
          {[['Construction', '1968'], ['Niveaux', '5'], ['Emprise', '220 m²'], ['Logements', '10']].map(([a, b]) => (
            <div key={a} className="rounded-lg bg-[#f4f6fa] px-2.5 py-1.5">
              <dt className="text-[10px] text-[#6e6e73]">{a}</dt>
              <dd className="text-[13px] font-semibold tabular-nums text-[#111827]">{b}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}

/** Un document à gauche, et à droite ce que l'assistant en a tiré. */
function VisuelDocument() {
  const lignes = ['w-[85%]', 'w-[70%]', 'w-[92%]', 'w-[60%]', 'w-[80%]', 'w-[50%]']
  return (
    <>
      <div className="absolute left-[10%] top-8 w-[42%] rotate-[-4deg] rounded-xl bg-white p-4 shadow-[0_24px_40px_-20px_rgba(15,23,42,0.3)] ring-1 ring-black/[0.06]">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[#fee2e2] text-[#dc2626]"><FileText className="h-4 w-4" /></span>
        <div className="mt-3 space-y-2">
          {lignes.map((w, i) => <span key={i} className={cn('block h-1.5 rounded-full bg-[#e5e7eb]', w)} />)}
        </div>
        <div className="mt-3 flex gap-1">
          {['PDF', 'Word', 'Excel', 'CSV'].map((f) => <span key={f} className="rounded bg-[#f4f6fa] px-1.5 py-0.5 text-[9px] font-semibold text-[#4b5563]">{f}</span>)}
        </div>
      </div>
      <div className="absolute right-[7%] top-[26%] w-[48%] rounded-2xl bg-white p-4 shadow-[0_24px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.06] transition-transform duration-500 group-hover:-translate-y-1.5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0b1220]">
          <img src="/diagly-mark.svg" alt="" className="h-3.5 w-3.5" />Lu par l’assistant
        </p>
        <ul className="mt-2.5 space-y-1.5">
          {['Adresse et bâtiment', 'Année de construction', 'Ouvrages et états'].map((l) => (
            <li key={l} className="flex items-center gap-2 text-[12px] text-[#111827]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#0167EA] text-white"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>{l}
            </li>
          ))}
        </ul>
        <span className="mt-3 block rounded-lg bg-[#0167EA] py-1.5 text-center text-[11px] font-semibold text-white">Relire et créer</span>
      </div>
    </>
  )
}

/** Une étiquette énergétique de A à G, la lettre du bâtiment repérée. */
function VisuelCECB() {
  const classes = [
    ['A', '#009a44', 34], ['B', '#4fb848', 42], ['C', '#bed62f', 50], ['D', '#ffe500', 58],
    ['E', '#fbb900', 66], ['F', '#f07d1e', 74], ['G', '#e3221e', 82],
  ] as const
  return (
    <div className="absolute left-1/2 top-6 w-[72%] -translate-x-1/2 rounded-2xl bg-white p-4 shadow-[0_24px_40px_-20px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.06] transition-transform duration-500 group-hover:-translate-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">Étiquette énergétique</p>
      <ul className="mt-2.5 space-y-1">
        {classes.map(([l, c, w]) => (
          <li key={l} className="flex items-center gap-2">
            <span className={cn('flex h-[18px] items-center rounded-r-md pl-2 text-[11px] font-bold', 'CDE'.includes(l) ? 'text-[#111827]' : 'text-white')} style={{ width: `${w}%`, backgroundColor: c }}>{l}</span>
            {l === 'E' && (
              <span className="ml-auto inline-flex h-[18px] items-center rounded-l-md bg-[#0b1220] px-2 text-[11px] font-bold text-white">E</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
