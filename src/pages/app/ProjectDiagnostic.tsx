import { useParams, Link } from 'react-router-dom'
import { ClipboardCheck, Plus, AlertTriangle, Building2, ArrowRight } from 'lucide-react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Button, Card, CardHeader, CardTitle, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { mockProjects, mockDiagnostics, stateLabels, stateColors, priorityColors } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'

const priorityCircleColors: Record<string, { bg: string; ring: string }> = {
  I: { bg: 'bg-red-500', ring: 'ring-red-200' },
  II: { bg: 'bg-orange-500', ring: 'ring-orange-200' },
  III: { bg: 'bg-green-500', ring: 'ring-green-200' },
}

export function ProjectDiagnostic() {
  const { id } = useParams()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]
  const diagnostic = mockDiagnostics.find(d => d.projectId === project.id)
  const items = diagnostic?.items ?? []
  const totalDiag = items.reduce((s, i) => s + i.estimatedCost, 0)
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

  const topCFC = [...items].sort((a, b) => b.estimatedCost - a.estimatedCost).slice(0, 5)

  const statCards = [
    { label: 'Elements', value: items.length, icon: ClipboardCheck, color: 'text-blue-600 bg-blue-50' },
    { label: 'Priorite I', value: pI.length, icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { label: 'Cout estime', value: formatCHF(totalDiag), icon: Building2, color: 'text-green-600 bg-green-50' },
  ]

  if (!diagnostic) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-1">Aucun diagnostic</h3>
          <p className="text-sm text-muted-foreground mb-4">Commencez par effectuer un diagnostic du batiment.</p>
          <Button><Plus className="mr-2 h-4 w-4" />Demarrer un diagnostic</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Diagnostic</h1>
          <p className="text-muted-foreground text-sm">{diagnostic.items.length} elements - Visite du {diagnostic.visitDate ? formatDate(diagnostic.visitDate) : 'Non planifiee'}</p>
        </div>
        <Link to={`/app/diagnostic/${diagnostic.id}`}>
          <Button className="w-full sm:w-auto"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir l'editeur</Button>
        </Link>
      </div>

      {/* Stats inline */}
      <div className="grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-6">
        {statCards.map((stat, i) => (
          <div key={stat.label} className="flex items-baseline gap-2 p-3 md:p-0 rounded-lg bg-white md:bg-transparent border md:border-0">
            <span className="text-base md:text-lg font-bold">{stat.value}</span>
            <span className="text-[10px] md:text-xs text-muted-foreground">{stat.label}</span>
            {i < statCards.length - 1 && <span className="text-border ml-4 hidden md:inline">|</span>}
          </div>
        ))}
      </div>

      {/* Charts */}
      {items.length > 0 && (
        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Couts par priorite</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Etat des elements</CardTitle></CardHeader>
            <CardContent>
              {stateDistribution.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={stateDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                        {stateDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-2 mt-1">
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
        </div>
      )}

      {/* Top items */}
      {topCFC.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Elements les plus couteux</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {topCFC.map((item, i) => {
                const pc = priorityCircleColors[item.priority]
                return (
                  <Link key={item.id} to={`/app/diagnostic/${diagnostic.id}/item/${item.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="text-sm font-bold text-muted-foreground w-5">{i + 1}</span>
                    <div className={`h-7 w-7 rounded-full ${pc.bg} ring-2 ${pc.ring} flex items-center justify-center shrink-0`}>
                      <span className="text-[10px] font-bold text-white">{item.priority}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.cfcLabel}</p>
                      <p className="text-xs text-muted-foreground">CFC {item.cfcCode}</p>
                    </div>
                    <span className="font-bold text-sm">{formatCHF(item.estimatedCost)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile: cards layout */}
      <div className="md:hidden space-y-3">
        {diagnostic.items.map(item => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs text-muted-foreground">{item.cfcCode}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span>
              </div>
              <p className="font-medium text-sm mb-2">{item.cfcLabel}</p>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${stateColors[item.state]}`} />
                  <span className="text-muted-foreground">{stateLabels[item.state]}</span>
                </div>
                <span className="font-bold">{formatCHF(item.estimatedCost)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop: table layout */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code CFC</TableHead>
                <TableHead>Element</TableHead>
                <TableHead>Etat</TableHead>
                <TableHead>Priorite</TableHead>
                <TableHead>Quantite</TableHead>
                <TableHead className="text-right">Cout estime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagnostic.items.map(item => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-sm">{item.cfcCode}</TableCell>
                  <TableCell className="font-medium">{item.cfcLabel}</TableCell>
                  <TableCell><span className={`inline-block h-2.5 w-2.5 rounded-full ${stateColors[item.state]} mr-2`} />{stateLabels[item.state]}</TableCell>
                  <TableCell><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${priorityColors[item.priority]}`}>{item.priority}</span></TableCell>
                  <TableCell>{item.area ? `${item.area} ${item.unit}` : '-'}</TableCell>
                  <TableCell className="text-right font-medium">{formatCHF(item.estimatedCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-end gap-4 md:gap-8">
        {(['I', 'II', 'III'] as const).map(p => {
          const items = diagnostic.items.filter(i => i.priority === p)
          const total = items.reduce((s, i) => s + i.estimatedCost, 0)
          return <div key={p} className="text-right"><p className="text-xs text-muted-foreground">Priorite {p}</p><p className="font-bold text-sm md:text-base">{formatCHF(total)}</p></div>
        })}
        <div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="text-base md:text-lg font-bold">{formatCHF(totalDiag)}</p></div>
      </div>
    </div>
  )
}
