import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ruler, Upload, Search, Filter, Building2, Eye, Download, Trash2, Plus } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select, Badge } from '@/components/ui'
import { mockProjects } from '@/data/mock'
import { cn } from '@/lib/utils'

const mockPlans = [
  { id: 'plan_1', name: 'Plan RDC', project: 'Residence du Lac', projectId: 'prj_1', type: 'FLOOR', scale: '1:100', date: '15 mars 2026', measures: 8, annotations: 4 },
  { id: 'plan_2', name: 'Plan 1er etage', project: 'Residence du Lac', projectId: 'prj_1', type: 'FLOOR', scale: '1:100', date: '15 mars 2026', measures: 5, annotations: 2 },
  { id: 'plan_3', name: 'Facade Nord', project: 'Residence du Lac', projectId: 'prj_1', type: 'FACADE', scale: '1:100', date: '18 mars 2026', measures: 3, annotations: 1 },
  { id: 'plan_4', name: 'Plan RDC', project: 'Ecole primaire des Paquis', projectId: 'prj_2', type: 'FLOOR', scale: '1:200', date: '5 dec 2025', measures: 12, annotations: 6 },
  { id: 'plan_5', name: 'Coupe A-A', project: 'Ecole primaire des Paquis', projectId: 'prj_2', type: 'SECTION', scale: '1:100', date: '5 dec 2025', measures: 4, annotations: 0 },
  { id: 'plan_6', name: 'Plan sous-sol', project: 'Immeuble Grand-Rue', projectId: 'prj_3', type: 'FLOOR', scale: '1:100', date: '20 fev 2026', measures: 6, annotations: 3 },
  { id: 'plan_7', name: 'Plan site', project: 'Hotel Beau-Rivage', projectId: 'prj_4', type: 'SITE', scale: '1:500', date: '1 mars 2026', measures: 2, annotations: 1 },
  { id: 'plan_8', name: 'Facade Est', project: 'Immeuble Grand-Rue', projectId: 'prj_3', type: 'FACADE', scale: '1:100', date: '22 fev 2026', measures: 7, annotations: 5 },
]

const typeLabels: Record<string, string> = { FLOOR: 'Etage', FACADE: 'Facade', SECTION: 'Coupe', SITE: 'Site', OTHER: 'Autre' }
const typeColors: Record<string, string> = { FLOOR: 'bg-blue-100 text-blue-800', FACADE: 'bg-green-100 text-green-800', SECTION: 'bg-orange-100 text-orange-800', SITE: 'bg-violet-100 text-violet-800', OTHER: 'bg-gray-100 text-gray-800' }

export function PlansList() {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filtered = mockPlans.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.project.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && p.type !== filterType) return false
    if (filterProject && p.projectId !== filterProject) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plans</h1>
          <p className="text-muted-foreground">{mockPlans.length} plans importes</p>
        </div>
        <Button><Upload className="mr-2 h-4 w-4" />Importer un plan PDF</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un plan..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select className="w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="FLOOR">Etage</option>
          <option value="FACADE">Facade</option>
          <option value="SECTION">Coupe</option>
          <option value="SITE">Site</option>
        </Select>
        <Select className="w-52" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
          <option value="">Tous les diagnostics</option>
          {mockProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <div className="flex bg-muted p-0.5 rounded-lg">
          <button onClick={() => setViewMode('grid')} className={cn('px-2 py-1 rounded text-xs', viewMode === 'grid' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Grille</button>
          <button onClick={() => setViewMode('list')} className={cn('px-2 py-1 rounded text-xs', viewMode === 'list' ? 'bg-background shadow-sm' : 'text-muted-foreground')}>Liste</button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(plan => (
            <Link key={plan.id} to={`/app/plans/${plan.id}`}>
              <Card className="overflow-hidden hover:shadow-md transition-shadow group">
                <div className="h-36 bg-muted flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-gray-100">
                    {/* Mini plan preview */}
                    <svg className="w-full h-full opacity-20" viewBox="0 0 200 150">
                      <rect x="20" y="15" width="160" height="120" fill="none" stroke="#6b7280" strokeWidth="1.5" />
                      <rect x="20" y="15" width="80" height="60" fill="none" stroke="#6b7280" strokeWidth="0.5" />
                      <rect x="100" y="15" width="80" height="60" fill="none" stroke="#6b7280" strokeWidth="0.5" />
                      <rect x="20" y="75" width="100" height="60" fill="none" stroke="#6b7280" strokeWidth="0.5" />
                      <rect x="120" y="75" width="60" height="60" fill="none" stroke="#6b7280" strokeWidth="0.5" />
                    </svg>
                  </div>
                  <Ruler className="h-8 w-8 text-muted-foreground relative z-10" />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button className="h-7 w-7 rounded bg-white/90 shadow flex items-center justify-center"><Eye className="h-3.5 w-3.5" /></button>
                    <button className="h-7 w-7 rounded bg-white/90 shadow flex items-center justify-center"><Download className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate flex-1">{plan.name}</p>
                    <Badge className={cn('text-[10px]', typeColors[plan.type])}>{typeLabels[plan.type]}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{plan.project}</p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span>{plan.scale}</span>
                    <span>{plan.measures} mesures</span>
                    <span>{plan.annotations} annot.</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          <button className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[220px] text-muted-foreground hover:border-primary hover:text-primary transition-colors">
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-sm font-medium">Ajouter un plan</span>
          </button>
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map(plan => (
                <Link key={plan.id} to={`/app/plans/${plan.id}`} className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Ruler className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{plan.name}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />{plan.project}</p>
                  </div>
                  <Badge className={cn('text-xs', typeColors[plan.type])}>{typeLabels[plan.type]}</Badge>
                  <span className="text-xs text-muted-foreground">{plan.scale}</span>
                  <span className="text-xs text-muted-foreground">{plan.measures} mesures</span>
                  <span className="text-xs text-muted-foreground">{plan.date}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
