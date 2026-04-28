import { useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, List, CalendarDays } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Select } from '@/components/ui'
import { cn } from '@/lib/utils'

type ViewMode = 'month' | 'week'

const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const events = [
  { id: 1, day: 9, endDay: 9, title: 'Reunion chantier - Residence du Lac', type: 'visite', time: '08:30 - 10:00', person: 'Sophie Berger', location: 'Av. de Cour 42, Lausanne' },
  { id: 2, day: 11, endDay: 11, title: 'Visite diagnostic - Hotel Beau-Rivage', type: 'diagnostic', time: '09:00 - 16:00', person: 'Sophie Berger', location: 'Quai du Mont-Blanc 8, Montreux' },
  { id: 3, day: 14, endDay: 14, title: 'Reunion coordination - Ecole Paquis', type: 'visite', time: '14:00 - 15:30', person: 'Marc Dubois', location: 'Rue de Zurich 18, Geneve' },
  { id: 4, day: 16, endDay: 18, title: 'Diagnostic complet - Immeuble Grand-Rue', type: 'diagnostic', time: '08:00 - 17:00', person: 'Sophie Berger', location: 'Grand-Rue 15, Fribourg' },
  { id: 5, day: 18, endDay: 18, title: 'Remise rapport - Ecole Paquis', type: 'rapport', time: '10:00', person: 'Julie Favre', location: '' },
  { id: 6, day: 21, endDay: 21, title: 'Visite chantier - Centre Numa Droz', type: 'visite', time: '09:00 - 11:00', person: 'Marc Dubois', location: 'Rue Numa-Droz 2, Neuchatel' },
  { id: 7, day: 22, endDay: 22, title: 'Suivi travaux toiture - Residence du Lac', type: 'travaux', time: '08:00 - 12:00', person: 'Sophie Berger', location: 'Av. de Cour 42, Lausanne' },
  { id: 8, day: 25, endDay: 25, title: 'Reunion proprietaire - Les Tilleuls', type: 'visite', time: '17:00 - 18:00', person: 'Sophie Berger', location: 'Rue des Tilleuls 8, Lausanne' },
  { id: 9, day: 28, endDay: 30, title: 'Formation equipe CECB', type: 'autre', time: '09:00 - 12:00', person: 'Tous', location: 'Bureau' },
]

const typeConfig: Record<string, { bg: string; text: string; label: string }> = {
  diagnostic: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Diagnostic' },
  visite: { bg: 'bg-green-100', text: 'text-green-800', label: 'Visite' },
  rapport: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Rapport' },
  travaux: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Travaux' },
  autre: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Autre' },
}

const teamMembers = [
  { name: 'Sophie Berger', role: 'DT', events: 5 },
  { name: 'Marc Dubois', role: 'Architecte', events: 2 },
  { name: 'Julie Favre', role: 'Assistante', events: 1 },
]

