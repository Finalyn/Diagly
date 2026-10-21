import { useId, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { heureLisible, type Creneau, type JourLibre } from './creneaux'

/**
 * Choisir un créneau de démo : les jours qui en ont, cinq par cinq, puis les
 * heures libres du jour choisi.
 *
 * Les jours et les heures viennent du serveur (routes/vitrine.ts) : seuls les
 * créneaux où l'agenda de l'hôte est libre y figurent. Le composant ne fait
 * qu'afficher et choisir ; il sert à la réservation comme au déplacement.
 */

const PAR_PAGE = 5
const JOUR_COURT = new Intl.DateTimeFormat('fr-CH', { weekday: 'short', timeZone: 'Europe/Zurich' })
const MOIS_COURT = new Intl.DateTimeFormat('fr-CH', { month: 'short', timeZone: 'Europe/Zurich' })
const midi = (date: string) => new Date(`${date}T12:00:00Z`)

export function ChoixDuCreneau({ jours, valeur, onChange }: {
  jours: JourLibre[]
  valeur: Creneau | null
  onChange: (c: Creneau | null) => void
}) {
  const id = useId()
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(jours.length / PAR_PAGE))
  const visibles = jours.slice(page * PAR_PAGE, page * PAR_PAGE + PAR_PAGE)
  const jour = jours.find((j) => j.date === valeur?.date) ?? null

  const fleche = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/[0.08] text-[#0b1220] transition-colors hover:border-[#0167EA]/40 disabled:cursor-not-allowed disabled:opacity-30'

  return (
    <div>
      <fieldset>
        <div className="flex items-center justify-between gap-3">
          <legend className="text-[15px] font-semibold text-[#0b1220]">Quel jour&nbsp;?</legend>
          {pages > 1 && (
            <div className="flex gap-1.5">
              <button type="button" className={fleche} onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="Jours précédents">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className={fleche} onClick={() => setPage((p) => p + 1)} disabled={page >= pages - 1} aria-label="Jours suivants">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {visibles.map((j) => {
            const d = midi(j.date)
            const choisi = valeur?.date === j.date
            return (
              <label key={j.date} className="relative">
                <input
                  type="radio"
                  name={`${id}-jour`}
                  className="peer sr-only"
                  checked={choisi}
                  onChange={() => onChange({ date: j.date, heure: '' })}
                />
                <span className={cn(
                  'flex min-h-[68px] cursor-pointer flex-col items-center justify-center rounded-xl border px-1 text-center leading-tight transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0167EA]',
                  choisi ? 'border-[#0167EA] bg-[#0167EA] text-white' : 'border-black/[0.08] text-[#0b1220] hover:border-[#0167EA]/40',
                )}>
                  <span className={cn('text-[10.5px] font-medium uppercase', choisi ? 'text-white/80' : 'text-[#6b7280]')}>{JOUR_COURT.format(d).replace('.', '')}</span>
                  <span className="text-[18px] font-semibold tabular-nums">{d.getUTCDate()}</span>
                  <span className={cn('text-[11px]', choisi ? 'text-white/80' : 'text-[#6b7280]')}>{MOIS_COURT.format(d)}</span>
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-[15px] font-semibold text-[#0b1220]">À quelle heure&nbsp;?</legend>
        {jour ? (
          <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {jour.heures.map((h) => {
              const choisi = valeur?.heure === h
              return (
                <label key={h} className="relative">
                  <input type="radio" name={`${id}-heure`} className="peer sr-only" checked={choisi} onChange={() => onChange({ date: jour.date, heure: h })} />
                  <span className={cn(
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-xl border text-[14px] font-semibold tabular-nums transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0167EA]',
                    choisi ? 'border-[#0167EA] bg-[#0167EA] text-white' : 'border-black/[0.08] text-[#0b1220] hover:border-[#0167EA]/40',
                  )}>
                    {heureLisible(h)}
                  </span>
                </label>
              )
            })}
          </div>
        ) : (
          <p className="mt-3 rounded-xl border border-dashed border-black/[0.1] px-4 py-3 text-[13.5px] text-[#8a8f98]">Choisissez d’abord un jour.</p>
        )}
      </fieldset>
    </div>
  )
}
