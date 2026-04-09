import { useParams, Link } from 'react-router-dom'
import { ClipboardCheck, Plus } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { mockProjects, mockDiagnostics, stateLabels, stateColors, priorityColors } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'

export function ProjectDiagnostic() {
  const { id } = useParams()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]
  const diagnostic = mockDiagnostics.find(d => d.projectId === project.id)
  const totalDiag = diagnostic?.items.reduce((s, i) => s + i.estimatedCost, 0) ?? 0

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Diagnostic</h1>
          <p className="text-muted-foreground">{diagnostic.items.length} elements - Visite du {diagnostic.visitDate ? formatDate(diagnostic.visitDate) : 'Non planifiee'}</p>
        </div>
        <Link to={`/app/diagnostic/${diagnostic.id}`}>
          <Button><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir l'editeur</Button>
        </Link>
      </div>

      <Card>
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

      <div className="flex justify-end gap-8">
        {(['I', 'II', 'III'] as const).map(p => {
          const items = diagnostic.items.filter(i => i.priority === p)
          const total = items.reduce((s, i) => s + i.estimatedCost, 0)
          return <div key={p} className="text-right"><p className="text-xs text-muted-foreground">Priorite {p}</p><p className="font-bold">{formatCHF(total)}</p></div>
        })}
        <div className="text-right"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{formatCHF(totalDiag)}</p></div>
      </div>
    </div>
  )
}
