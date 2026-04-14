import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ClipboardCheck, AlertTriangle, Building2, FileText, ArrowRight, ChevronDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Progress } from '@/components/ui'
import { mockProjects, mockDiagnostics, mockActivity, statusLabels, statusColors } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  diagnostic: ClipboardCheck, project: ClipboardCheck, report: FileText, tender: FileText, building: Building2
}

const priorityCircleColors: Record<string, { bg: string; ring: string; text: string }> = {
  I: { bg: 'bg-red-500', ring: 'ring-red-200', text: 'text-white' },
  II: { bg: 'bg-orange-500', ring: 'ring-orange-200', text: 'text-white' },
  III: { bg: 'bg-green-500', ring: 'ring-green-200', text: 'text-white' },
}

export function Dashboard() {
  const [selectedDiag, setSelectedDiag] = useState<string>('all')

  const { items, label, diagId } = useMemo(() => {
    if (selectedDiag === 'all') {
      return { items: mockDiagnostics.flatMap(d => d.items), label: 'Tous les diagnostics', diagId: null }
    }
    const diag = mockDiagnostics.find(d => d.id === selectedDiag)
    const project = diag ? mockProjects.find(p => p.id === diag.projectId) : null
    return { items: diag?.items ?? [], label: project?.name ?? 'Diagnostic', diagId: diag?.id ?? null }
  }, [selectedDiag])

  const totalCost = items.reduce((s, i) => s + i.estimatedCost, 0)
  const pI = items.filter(i => i.priority === 'I')
  const pII = items.filter(i => i.priority === 'II')
  const pIII = items.filter(i => i.priority === 'III')

  const stateDistribution = [
    { name: 'Mauvais', value: items.filter(i => i.state === 'MAUVAIS').length, color: '#ef4444' },
    { name: 'Moyen', value: items.filter(i => i.state === 'MOYEN').length, color: '#fb923c' },
    { name: 'Bon', value: items.filter(i => i.state === 'BON').length, color: '#4ade80' },
    { name: 'Tres bon', value: items.filter(i => i.state === 'TRES_BON').length, color: '#22c55e' },
  ].filter(s => s.value > 0)

  const priorityData = [
    { name: 'I', fullName: 'Priorite I', count: pI.length, cost: pI.reduce((s, i) => s + i.estimatedCost, 0), color: '#ef4444' },
    { name: 'II', fullName: 'Priorite II', count: pII.length, cost: pII.reduce((s, i) => s + i.estimatedCost, 0), color: '#fb923c' },
    { name: 'III', fullName: 'Priorite III', count: pIII.length, cost: pIII.reduce((s, i) => s + i.estimatedCost, 0), color: '#22c55e' },
  ]

  const topCFC = [...items].sort((a, b) => b.estimatedCost - a.estimatedCost).slice(0, 6)

  const statCards = [
    { label: 'Elements diagnostiques', value: items.length, icon: ClipboardCheck, color: 'text-blue-600 bg-blue-50' },
    { label: 'Elements Priorite I', value: pI.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Cout total estime', value: formatCHF(totalCost), icon: Building2, color: 'text-green-600 bg-green-50' },
    { label: 'Rapports generes', value: selectedDiag === 'all' ? 2 : 1, icon: FileText, color: 'text-violet-600 bg-violet-50' },
  ]

  const diagOptions = mockDiagnostics.map(d => {
    const project = mockProjects.find(p => p.id === d.projectId)
    return { id: d.id, label: project?.name ?? d.id, city: project?.city ?? '', projectId: d.projectId }
  })

  // Get link to diagnostic item
  const getItemLink = (item: typeof items[0]) => {
    const diag = mockDiagnostics.find(d => d.items.some(i => i.id === item.id))
    if (diag) return `/app/diagnostic/${diag.id}/item/${item.id}`
    return '#'
  }

  // Get link to diagnostic editor
  const getDiagLink = () => {
    if (diagId) return `/app/diagnostic/${diagId}`
    return '/app/projects'
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm">Vue d'ensemble de vos diagnostics</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative">
            <select
              value={selectedDiag}
              onChange={e => setSelectedDiag(e.target.value)}
              className="h-10 w-full sm:w-auto pl-4 pr-10 rounded-lg border border-gray-200 bg-white text-sm font-medium appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] sm:min-w-[220px]"
            >
              <option value="all">Tous les diagnostics</option>
              {diagOptions.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label} - {opt.city}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
          <Link to="/app/projects/new" className="hidden sm:block">
            <Button>Nouveau diagnostic</Button>
          </Link>
        </div>
      </div>

      {selectedDiag !== 'all' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
          <ClipboardCheck className="h-4 w-4 text-blue-600" />
          <p className="text-sm text-blue-800 font-medium flex-1">Filtre actif : <strong>{label}</strong> - {items.length} elements</p>
          <button onClick={() => setSelectedDiag('all')} className="text-xs text-blue-600 font-medium hover:underline">Voir tous les diagnostics</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-6">
        {statCards.map((stat, i) => (
          <div key={stat.label} className="flex items-baseline gap-2 p-3 md:p-0 rounded-lg bg-white md:bg-transparent border md:border-0">
            <span className="text-base md:text-lg font-bold">{stat.value}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</span>
            {i < statCards.length - 1 && <span className="text-border ml-4 hidden md:inline">|</span>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4 md:space-y-6">

          {/* Couts par priorite - avec cercles */}
          <Card>
            <CardHeader><CardTitle>Couts par priorite</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={priorityData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v: number) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="fullName" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(value) => formatCHF(Number(value))} />
                  <Bar dataKey="cost" name="Cout estime" radius={[0, 6, 6, 0]}>
                    {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-end mt-4 pt-4 border-t">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Cout total</p>
                  <p className="text-xl font-bold">{formatCHF(totalCost)}</p>
                  <p className="text-xs text-muted-foreground">{items.length} elements</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Elements les plus couteux - cliquables */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Elements les plus couteux</CardTitle>
              {diagId && <Link to={getDiagLink()}><Button variant="ghost" size="sm">Ouvrir le diagnostic <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>}
            </CardHeader>
            <CardContent>
              {topCFC.length > 0 ? (
                <div className="space-y-2">
                  {topCFC.map((item, i) => {
                    const pc = priorityCircleColors[item.priority]
                    return (
                      <Link key={item.id} to={getItemLink(item)} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                        <div className={`h-7 w-7 rounded-full ${pc.bg} ring-2 ${pc.ring} flex items-center justify-center shrink-0`}>
                          <span className="text-[10px] font-bold text-white">{item.priority}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.cfcLabel}</p>
                          <p className="text-xs text-muted-foreground">CFC {item.cfcCode}</p>
                        </div>
                        <span className="font-bold text-sm">{formatCHF(item.estimatedCost)}</span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucun element diagnostique.</p>
              )}
            </CardContent>
          </Card>

          {/* Diagnostics recents - only global */}
          {selectedDiag === 'all' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Diagnostics recents</CardTitle>
                <Link to="/app/projects"><Button variant="ghost" size="sm">Voir tout <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockProjects.slice(0, 5).map(project => (
                    <Link key={project.id} to={`/app/projects/${project.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`h-2.5 w-2.5 rounded-full ${statusColors[project.status]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground">{project.address}, {project.city}</p>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">{statusLabels[project.status]}</Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Etat des elements */}
          <Card>
            <CardHeader><CardTitle>Etat des elements</CardTitle></CardHeader>
            <CardContent>
              {stateDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stateDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={3} dataKey="value">
                        {stateDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {stateDistribution.map(s => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name} ({s.value})
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnee.</p>
              )}
            </CardContent>
          </Card>

          {/* Alertes Priorite I - cliquables */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-red-500 ring-2 ring-red-200 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white">I</span>
                </div>
                Alertes Priorite I
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pI.length > 0 ? pI.map(item => (
                <Link key={item.id} to={getItemLink(item)} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50/50 border border-red-100 hover:bg-red-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.cfcLabel}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-red-600">{formatCHF(item.estimatedCost)}</p>
                    <ArrowRight className="h-3 w-3 text-red-300 ml-auto mt-1" />
                  </div>
                </Link>
              )) : (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune alerte Priorite I.</p>
              )}
            </CardContent>
          </Card>

          {/* Progression - only global */}
          {selectedDiag === 'all' && (
            <Card>
              <CardHeader><CardTitle>Progression</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {mockProjects.slice(0, 4).map(project => {
                  const diag = mockDiagnostics.find(d => d.projectId === project.id)
                  const status = diag ? (diag.status === 'COMPLETED' ? 'Termine' : 'En cours') : 'Non demarre'
                  const progress = diag ? (diag.status === 'COMPLETED' ? 100 : Math.round(diag.items.length / 15 * 100)) : 0
                  return (
                    <Link key={project.id} to={`/app/projects/${project.id}`} className="block hover:bg-muted/30 rounded-lg p-1 -m-1 transition-colors">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate flex-1 mr-2">{project.name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{status}</span>
                      </div>
                      <Progress value={progress} />
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Activite recente */}
          <Card>
            <CardHeader><CardTitle>Activite recente</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockActivity.slice(0, 5).map(act => {
                  const Icon = activityIcons[act.type] || ClipboardCheck
                  return (
                    <div key={act.id} className="flex items-start gap-3">
                      <div className="mt-0.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{act.description}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(act.date)}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
