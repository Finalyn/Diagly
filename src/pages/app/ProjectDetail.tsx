import { useParams } from 'react-router-dom'
import { MapPin, Calendar, Building2, Edit3 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Progress } from '@/components/ui'
import { mockProjects, mockDiagnostics, statusLabels, statusColors } from '@/data/mock'
import { formatCHF } from '@/lib/utils'
import { computeProjectMetrics } from '@/lib/formulas'
import { Link } from 'react-router-dom'

export function ProjectDetail() {
  const { id } = useParams()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]
  const diagnostic = mockDiagnostics.find(d => d.projectId === project.id)
  const metrics = computeProjectMetrics({
    perimeter: project.perimeter ?? 0, nbFloors: project.nbFloors ?? 1, floorHeight: project.floorHeight ?? 2.7,
    builtArea: project.builtArea ?? 0, floorArea: project.floorArea ?? 0, facadeArea: project.facadeArea,
    windowPct: project.windowPct, nbApartments: project.nbApartments ?? 0,
  })

  const totalDiag = diagnostic?.items.reduce((s, i) => s + i.estimatedCost, 0) ?? 0
  const honoraires = totalDiag * (project.honoraryPct / 100)
  const reserve = (totalDiag + honoraires) * (project.reservePct / 100)
  const tva = (totalDiag + honoraires + reserve) * 0.081
  const totalTTC = totalDiag + honoraires + reserve + tva

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold">{project.name}</h1>
            <Badge className={`${statusColors[project.status]} text-white`}>{statusLabels[project.status]}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs md:text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{project.address}, {project.city} ({project.canton})</span>
            {project.yearBuilt && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{project.yearBuilt}</span>}
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{project.buildingType}</span>
          </div>
        </div>
        <Link to={`/app/projects/${project.id}/edit`} className="shrink-0"><Button variant="outline" className="w-full sm:w-auto"><Edit3 className="mr-2 h-4 w-4" />Modifier</Button></Link>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Surfaces calculees</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Surface plancher', v: `${project.floorArea} m2` },
                { l: 'Surface batie', v: `${project.builtArea} m2` },
                { l: 'Facade', v: `${metrics.facade.toFixed(0)} m2` },
                { l: 'Fenetres', v: `${metrics.windows.toFixed(0)} m2` },
                { l: 'Toiture plate', v: `${metrics.flatRoof.toFixed(0)} m2` },
                { l: 'Echafaudage', v: `${metrics.scaffolding.toFixed(0)} m2` },
              ].map(m => (
                <div key={m.l} className="flex justify-between p-2 rounded bg-muted/50 text-sm">
                  <span className="text-muted-foreground">{m.l}</span>
                  <span className="font-medium">{m.v}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Progression</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: 'Diagnostic', progress: diagnostic ? (diagnostic.status === 'COMPLETED' ? 100 : 60) : 0 },
              { label: 'Rapport', progress: project.status === 'TERMINE' ? 100 : project.status === 'EN_REVUE' ? 50 : 0 },
              { label: 'Couts', progress: diagnostic ? 80 : 0 },
            ].map(p => (
              <div key={p.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{p.label}</span><span className="text-muted-foreground">{p.progress}%</span>
                </div>
                <Progress value={p.progress} />
              </div>
            ))}
            <div className="pt-4 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Budget estime</span>
                <span className="text-xl font-bold">{formatCHF(totalTTC)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Appartements', value: project.nbApartments ?? '-' },
          { label: 'Etages', value: project.nbFloors ?? '-' },
          { label: 'Terrain', value: project.terrainArea ? `${project.terrainArea} m2` : '-' },
          { label: 'Parcelle', value: project.parcelNumber ?? '-' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold mt-1">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
