import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { FolderKanban, AlertTriangle, Wallet, Zap, ClipboardCheck, FileText, ArrowRight, Building2, Send } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, Button, Progress } from '@/components/ui'
import { mockDashboardStats, mockBudgetChart, mockProjects, mockActivity, mockDiagnostics, statusLabels, statusColors, priorityColors } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

const statCards = [
  { label: 'Projets actifs', value: mockDashboardStats.activeProjects, icon: FolderKanban, color: 'text-blue-600 bg-blue-50' },
  { label: 'Priorite I urgents', value: mockDashboardStats.urgentItems, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { label: 'Budget total', value: formatCHF(mockDashboardStats.totalBudget), icon: Wallet, color: 'text-green-600 bg-green-50' },
  { label: 'CECB estimes', value: mockDashboardStats.cecbEstimated, icon: Zap, color: 'text-violet-600 bg-violet-50' },
]

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  diagnostic: ClipboardCheck, project: FolderKanban, report: FileText, tender: Send, building: Building2
}

export function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">Bienvenue, Sophie. Voici un apercu de votre activite.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Budget mensuel</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockBudgetChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v: number) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCHF(Number(value))} />
                  <Legend />
                  <Bar dataKey="previsionnel" name="Previsionnel" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="reel" name="Reel" fill="#1e40af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Projets recents</CardTitle>
              <Link to="/app/projects">
                <Button variant="ghost" size="sm">Voir tout <ArrowRight className="ml-1 h-4 w-4" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockProjects.map(project => (
                  <Link key={project.id} to={`/app/projects/${project.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className={`h-2 w-2 rounded-full ${statusColors[project.status]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground">{project.address}, {project.city} ({project.canton})</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{project.buildingType}</Badge>
                    <Badge variant="outline" className="text-xs">{statusLabels[project.status]}</Badge>
                    {project.totalBudget && <span className="text-sm font-medium">{formatCHF(project.totalBudget)}</span>}
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Travaux urgents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mockDiagnostics[0].items.filter(i => i.priority === 'I').map(item => (
                <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg border">
                  <span className={`mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.cfcLabel}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.notes}</p>
                    <p className="text-xs font-medium text-red-600 mt-1">{formatCHF(item.estimatedCost)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progression projets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockProjects.slice(0, 3).map(project => {
                const progress = project.status === 'CLOSED' ? 100 : project.status === 'DIAGNOSTIC_IN_PROGRESS' ? 35 : project.status === 'REPORT_DONE' ? 65 : project.status === 'TENDER_OPEN' ? 75 : 10
                return (
                  <div key={project.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium truncate">{project.name}</span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activite recente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockActivity.slice(0, 6).map(act => {
                  const Icon = activityIcons[act.type] || FolderKanban
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
