import { useParams } from 'react-router-dom'
import { Calendar, Plus, Clock, User } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

const projectEvents = [
  { id: 1, title: 'Visite diagnostic facade', date: '14 avril 2026', time: '09:00 - 12:00', person: 'Sophie Berger', status: 'planifie' },
  { id: 2, title: 'Reunion coordination chantier', date: '18 avril 2026', time: '14:00 - 15:30', person: 'Sophie Berger', status: 'planifie' },
  { id: 3, title: 'Remise rapport diagnostic', date: '22 avril 2026', time: '10:00', person: 'Julie Favre', status: 'en_attente' },
  { id: 4, title: 'Debut travaux toiture', date: '5 mai 2026', time: '08:00', person: 'Sophie Berger', status: 'planifie' },
  { id: 5, title: 'Controle intermediaire', date: '20 mai 2026', time: '09:00 - 11:00', person: 'Marc Dubois', status: 'planifie' },
]

const months = ['Nov', 'Dec', 'Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aout', 'Sep']
const totalMonths = months.length
const currentMonthIndex = 5

const ganttTasks = [
  { label: 'Diagnostic terrain', category: 'Diagnostic', startMonth: 0, duration: 2.5, progress: 100, color: 'bg-blue-500' },
  { label: 'Analyse labo', category: 'Diagnostic', startMonth: 1, duration: 1.5, progress: 100, color: 'bg-blue-400' },
  { label: 'Rapport diagnostic', category: 'Rapport', startMonth: 2.5, duration: 2, progress: 85, color: 'bg-orange-500' },
  { label: 'Devis estimatif', category: 'Rapport', startMonth: 3, duration: 1.5, progress: 60, color: 'bg-orange-400' },
  { label: 'Travaux toiture', category: 'Travaux', startMonth: 7, duration: 2, progress: 0, color: 'bg-yellow-400' },
  { label: 'Travaux facade', category: 'Travaux', startMonth: 7.5, duration: 2.5, progress: 0, color: 'bg-yellow-400' },
  { label: 'Remplacement fenetres', category: 'Travaux', startMonth: 8, duration: 2, progress: 0, color: 'bg-yellow-400' },
  { label: 'Nettoyage / reception', category: 'Cloture', startMonth: 10, duration: 0.8, progress: 0, color: 'bg-green-500' },
]

const categoryColors: Record<string, string> = {
  'Diagnostic': 'bg-blue-500',
  'Rapport': 'bg-orange-500',
  'Travaux': 'bg-yellow-500',
  'Cloture': 'bg-green-500',
}

export function ProjectPlanning() {
  const { id } = useParams()
  const categories = [...new Set(ganttTasks.map(t => t.category))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendrier du diagnostic</h1>
        <Button><Plus className="mr-2 h-4 w-4" />Ajouter un evenement</Button>
      </div>

      {/* Gantt */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle>Diagramme de Gantt</CardTitle>
            <div className="flex gap-3 text-xs">
              {Object.entries(categoryColors).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div className={cn('h-2.5 w-2.5 rounded-sm', color)} />{cat}
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="flex border-b">
              <div className="w-52 shrink-0 px-4 py-2 text-xs font-medium text-muted-foreground border-r bg-muted/30">Tache</div>
              <div className="flex-1 flex">
                {months.map((m, i) => (
                  <div key={m} className={cn('flex-1 text-center text-xs py-2 border-r border-border/50 font-medium', i === currentMonthIndex && 'bg-primary/5 text-primary font-bold')}>{m}</div>
                ))}
              </div>
            </div>
            {categories.map(cat => (
              <div key={cat}>
                <div className="flex border-b bg-muted/20">
                  <div className="w-52 shrink-0 px-4 py-1.5 text-[11px] font-semibold text-muted-foreground border-r flex items-center gap-2">
                    <div className={cn('h-2 w-2 rounded-sm', categoryColors[cat])} />{cat}
                  </div>
                  <div className="flex-1" />
                </div>
                {ganttTasks.filter(t => t.category === cat).map(task => (
                  <div key={task.label} className="flex border-b hover:bg-muted/20">
                    <div className="w-52 shrink-0 px-4 py-2 text-xs border-r flex items-center gap-2">
                      <span className="truncate">{task.label}</span>
                      {task.progress === 100 && <span className="text-[9px] text-green-600 font-medium shrink-0">Termine</span>}
                    </div>
                    <div className="flex-1 relative h-9">
                      <div className="absolute top-0 bottom-0 w-0.5 bg-primary/60 z-20" style={{ left: `${((currentMonthIndex + 0.3) / totalMonths) * 100}%` }} />
                      <div className={cn('absolute top-1.5 h-6 rounded flex items-center overflow-hidden cursor-pointer', task.color)}
                        style={{ left: `${(task.startMonth / totalMonths) * 100}%`, width: `${(task.duration / totalMonths) * 100}%` }}>
                        {task.progress > 0 && task.progress < 100 && <div className="absolute inset-0 bg-black/15" style={{ width: `${task.progress}%` }} />}
                        <span className="text-[10px] text-white font-medium px-2 truncate relative z-10">{task.label}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div className="flex border-b bg-muted/30">
              <div className="w-52 shrink-0 px-4 py-2 text-xs font-bold border-r">Duree totale</div>
              <div className="flex-1 relative h-9">
                <div className="absolute top-2.5 h-4 rounded-full bg-gradient-to-r from-blue-500 via-orange-400 to-yellow-400 opacity-20"
                  style={{ left: `${(0 / totalMonths) * 100}%`, width: `${(10.8 / totalMonths) * 100}%` }} />
                <span className="absolute top-2 text-[10px] font-medium text-muted-foreground" style={{ left: `${(11 / totalMonths) * 100}%` }}>~11 mois</span>
              </div>
            </div>
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
