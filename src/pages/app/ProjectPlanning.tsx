import { useParams } from 'react-router-dom'
import { Calendar, Plus, Clock, User } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { cn, formatCHF } from '@/lib/utils'

const projectEvents = [
  { id: 1, title: 'Visite diagnostic facade', date: '14 avril 2026', time: '09:00 - 12:00', person: 'Sophie Berger', status: 'planifie' },
  { id: 2, title: 'Reunion coordination chantier', date: '18 avril 2026', time: '14:00 - 15:30', person: 'Sophie Berger', status: 'planifie' },
  { id: 3, title: 'Remise rapport diagnostic', date: '22 avril 2026', time: '10:00', person: 'Julie Favre', status: 'en_attente' },
  { id: 4, title: 'Debut travaux toiture', date: '5 mai 2026', time: '08:00', person: 'Sophie Berger', status: 'planifie' },
  { id: 5, title: 'Controle intermediaire', date: '20 mai 2026', time: '09:00 - 11:00', person: 'Marc Dubois', status: 'planifie' },
]

/* Echeancier de paiement Diagly - 24 mois.
   Avril 2026 (0) -> Dec 2026 (8) -> Dec 2027 (20) -> Mars 2028 (23). */
const monthLabels = ['Janv', 'Fev', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Aout', 'Sept', 'Oct', 'Nov', 'Dec']
const echeancierMonths: { label: string; year: number }[] = [
  ...monthLabels.slice(3).map(l => ({ label: l, year: 2026 })), // Avril -> Dec 2026
  ...monthLabels.map(l => ({ label: l, year: 2027 })),          // Janv -> Dec 2027
  ...monthLabels.slice(0, 3).map(l => ({ label: l, year: 2028 })), // Janv -> Mars 2028
]
const yearSpans: { year: number; start: number; span: number }[] = [
  { year: 2026, start: 0, span: 9 },
  { year: 2027, start: 9, span: 12 },
  { year: 2028, start: 21, span: 3 },
]
const yearEndCols = [8, 20] // hatched separator (Dec 2026, Dec 2027)

type BarColor = 'green' | 'orange'
interface PhaseTask { label: string; start: number; end: number; color: BarColor }
interface PhaseGroup { code: string; label: string; tasks: PhaseTask[] }

const phases: PhaseGroup[] = [
  { code: '10', label: 'Diagnostic', tasks: [
    { label: 'Visite et releves sur site', start: 0, end: 0, color: 'green' },
    { label: 'Analyses techniques et CECB', start: 0, end: 1, color: 'green' },
  ]},
  { code: '20', label: 'Rapport et estimation', tasks: [
    { label: 'Redaction du rapport diagnostic', start: 1, end: 2, color: 'green' },
    { label: 'Estimation des couts par CFC', start: 2, end: 3, color: 'green' },
    { label: 'Remise du rapport au client', start: 3, end: 3, color: 'green' },
  ]},
  { code: '30', label: "Appels d'offres / adjudications", tasks: [
    { label: 'Cahier des charges entreprises', start: 4, end: 5, color: 'green' },
    { label: 'Reception et analyse des offres', start: 5, end: 6, color: 'green' },
    { label: 'Adjudications', start: 6, end: 7, color: 'green' },
  ]},
  { code: '40', label: 'Execution des travaux', tasks: [
    { label: 'Installations de chantier', start: 8, end: 8, color: 'orange' },
    { label: 'Toiture / etancheite', start: 9, end: 11, color: 'orange' },
    { label: 'Facade et isolation peripherique', start: 9, end: 13, color: 'orange' },
    { label: 'Remplacement des fenetres', start: 11, end: 13, color: 'orange' },
    { label: 'Renovation interieure (peinture, sols)', start: 13, end: 17, color: 'orange' },
    { label: 'Installations techniques (CVSE)', start: 14, end: 17, color: 'orange' },
    { label: 'Cuisines et salles de bains', start: 15, end: 18, color: 'orange' },
    { label: 'Amenagements exterieurs', start: 18, end: 20, color: 'orange' },
  ]},
  { code: '50', label: 'Reception et garanties', tasks: [
    { label: 'Reception des travaux', start: 21, end: 21, color: 'green' },
    { label: 'Suivi des garanties et retouches', start: 21, end: 23, color: 'green' },
  ]},
]

// Monthly amounts (CHF) - mockup based on a diagnostic+renovation budget.
// Honoraires : etalonnes sur les phases 10/20/30 + suivi travaux + reception.
// Travaux : factures mensuelles sur la phase 40 (mois 8-20).
const honoraryByMonth: number[] = [
  18000, 22000, 18000, 25000,           // Avril-Juillet 2026 (diagnostic + rapport)
  12000, 14000, 16000, 12000, 8000,     // Aout-Dec 2026 (appels d'offres)
  9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500, 9500, // 2027 (suivi travaux)
  18000, 12000, 8000,                   // Janv-Mars 2028 (reception)
]
const worksByMonth: number[] = [
  0, 0, 0, 0, 0, 0, 0, 0,               // pas de travaux avant adjudication
  85000,                                // Dec 2026 - installations chantier
  142000, 168000, 145000, 132000, 158000, 174000, 165000, 182000, 168000, 154000, 138000, 95000, // 2027
  0, 0, 0,                              // 2028 = solde + retenues
]

const totalHonoraires = honoraryByMonth.reduce((s, v) => s + v, 0)
const totalWorks = worksByMonth.reduce((s, v) => s + v, 0)

export function ProjectPlanning() {
  useParams()

  const exportEcheancier = () => {
    const sep = ';'
    const monthHeaders = echeancierMonths.map(m => `${m.label} ${m.year}`).join(sep)
    const rows: string[] = []
    rows.push(`Phases du projet${sep}${monthHeaders}`)
    phases.forEach(phase => {
      rows.push(`${phase.code} - ${phase.label}${sep.repeat(echeancierMonths.length)}`)
      phase.tasks.forEach(task => {
        const cells = echeancierMonths.map((_, i) => (task.start >= 0 && i >= task.start && i <= task.end ? (task.color === 'green' ? 'H' : 'T') : ''))
        rows.push(`  ${task.label}${sep}${cells.join(sep)}`)
      })
    })
    rows.push('')
    rows.push(`Echeancier paiement Travaux${sep}${worksByMonth.map(v => v || '').join(sep)}`)
    rows.push(`Echeancier paiement Honoraires${sep}${honoraryByMonth.map(v => v || '').join(sep)}`)
    rows.push(`ECHEANCIER DE PAIEMENT TOTAL${sep}${worksByMonth.map((v, i) => (v + honoraryByMonth[i]) || '').join(sep)}`)
    const csv = '﻿' + rows.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `echeancier-paiement-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendrier du diagnostic</h1>
        <Button><Plus className="mr-2 h-4 w-4" />Ajouter un evenement</Button>
      </div>

      {/* Echeancier de paiement SIA 102 */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Echeancier de paiement</CardTitle>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded-sm bg-emerald-300" />Honoraires</div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded-sm bg-orange-300" />Travaux execution</div>
              <div className="flex items-center gap-1.5"><div className="h-3 w-6 rounded-sm bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_3px,transparent_3px,transparent_6px)] border border-border" />Fin d'annee</div>
              <Button variant="outline" size="sm" onClick={exportEcheancier}>Exporter</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[1100px]">
              {/* Year header */}
              <div className="flex border-b text-xs">
                <div className="w-72 shrink-0 px-3 py-2 font-medium text-muted-foreground border-r">Phases du projet</div>
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${echeancierMonths.length}, minmax(0, 1fr))` }}>
                  {yearSpans.map(y => (
                    <div key={y.year} className="text-center font-bold py-2 border-r border-l border-border/60 bg-muted/30" style={{ gridColumn: `${y.start + 1} / span ${y.span}` }}>{y.year}</div>
                  ))}
                </div>
              </div>
              {/* Month header */}
              <div className="flex border-b text-[10px]">
                <div className="w-72 shrink-0 px-3 py-1.5 font-medium text-muted-foreground border-r" />
                <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${echeancierMonths.length}, minmax(0, 1fr))` }}>
                  {echeancierMonths.map((m, i) => (
                    <div key={i} className={cn('text-center py-1.5 border-r border-border/40 text-muted-foreground', yearEndCols.includes(i) && 'bg-muted/40')}>
                      {m.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Phases */}
              {phases.map(phase => (
                <div key={phase.code}>
                  <div className="flex bg-muted/50 text-xs border-y">
                    <div className="w-72 shrink-0 px-3 py-1.5 font-semibold border-r flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{phase.code}</span>
                      <span>{phase.label}</span>
                    </div>
                    <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${echeancierMonths.length}, minmax(0, 1fr))` }}>
                      {echeancierMonths.map((_, i) => (
                        <div key={i} className={cn('border-r border-border/40', yearEndCols.includes(i) && 'bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_3px,transparent_3px,transparent_6px)]')} />
                      ))}
                    </div>
                  </div>
                  {phase.tasks.map((task, ti) => (
                    <div key={ti} className="flex border-b text-xs hover:bg-muted/30">
                      <div className={cn('w-72 shrink-0 px-3 py-1.5 border-r truncate', task.color === 'orange' && 'italic')}>{task.label}</div>
                      <div className="flex-1 relative grid h-7" style={{ gridTemplateColumns: `repeat(${echeancierMonths.length}, minmax(0, 1fr))` }}>
                        {echeancierMonths.map((_, i) => (
                          <div key={i} className={cn('border-r border-border/40', yearEndCols.includes(i) && 'bg-[repeating-linear-gradient(45deg,#e5e7eb,#e5e7eb_3px,transparent_3px,transparent_6px)]')} />
                        ))}
                        {task.start >= 0 && task.end >= 0 && (
                          <div
                            className={cn('absolute top-1.5 h-4 rounded-sm', task.color === 'green' ? 'bg-emerald-300' : 'bg-orange-300')}
                            style={{ left: `${(task.start / echeancierMonths.length) * 100}%`, width: `${((task.end - task.start + 1) / echeancierMonths.length) * 100}%` }}
                            title={task.label}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}

              {/* Payment rows */}
              {[
                { label: 'Echeancier de paiement travaux', values: worksByMonth, bold: false, italic: true },
                { label: 'Echeancier de paiement Honoraires', values: honoraryByMonth, bold: false, italic: true },
                { label: 'ECHEANCIER DE PAIEMENT TOTAL', values: worksByMonth.map((v, i) => v + honoraryByMonth[i]), bold: true, italic: false },
              ].map((row, ri) => (
                <div key={ri} className={cn('flex border-b text-[10px]', row.bold && 'border-t-2 border-foreground/60 bg-muted/40 font-bold')}>
                  <div className={cn('w-72 shrink-0 px-3 py-1.5 border-r', row.italic && 'italic text-muted-foreground')}>{row.label}</div>
                  <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${echeancierMonths.length}, minmax(0, 1fr))` }}>
                    {row.values.map((v, i) => (
                      <div key={i} className={cn('text-center py-1.5 border-r border-border/40 tabular-nums', yearEndCols.includes(i) && 'bg-muted/40', v === 0 && 'text-muted-foreground/40')}>
                        {v > 0 ? v.toLocaleString('fr-CH', { useGrouping: true }) : ''}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3 flex flex-wrap gap-6 text-xs border-t bg-muted/20">
            <div><span className="text-muted-foreground">Total honoraires :</span> <span className="font-bold">{formatCHF(totalHonoraires)}</span></div>
            <div><span className="text-muted-foreground">Total travaux :</span> <span className="font-bold">{formatCHF(totalWorks)}</span></div>
            <div className="ml-auto"><span className="text-muted-foreground">Total general :</span> <span className="font-bold text-foreground">{formatCHF(totalHonoraires + totalWorks)}</span></div>
          </div>
        </CardContent>
      </Card>

      {/* Events */}
      <Card>
        <CardHeader><CardTitle>Evenements a venir</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {projectEvents.map(event => (
            <div key={event.id} className="flex items-center gap-4 p-3 border rounded-lg">
              <div className="text-center w-12 shrink-0">
                <Calendar className="h-5 w-5 text-muted-foreground mx-auto" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{event.title}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{event.date}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.time}</span>
                  <span className="flex items-center gap-1"><User className="h-3 w-3" />{event.person}</span>
                </div>
              </div>
              <Badge variant={event.status === 'planifie' ? 'secondary' : 'outline'}>{event.status === 'planifie' ? 'Planifie' : 'En attente'}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
