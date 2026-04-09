import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter } from 'lucide-react'
import { Button, Card, Badge, Input, Select } from '@/components/ui'
import { mockProjects, statusLabels, statusColors } from '@/data/mock'
import { formatCHF } from '@/lib/utils'

const tabs = ['Tous', 'En cours', 'Diagnostic', 'Appels d\'offres', 'Clotures'] as const

export function ProjectsList() {
  const [activeTab, setActiveTab] = useState<string>('Tous')
  const [search, setSearch] = useState('')

  const filtered = mockProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.city.toLowerCase().includes(search.toLowerCase())) return false
    if (activeTab === 'En cours') return ['DIAGNOSTIC_IN_PROGRESS', 'WORK_IN_PROGRESS', 'VISIT_PLANNED'].includes(p.status)
    if (activeTab === 'Diagnostic') return ['DIAGNOSTIC_IN_PROGRESS', 'REPORT_DRAFT', 'REPORT_DONE'].includes(p.status)
    if (activeTab === 'Appels d\'offres') return ['TENDER_OPEN', 'TENDER_CLOSED'].includes(p.status)
    if (activeTab === 'Clotures') return p.status === 'CLOSED'
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projets</h1>
          <p className="text-muted-foreground">{mockProjects.length} projets au total</p>
        </div>
        <Link to="/app/projects/new">
          <Button><Plus className="mr-2 h-4 w-4" />Nouveau projet</Button>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select className="w-48">
          <option>Tous les types</option>
          <option>Logement</option>
          <option>Scolaire</option>
          <option>Administratif</option>
          <option>Hotel</option>
        </Select>
        <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >{tab}</button>
        ))}
      </div>

      <div className="grid gap-4">
        {filtered.map(project => (
          <Link key={project.id} to={`/app/projects/${project.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex items-center p-4 gap-4">
                <div className={`h-full w-1.5 rounded-full self-stretch ${statusColors[project.status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold">{project.name}</h3>
                    <Badge variant="outline">{project.buildingType}</Badge>
                    <Badge className={`${statusColors[project.status]} text-white`}>{statusLabels[project.status]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{project.address}, {project.city} ({project.canton})</p>
                  <div className="flex gap-6 mt-2 text-sm text-muted-foreground">
                    {project.yearBuilt && <span>Construit en {project.yearBuilt}</span>}
                    {project.nbApartments !== undefined && project.nbApartments > 0 && <span>{project.nbApartments} appartements</span>}
                    {project.nbFloors && <span>{project.nbFloors} etages</span>}
                    {project.floorArea && <span>{project.floorArea} m2</span>}
                  </div>
                </div>
                <div className="text-right">
                  {project.totalBudget && <p className="text-lg font-bold">{formatCHF(project.totalBudget)}</p>}
                  <p className="text-xs text-muted-foreground">Budget estime</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
