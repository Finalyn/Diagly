import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

interface Phase { key: string; label: string; months: number; color: string }

const DEFAULT_PHASES: Phase[] = [
  { key: 'diag', label: 'Diagnostic', months: 1, color: 'bg-blue-500' },
  { key: 'rapport', label: 'Rapport', months: 1, color: 'bg-indigo-500' },
  { key: 'ao', label: "Appel d'offres", months: 3, color: 'bg-amber-500' },
  { key: 'travaux', label: 'Travaux', months: 16, color: 'bg-green-500' },
  { key: 'reception', label: 'Réception', months: 1, color: 'bg-emerald-600' },
]

function addMonths(base: Date, n: number): Date {
  const d = new Date(base)
  d.setMonth(d.getMonth() + n)
  return d
}
const fmt = (d: Date) => new Intl.DateTimeFormat('fr-CH', { month: 'short', year: 'numeric' }).format(d)
const fmtLong = (d: Date) => new Intl.DateTimeFormat('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)

export function ProjectPlanning() {
  const today = new Date().toISOString().slice(0, 10)
  const [start, setStart] = useState(today)
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES)

  const startDate = useMemo(() => new Date(start + 'T00:00:00'), [start])
  const total = phases.reduce((s, p) => s + Math.max(0, p.months), 0)

  // Offsets cumulés + dates par phase.
  const rows = useMemo(() => {
    let offset = 0
    return phases.map(p => {
      const from = addMonths(startDate, offset)
      const to = addMonths(startDate, offset + p.months)
      const row = { ...p, offset, from, to }
      offset += p.months
      return row
    })
  }, [phases, startDate])

  const endDate = addMonths(startDate, total)
  // Repères d'axe (tous les 3 mois).
  const ticks = Array.from({ length: Math.floor(total / 3) + 1 }, (_, i) => i * 3)

  const setMonths = (key: string, months: number) =>
    setPhases(ps => ps.map(p => (p.key === key ? { ...p, months } : p)))

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Calendrier</h1>
          <p className="text-muted-foreground text-sm">
            {total} mois · {fmtLong(startDate)} → {fmtLong(endDate)}
          </p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Date de début</label>
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-44" />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Échéancier des phases</CardTitle></CardHeader>
        <CardContent>
          {/* Axe temporel */}
          <div className="hidden sm:flex ml-[12rem] mb-2 relative h-4 text-[10px] text-muted-foreground">
            {ticks.map(t => (
              <div key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / total) * 100}%` }}>
                {fmt(addMonths(startDate, t))}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {rows.map(r => (
              <div key={r.key} className="flex items-center gap-2">
                <div className="w-44 shrink-0 flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', r.color)} />
                  <span className="text-sm font-medium truncate">{r.label}</span>
                  <Input
                    type="number" min="0" value={r.months}
                    onChange={e => setMonths(r.key, Math.max(0, Number(e.target.value) || 0))}
                    className="h-7 w-14 text-xs ml-auto"
                  />
                  <span className="text-[10px] text-muted-foreground">mois</span>
                </div>
                <div className="flex-1 relative h-7 bg-muted/40 rounded">
                  <div
                    className={cn('absolute top-0 h-7 rounded flex items-center px-2 text-white text-[11px] font-medium overflow-hidden', r.color)}
                    style={{ left: `${(r.offset / total) * 100}%`, width: `${(r.months / total) * 100}%` }}
                    title={`${fmtLong(r.from)} → ${fmtLong(r.to)}`}
                  >
                    <span className="truncate">{fmt(r.from)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground mt-4">
            Durées modifiables. Échéancier indicatif basé sur les 5 phases de rénovation (Diagnostic → Réception).
          </p>
        </CardContent>
      </Card>

      {/* Détail dates */}
      <Card>
        <CardHeader><CardTitle>Détail</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {rows.map(r => (
              <div key={r.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', r.color)} />
                <span className="font-medium flex-1">{r.label}</span>
                <span className="text-muted-foreground">{fmtLong(r.from)} → {fmtLong(r.to)}</span>
                <span className="w-16 text-right text-muted-foreground">{r.months} mois</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
