import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, X, MapPin } from 'lucide-react'
import { Button, Input, Select, Textarea } from '@/components/ui'
import { api } from '@/lib/api'
import type { ApiEvent, EventCategory } from '@/lib/api-types'
import { cn } from '@/lib/utils'

const CATEGORIES: Record<EventCategory, { label: string; color: string }> = {
  VISITE: { label: 'Visite', color: '#3b82f6' },
  REUNION: { label: 'Réunion', color: '#a855f7' },
  TRAVAUX: { label: 'Travaux', color: '#f59e0b' },
  ECHEANCE: { label: 'Échéance', color: '#ef4444' },
  APPEL: { label: 'Appel', color: '#22c55e' },
  AUTRE: { label: 'Autre', color: '#64748b' },
}
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const eventColor = (e: ApiEvent) => e.color || CATEGORIES[e.category]?.color || '#64748b'
const two = (n: number) => String(n).padStart(2, '0')

interface Draft {
  id?: string
  title: string
  category: EventCategory
  date: string
  allDay: boolean
  startTime: string
  endTime: string
  location: string
  notes: string
  projectId: string
}

export function PlanningPage() {
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [draft, setDraft] = useState<Draft | null>(null)

  // Grille : 6 semaines à partir du lundi précédant le 1er du mois.
  const gridStart = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const wd = (first.getDay() + 6) % 7
    const s = new Date(first); s.setDate(first.getDate() - wd)
    return s
  }, [month])
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + i); return d }), [gridStart])
  const rangeTo = useMemo(() => { const d = new Date(gridStart); d.setDate(gridStart.getDate() + 42); return d }, [gridStart])

  const { data } = useQuery({
    queryKey: ['events', gridStart.toISOString()],
    queryFn: () => api.events.list({ from: gridStart.toISOString(), to: rangeTo.toISOString() }),
  })
  // Référence stable : `?? []` produirait un tableau neuf à chaque rendu et casserait les mémorisations en aval.
  const events = useMemo(() => data?.events ?? [], [data])
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list(), staleTime: 60_000 })
  const projects = projectsQuery.data?.projects ?? []

  const byDay = useMemo(() => {
    const m = new Map<string, ApiEvent[]>()
    for (const e of events) { const k = keyOf(new Date(e.startAt)); const arr = m.get(k); if (arr) arr.push(e); else m.set(k, [e]) }
    return m
  }, [events])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['events'] })
  const saveMut = useMutation({
    mutationFn: (d: Draft) => {
      const startAt = d.allDay ? new Date(`${d.date}T00:00`).toISOString() : new Date(`${d.date}T${d.startTime || '09:00'}`).toISOString()
      const endAt = d.allDay ? null : d.endTime ? new Date(`${d.date}T${d.endTime}`).toISOString() : null
      const body = { title: d.title.trim(), category: d.category, allDay: d.allDay, startAt, endAt, location: d.location.trim() || null, notes: d.notes.trim() || null, projectId: d.projectId || null }
      return d.id ? api.events.update(d.id, body) : api.events.create(body)
    },
    onSuccess: () => { invalidate(); setDraft(null) },
  })
  const delMut = useMutation({ mutationFn: (id: string) => api.events.delete(id), onSuccess: () => { invalidate(); setDraft(null) } })

  const newEvent = (date: Date) => setDraft({ title: '', category: 'VISITE', date: keyOf(date), allDay: false, startTime: '09:00', endTime: '10:00', location: '', notes: '', projectId: '' })
  const editEvent = (e: ApiEvent) => {
    const s = new Date(e.startAt); const en = e.endAt ? new Date(e.endAt) : null
    setDraft({ id: e.id, title: e.title, category: e.category, date: keyOf(s), allDay: e.allDay, startTime: `${two(s.getHours())}:${two(s.getMinutes())}`, endTime: en ? `${two(en.getHours())}:${two(en.getMinutes())}` : '', location: e.location ?? '', notes: e.notes ?? '', projectId: e.projectId ?? '' })
  }

  const todayKey = keyOf(new Date())

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl md:text-2xl font-bold">{MONTHS[month.getMonth()]} {month.getFullYear()}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1.5 rounded-lg border hover:bg-muted/50"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => { const n = new Date(); setMonth(new Date(n.getFullYear(), n.getMonth(), 1)) }} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-muted/50">Aujourd'hui</button>
            <button onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1.5 rounded-lg border hover:bg-muted/50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <Button onClick={() => newEvent(new Date())} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nouvel événement</Button>
      </div>

      {/* Calendrier */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-[11px] font-semibold text-muted-foreground text-center uppercase tracking-wide">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const inMonth = d.getMonth() === month.getMonth()
            const k = keyOf(d)
            const list = byDay.get(k) ?? []
            const isToday = k === todayKey
            return (
              <div key={i} className={cn('min-h-[92px] border-b border-r p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0', !inMonth && 'bg-muted/20')}>
                <button onClick={() => newEvent(d)} className={cn('h-6 w-6 rounded-full text-xs font-medium flex items-center justify-center mb-1 hover:bg-muted', isToday ? 'bg-primary text-white' : inMonth ? 'text-foreground' : 'text-muted-foreground')}>
                  {d.getDate()}
                </button>
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((e) => (
                    <button key={e.id} onClick={() => editEvent(e)} className="w-full text-left flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-medium truncate hover:opacity-80" style={{ backgroundColor: eventColor(e) + '22', color: eventColor(e) }}>
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: eventColor(e) }} />
                      <span className="truncate">{!e.allDay && `${two(new Date(e.startAt).getHours())}:${two(new Date(e.startAt).getMinutes())} `}{e.title}</span>
                    </button>
                  ))}
                  {list.length > 3 && <p className="text-[10px] text-muted-foreground pl-1">+{list.length - 3}</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modale événement */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDraft(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="text-lg font-bold">{draft.id ? 'Modifier l\'événement' : 'Nouvel événement'}</h3>
              <button onClick={() => setDraft(null)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Titre</label>
                <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="ex. Visite Résidence du Lac" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">Type</label>
                  <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value as EventCategory })}>
                    {(Object.keys(CATEGORIES) as EventCategory[]).map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date</label>
                  <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} className="rounded" />Toute la journée</label>
              {!draft.allDay && (
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-sm font-medium mb-1 block">Début</label><Input type="time" value={draft.startTime} onChange={(e) => setDraft({ ...draft, startTime: e.target.value })} /></div>
                  <div><label className="text-sm font-medium mb-1 block">Fin</label><Input type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></div>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />Lieu</label>
                <Input value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} placeholder="Adresse, salle…" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Bâtiment / projet</label>
                <Select value={draft.projectId} onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}>
                  <option value="">— Aucun —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Notes</label>
                <Textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={2} placeholder="Détails…" />
              </div>
            </div>
            <div className="flex items-center gap-2 px-5 py-4 border-t">
              {draft.id && (
                <Button variant="ghost" onClick={() => delMut.mutate(draft.id!)} disabled={delMut.isPending} className="text-red-600 hover:text-red-700 mr-auto">
                  {delMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="outline" onClick={() => setDraft(null)} className={cn(!draft.id && 'ml-auto')}>Annuler</Button>
              <Button onClick={() => saveMut.mutate(draft)} disabled={saveMut.isPending || !draft.title.trim()}>
                {saveMut.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />…</> : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