export function PlanningPage() {
  const [view, setView] = useState<ViewMode>('month')
  const [selectedEvent, setSelectedEvent] = useState<typeof events[0] | null>(null)
  const [filterPerson, setFilterPerson] = useState('')
  const [filterType, setFilterType] = useState('')

  const daysInMonth = 30
  const firstDayOffset = 2

  const filteredEvents = events.filter(e => {
    if (filterPerson && e.person !== filterPerson && e.person !== 'Tous') return false
    if (filterType && e.type !== filterType) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Calendrier</h1>
          <p className="text-muted-foreground">{filteredEvents.length} evenements en avril 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted p-0.5 rounded-lg">
            <button onClick={() => setView('month')} className={cn('px-3 py-1.5 rounded text-xs font-medium', view === 'month' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              <CalendarDays className="h-3.5 w-3.5 inline mr-1" />Mois
            </button>
            <button onClick={() => setView('week')} className={cn('px-3 py-1.5 rounded text-xs font-medium', view === 'week' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>
              <List className="h-3.5 w-3.5 inline mr-1" />Semaine
            </button>
          </div>
          <Button variant="outline" size="icon"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-semibold px-2 text-sm">Avril 2026</span>
          <Button variant="outline" size="icon"><ChevronRight className="h-4 w-4" /></Button>
          <Button><Plus className="mr-2 h-4 w-4" />Nouvel evenement</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select className="w-44" value={filterPerson} onChange={e => setFilterPerson(e.target.value)}>
          <option value="">Tous les membres</option>
          {teamMembers.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
        </Select>
        <Select className="w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          {Object.entries(typeConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      {view === 'month' && (
        <Card>
          <CardContent className="p-2">
            <div className="grid grid-cols-7 gap-px bg-border rounded overflow-hidden">
              {days.map(d => <div key={d} className="bg-muted p-2 text-center text-xs font-medium">{d}</div>)}
              {Array.from({ length: firstDayOffset }, (_, i) => <div key={`e${i}`} className="bg-background p-1.5 min-h-[90px]" />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1
                const dayEvents = filteredEvents.filter(e => day >= e.day && day <= e.endDay)
                const isToday = day === 9
                return (
                  <div key={day} className={cn('bg-background p-1.5 min-h-[90px]', isToday && 'ring-2 ring-primary ring-inset')}>
                    <span className={cn('text-xs inline-flex h-5 w-5 items-center justify-center rounded-full', isToday && 'bg-primary text-white font-bold')}>{day}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {dayEvents.slice(0, 2).map(e => {
                        const config = typeConfig[e.type]
                        return (
                          <button key={e.id} onClick={() => setSelectedEvent(e)} className={cn('w-full text-left text-[10px] rounded px-1 py-0.5 truncate', config.bg, config.text)}>
                            {day === e.day ? e.title : '...'}
                          </button>
                        )
                      })}
                      {dayEvents.length > 2 && <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {view === 'week' && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {filteredEvents.sort((a, b) => a.day - b.day).map(event => {
                const config = typeConfig[event.type]
                return (
                  <button key={event.id} onClick={() => setSelectedEvent(event)} className="flex items-center gap-4 p-3 border rounded-lg w-full text-left hover:shadow-sm transition-shadow">
                    <div className="text-center w-12 shrink-0">
                      <p className="text-xl font-bold">{event.day}</p>
                      <p className="text-[10px] text-muted-foreground">avr.</p>
                    </div>
                    <div className={cn('w-1 self-stretch rounded-full', config.bg)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{event.title}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{event.time}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{event.person}</span>
                        {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>}
                      </div>
                    </div>
                    <Badge className={cn(config.bg, config.text, 'text-[10px]')}>{config.label}</Badge>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Charge equipe</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {teamMembers.map(m => (
              <div key={m.name} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">{m.name.split(' ').map(n => n[0]).join('')}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.role}</p>
                </div>
                <Badge variant="secondary">{m.events} ev.</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Prochains evenements</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {filteredEvents.filter(e => e.day >= 9).slice(0, 5).map(e => {
              const config = typeConfig[e.type]
              return (
                <div key={e.id} className="flex items-center gap-3 text-sm">
                  <span className="font-bold w-6 text-right">{e.day}</span>
                  <div className={cn('h-2 w-2 rounded-full', config.bg.replace('100', '500'))} />
                  <span className="flex-1 truncate">{e.title}</span>
                  <span className="text-xs text-muted-foreground">{e.time}</span>
                  <Badge className={cn(config.bg, config.text, 'text-[10px]')}>{config.label}</Badge>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setSelectedEvent(null)}>
          <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge className={cn(typeConfig[selectedEvent.type].bg, typeConfig[selectedEvent.type].text)}>{typeConfig[selectedEvent.type].label}</Badge>
                <button onClick={() => setSelectedEvent(null)} className="text-muted-foreground hover:text-foreground">&times;</button>
              </div>
              <CardTitle className="mt-2">{selectedEvent.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />{selectedEvent.day}{selectedEvent.endDay !== selectedEvent.day ? ` - ${selectedEvent.endDay}` : ''} avril 2026</div>
              <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-muted-foreground" />{selectedEvent.time}</div>
              <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" />{selectedEvent.person}</div>
              {selectedEvent.location && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{selectedEvent.location}</div>}
              <div className="flex gap-2 pt-3 border-t">
                <Button size="sm" className="flex-1">Modifier</Button>
                <Button variant="outline" size="sm">Supprimer</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
