import { ClipboardCheck, Building2, FileText, ArrowRight, Plus, Calendar, Map, ListChecks } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui'
import { mockProjects, mockDiagnostics, mockActivity, statusLabels, statusColors, buildingTypeLabels } from '@/data/mock'
import { formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  diagnostic: ClipboardCheck, project: ClipboardCheck, report: FileText, tender: FileText, building: Building2
}

const shortcuts: { label: string; icon: React.ComponentType<{ className?: string }>; to: string }[] = [
  { label: 'Nouveau diagnostic', icon: Plus, to: '/app/projects/new' },
  { label: 'Mes diagnostics', icon: ClipboardCheck, to: '/app/projects' },
  { label: 'Calendrier', icon: Calendar, to: '/app/planning' },
  { label: 'Plans', icon: Map, to: '/app/plans' },
  { label: 'Parc immobilier', icon: Building2, to: '/app/buildings' },
  { label: 'CFC / Prix', icon: ListChecks, to: '/app/cfc' },
]

export function Dashboard() {
  const recentProjects = [...mockProjects].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 6)

  const recentItems = mockDiagnostics
    .flatMap(d => d.items.map(item => ({ item, diagId: d.id, project: mockProjects.find(p => p.id === d.projectId) })))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Tableau de bord</h1>
          <p className="text-muted-foreground text-sm">Acces rapide et activite recente</p>
        </div>
        <Link to="/app/projects/new" className="hidden sm:block">
          <Button><Plus className="mr-2 h-4 w-4" />Nouveau diagnostic</Button>
        </Link>
      </div>

      {/* Raccourcis */}
      <div className="flex flex-wrap gap-2">
        {shortcuts.map(s => {
          const Icon = s.icon
          return (
            <Link
              key={s.to}
              to={s.to}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white text-sm hover:border-primary/40 hover:bg-muted/50 transition-colors"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{s.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Diagnostics recents */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Diagnostics recents</CardTitle>
            <Link to="/app/projects"><Button variant="ghost" size="sm">Voir tout <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentProjects.map(project => (
                <Link key={project.id} to={`/app/projects/${project.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${statusColors[project.status]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{project.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {buildingTypeLabels[project.buildingType]} - {project.address}, {project.postalCode ? `${project.postalCode} ` : ''}{project.city}
                    </p>
                  </div>
                  <span className="hidden sm:block text-xs text-muted-foreground shrink-0">{formatDate(project.updatedAt)}</span>
                  <Badge variant="outline" className="text-xs shrink-0">{statusLabels[project.status]}</Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Activite recente */}
        <Card>
          <CardHeader><CardTitle>Activite recente</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockActivity.slice(0, 7).map(act => {
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

      {/* Elements diagnostique recents */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Derniers elements diagnostiques</CardTitle>
          <Link to="/app/projects"><Button variant="ghost" size="sm">Voir tout <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentItems.map(({ item, diagId, project }) => (
              <Link key={item.id} to={`/app/diagnostic/${diagId}/item/${item.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.cfcLabel}</p>
                  <p className="text-xs text-muted-foreground truncate">CFC {item.cfcCode} {project ? `- ${project.name}` : ''}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">Priorite {item.priority}</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
