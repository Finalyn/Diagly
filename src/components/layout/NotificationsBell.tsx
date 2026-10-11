/**
 * La cloche : le centre de notifications.
 *
 * Elle ne listait que les rendez-vous du calendrier, ce qui n'était pas une
 * notification mais un agenda en réduction : rien de ce que l'application
 * signalait vraiment, un diagnostic ouvert, des urgences relevées, un rappel
 * de visite, ne se retrouvait ici. Le push s'efface, le courriel se perd dans
 * une boîte ; cette liste est la seule trace durable.
 *
 * Les notifications non lues portent une pastille et un fond, et s'effacent au
 * premier coup d'œil : ouvrir la cloche marque tout comme lu, parce que c'est
 * ce que fait le regard.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, Bell, CalendarClock, ClipboardCheck, Settings2, Sparkle, Trash2,
} from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { ilYA } from '@/lib/temps'
import type { ApiNotification, TypeNotification } from '@/lib/api-types'

/** L'icône et la couleur de chaque type, pour reconnaître d'un coup d'œil. */
const ALLURE: Record<TypeNotification, { icone: typeof Bell; fond: string; teinte: string }> = {
  diagnostic_cree: { icone: ClipboardCheck, fond: 'bg-blue-50', teinte: 'text-blue-700' },
  priorite_urgente: { icone: AlertTriangle, fond: 'bg-orange-50', teinte: 'text-orange-700' },
  rappel_visite: { icone: CalendarClock, fond: 'bg-violet-50', teinte: 'text-violet-700' },
  resume_hebdo: { icone: Sparkle, fond: 'bg-neutral-100', teinte: 'text-neutral-600' },
}

const MINUTE = 60_000

export function NotificationsBell() {
  const [ouvert, setOuvert] = useState(false)
  const boite = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.list({ limite: 30 }),
    staleTime: 30_000,
    refetchInterval: 2 * MINUTE,
  })
  const notifications = data?.notifications ?? []
  const nonLues = data?.nonLues ?? 0

  const toutMarquerLu = useMutation({
    mutationFn: () => api.notifications.toutMarquerLu(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const supprimer = useMutation({
    mutationFn: (id: string) => api.notifications.supprimer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => {
      if (boite.current && !boite.current.contains(e.target as Node)) setOuvert(false)
    }
    const touche = (e: KeyboardEvent) => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', touche)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', touche)
    }
  }, [ouvert])

  const ouvrir = () => {
    const suivant = !ouvert
    setOuvert(suivant)
    // Les lire, c'est les avoir vues. La pastille s'éteint dès l'ouverture.
    if (suivant && nonLues > 0) toutMarquerLu.mutate()
  }

  const aller = (n: ApiNotification) => {
    setOuvert(false)
    if (n.url) navigate(n.url)
  }

  return (
    <div ref={boite} className="relative shrink-0">
      <button
        onClick={ouvrir}
        aria-label={nonLues > 0 ? `Notifications, ${nonLues} non lues` : 'Notifications'}
        className="liquid-glass lg-55 flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-neutral-600 transition-colors hover:text-neutral-900"
      >
        <span className="relative">
          <Bell className="h-[21px] w-[21px]" strokeWidth={1.6} />
          {nonLues > 0 && (
            <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white">
              {nonLues > 9 ? '9+' : nonLues}
            </span>
          )}
        </span>
      </button>

      {ouvert && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.30)]">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {notifications.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{notifications.length} récentes</span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Rien à signaler.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Les diagnostics ouverts, les urgences relevées et les rappels de visite paraîtront ici.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const allure = ALLURE[n.type] ?? ALLURE.resume_hebdo
                const Icone = allure.icone
                return (
                  <div
                    key={n.id}
                    className={cn('group flex items-start gap-3 border-b border-black/[0.04] px-4 py-3 last:border-0',
                      !n.lueLe && 'bg-blue-50/40')}
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', allure.fond, allure.teinte)}>
                      <Icone className="h-4 w-4" />
                    </span>
                    <button
                      onClick={() => aller(n)}
                      disabled={!n.url}
                      className="min-w-0 flex-1 text-left disabled:cursor-default"
                    >
                      <p className="text-sm font-medium leading-snug">{n.titre}</p>
                      {n.texte && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{n.texte}</p>}
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{ilYA(n.creeLe)}</p>
                    </button>
                    <button
                      onClick={() => supprimer.mutate(n.id)}
                      title="Effacer"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-black/[0.04] group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <button
            onClick={() => { setOuvert(false); navigate('/app/settings?s=notifications') }}
            className="flex w-full items-center justify-center gap-1.5 border-t border-black/[0.06] px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />Gérer les notifications
          </button>
        </div>
      )}
    </div>
  )
}
