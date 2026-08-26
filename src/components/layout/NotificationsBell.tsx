import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CalendarClock, Settings2, Clock } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { ApiEvent } from '@/lib/api-types'

const DAY = 86_400_000

/** Fenêtre : d'hier (pour garder les rappels du jour) à +14 jours. */
function windowRange() {
  const now = Date.now()
  return { from: new Date(now - DAY).toISOString(), to: new Date(now + 14 * DAY).toISOString() }
}

/** Libellé relatif court et humain d'une date d'événement. */
function relLabel(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / DAY)
  const time = allDay ? '' : ` · ${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`
  if (diff === 0) return `Aujourd'hui${time}`
  if (diff === 1) return `Demain${time}`
  if (diff === -1) return `Hier${time}`
  if (diff < 0) return `Il y a ${-diff} j${time}`
  return `${d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })}${time}`
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['notif-events'],
    queryFn: () => api.events.list(windowRange()),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  })

  // Événements triés par date (les plus proches d'abord), passé récent inclus.
  const events: ApiEvent[] = useMemo(
    () => (data?.events ?? []).slice().sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).slice(0, 12),
    [data],
  )
  // Lecture volontaire de l'heure au rendu : la pastille « à venir » se recalcule à
  // chaque rafraîchissement de la requête (toutes les 5 minutes), ce qui suffit ici.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  // « Nouveau » = à venir dans les 3 jours (ou aujourd'hui) => pastille.
  const unseen = events.filter((e) => {
    const t = new Date(e.startAt).getTime()
    return t >= now - DAY && t <= now + 3 * DAY
  }).length

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onEsc) }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="liquid-glass lg-55 flex h-[52px] w-[52px] items-center justify-center rounded-2xl text-neutral-600 transition-colors hover:text-neutral-900"
      >
        <span className="relative">
          <Bell className="h-[21px] w-[21px]" strokeWidth={1.6} />
          {unseen > 0 && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unseen > 0 && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">{unseen} à venir</span>}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Aucune notification récente.</p>
                <p className="mt-1 text-xs text-muted-foreground">Vos rappels et visites à venir apparaîtront ici.</p>
              </div>
            ) : (
              events.map((e) => {
                const past = new Date(e.startAt).getTime() < now
                const to = e.projectId ? `/app/projects/${e.projectId}/calendrier` : '/app/planning'
                return (
                  <Link
                    key={e.id}
                    to={to}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 border-b border-black/[0.04] px-4 py-3 last:border-0 hover:bg-neutral-50"
                  >
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', past ? 'bg-neutral-100 text-neutral-500' : 'bg-primary/10 text-primary')}>
                      {past ? <Clock className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{relLabel(e.startAt, e.allDay)}{e.location ? ` · ${e.location}` : ''}</p>
                    </div>
                  </Link>
                )
              })
            )}
          </div>

          <Link
            to="/app/settings?tab=notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t border-black/[0.06] px-4 py-2.5 text-xs font-medium text-muted-foreground hover:bg-neutral-50 hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />Gérer les notifications
          </Link>
        </div>
      )}
    </div>
  )
}
