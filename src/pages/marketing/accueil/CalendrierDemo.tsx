import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { heureLisible, type JourLibre } from './creneaux'

/**
 * Le calendrier de réservation d'une démo, sur l'accueil, en étapes et sur
 * une seule colonne. D'abord le mois, sobre : des chiffres, foncés pour les
 * jours libres, gris pour les autres, et un point sous aujourd'hui. Le jour
 * choisi, ses heures libres prennent la place du mois, avec de quoi revenir.
 * Choisir une heure passe la main à la fenêtre des coordonnées
 * (sections/Demo.tsx).
 *
 * Les jours et les heures viennent du serveur (routes/vitrine.ts). Le
 * déplacement d'une démo garde son propre choix, en bande de jours
 * (ChoixDuCreneau).
 */

const MOIS = new Intl.DateTimeFormat('fr-CH', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const JOUR_LONG = new Intl.DateTimeFormat('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
// « 2026-11-11 » : la date du jour en Suisse, comme celles des créneaux.
const AUJOURD_HUI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' })
const SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const deux = (n: number) => String(n).padStart(2, '0')
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const jourLisible = (date: string) => majuscule(JOUR_LONG.format(new Date(`${date}T12:00:00Z`)))

export function CalendrierDemo({ jours, jour, onJour, onHeure }: {
  jours: JourLibre[]
  /** Le jour choisi, « 2026-11-25 », ou rien : le mois s'affiche. */
  jour: string | null
  onJour: (date: string | null) => void
  onHeure: (heure: string) => void
}) {
  // Les mois qui ont au moins un jour libre, dans l'ordre : on ne feuillette qu'eux.
  const mois = [...new Set(jours.map((j) => j.date.slice(0, 7)))]
  const [page, setPage] = useState(0)
  const courant = mois[Math.min(page, mois.length - 1)] ?? ''
  const [annee, m] = courant.split('-').map(Number)
  const libres = new Map(jours.map((j) => [j.date, j]))
  const choisi = jour ? libres.get(jour) ?? null : null
  const aujourdhui = AUJOURD_HUI.format(new Date())

  const fleche = 'flex h-9 w-9 items-center justify-center rounded-full text-[#4b5563] transition-colors hover:bg-black/[0.04] hover:text-[#0b1220] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'
  const anneau = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0167EA]'

  // Deuxième étape : les heures du jour choisi, sous la même barre que le mois.
  if (choisi) {
    return (
      <div className="min-h-[19rem]">
        <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center">
          <button type="button" onClick={() => onJour(null)} aria-label="Revenir au calendrier" className={cn(fleche, anneau)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="text-center text-[15px] font-medium text-[#0b1220]">{jourLisible(choisi.date)}</p>
        </div>
        <div className="mt-5 grid grid-cols-4 gap-2">
          {choisi.heures.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onHeure(h)}
              className={cn('flex h-10 items-center justify-center rounded-xl border border-black/[0.09] text-[14px] tabular-nums text-[#0b1220] transition-colors hover:border-[#0167EA] hover:bg-[#0167EA] hover:text-white', anneau)}
            >
              {heureLisible(h)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Première étape : le mois, semaine commençant le lundi ; null pour les cases vides du début.
  const decalage = (new Date(Date.UTC(annee, m - 1, 1)).getUTCDay() + 6) % 7
  const nbJours = new Date(Date.UTC(annee, m, 0)).getUTCDate()
  const cases = [...Array<null>(decalage).fill(null), ...Array.from({ length: nbJours }, (_, i) => `${courant}-${deux(i + 1)}`)]

  return (
    <div className="min-h-[19rem]">
      <div className="grid grid-cols-[2.25rem_1fr_2.25rem] items-center">
        <button type="button" className={cn(fleche, anneau)} onClick={() => setPage((p) => p - 1)} disabled={page === 0} aria-label="Mois précédent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-center text-[15px] font-medium text-[#0b1220]">{majuscule(MOIS.format(new Date(Date.UTC(annee, m - 1, 15))))}</p>
        <button type="button" className={cn(fleche, anneau)} onClick={() => setPage((p) => p + 1)} disabled={page >= mois.length - 1} aria-label="Mois suivant">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center">
        {SEMAINE.map((s, i) => (
          <span key={i} aria-hidden="true" className="pb-2 text-[12px] font-medium text-[#6b7280]">{s}</span>
        ))}
        {cases.map((date, i) => {
          if (!date) return <span key={`vide-${i}`} />
          const n = Number(date.slice(8))
          // Le point d'aujourd'hui, sous le chiffre.
          const point = date === aujourdhui && <span aria-hidden="true" className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#0167EA]" />
          if (!libres.has(date)) {
            return <span key={date} className="relative flex h-10 items-center justify-center text-[14px] tabular-nums text-[#c4c9d1]">{n}{point}</span>
          }
          return (
            <span key={date} className="flex justify-center">
              <button
                type="button"
                onClick={() => onJour(date)}
                aria-label={jourLisible(date)}
                className={cn('relative flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-medium tabular-nums text-[#0b1220] transition-colors hover:bg-[#0167EA] hover:text-white', anneau)}
              >
                {n}{point}
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}
