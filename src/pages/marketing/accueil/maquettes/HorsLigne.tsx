import { useEffect, useRef, useState } from 'react'
import { Check, Clock, Loader2, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Maquette } from '../ui'

/**
 * Le relevé hors connexion, en interface : on le voit vivre.
 *
 * Au sous-sol, sans réseau, quatre ouvrages relevés attendent sur
 * l'appareil ; le réseau revient, ils partent un à un ; puis tout est envoyé.
 * Le cycle recommence tant que la carte est à l'écran. Avec le mouvement
 * réduit, la carte reste sur le premier temps, sans animation.
 */

const RELEVES = [
  { nom: 'Chaudière mazout', etat: 'Mauvais', couleur: 'bg-red-50 text-red-700' },
  { nom: 'Conduites de chauffage', etat: 'Moyen', couleur: 'bg-orange-50 text-orange-700' },
  { nom: 'Tableau électrique', etat: 'Bon', couleur: 'bg-lime-50 text-lime-700' },
  { nom: 'Ventilation', etat: 'Moyen', couleur: 'bg-orange-50 text-orange-700' },
]

/** 0 : hors ligne ; de 1 à 4 : le réseau revient et les relevés partent un à un ; 5 : tout est envoyé. */
type Temps = 0 | 1 | 2 | 3 | 4 | 5
const DUREES: Record<Temps, number> = { 0: 3200, 1: 700, 2: 700, 3: 700, 4: 700, 5: 3000 }

function mouvementReduit() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function HorsLigne() {
  const [temps, setTemps] = useState<Temps>(0)
  const [visible, setVisible] = useState(false)
  const zone = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = zone.current
    if (!el || typeof IntersectionObserver === 'undefined' || mouvementReduit()) return
    const o = new IntersectionObserver((e) => setVisible(e.some((x) => x.isIntersecting)), { rootMargin: '0px 0px -15% 0px' })
    o.observe(el)
    return () => o.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    const t = window.setTimeout(() => setTemps((x) => ((x + 1) % 6) as Temps), DUREES[temps])
    return () => window.clearTimeout(t)
  }, [visible, temps])

  const envoyes = temps === 5 ? RELEVES.length : Math.max(0, temps - 1)
  const statut = temps === 0
    ? { libelle: 'Hors ligne', icone: <WifiOff className="h-3.5 w-3.5" />, classe: 'bg-amber-100 text-amber-800' }
    : temps < 5
      ? { libelle: 'Réseau revenu, envoi en cours', icone: <Loader2 className="h-3.5 w-3.5 animate-spin" />, classe: 'bg-sky-100 text-sky-800' }
      : { libelle: 'Tout est envoyé', icone: <Check className="h-3.5 w-3.5" strokeWidth={3} />, classe: 'bg-emerald-100 text-emerald-800' }

  return (
    <Maquette description="Le relevé hors connexion : au sous-sol, quatre ouvrages relevés attendent sur l’appareil, puis partent un à un quand le réseau revient.">
      <div ref={zone} className="mx-auto max-w-[420px] rounded-[28px] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_30px_60px_-28px_rgba(15,23,42,0.4)] ring-1 ring-black/[0.05]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[15px] font-semibold text-[#111827]">Locaux techniques</p>
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors duration-500', statut.classe)}>
            {statut.icone}{statut.libelle}
          </span>
        </div>
        <p className="mt-0.5 text-[12.5px] text-[#6b7280]">Sous-sol · Résidence Les Tilleuls</p>

        <ul className="mt-4 space-y-2">
          {RELEVES.map((r, i) => {
            const parti = i < envoyes
            const enCours = temps > 0 && temps < 5 && i === envoyes
            return (
              <li key={r.nom} className="flex items-center gap-3 rounded-2xl border border-black/[0.06] px-3.5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[#111827]">{r.nom}</span>
                  <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold', r.couleur)}>{r.etat}</span>
                </span>
                <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium transition-colors duration-300', parti ? 'text-emerald-700' : enCours ? 'text-sky-700' : 'text-[#8a8f98]')}>
                  {parti ? <Check className="h-4 w-4" strokeWidth={2.6} /> : enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                  {parti ? 'Envoyé' : enCours ? 'Envoi' : 'En attente'}
                </span>
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-center text-[12.5px] text-[#6b7280]">
          {temps === 5 ? 'Synchronisé à l’instant' : `${RELEVES.length - envoyes} relevé${RELEVES.length - envoyes > 1 ? 's' : ''} et leurs photos gardés sur l’appareil`}
        </p>
      </div>
    </Maquette>
  )
}
