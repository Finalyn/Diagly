import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter } from 'lucide-react'
import { Button, Card, Badge, Input, Select } from '@/components/ui'
import { mockProjects, statusLabels, statusColors } from '@/data/mock'
import { formatCHF } from '@/lib/utils'

const tabs = ['Tous', 'En cours', 'Diagnostic', 'Rapports', 'Clotures'] as const

export function ProjectsList() {
  const [activeTab, setActiveTab] = useState<string>('Tous')
  const [search, setSearch] = useState('')

  const filtered = mockProjects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.city.toLowerCase().includes(search.toLowerCase())) return false
    if (activeTab === 'En cours') return ['EN_COURS', 'PLANIFIE'].includes(p.status)
    if (activeTab === 'Diagnostic') return ['EN_COURS', 'EN_REVUE'].includes(p.status)
    if (activeTab === 'Rapports') return ['EN_REVUE', 'TERMINE'].includes(p.status)
    if (activeTab === 'Clotures') return p.status === 'ARCHIVE'
    return true
  })

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Diagnostics</h1>
          <p className="text-muted-foreground text-sm">{mockProjects.length} diagnostics au total</p>
        </div>
        <Link to="/app/projects/new">
          <Button className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nouveau diagnostic</Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Select className="flex-1 sm:w-48">
            <option>Tous les types</option>
            <option>Logement</option>
            <option>Scolaire</option>
            <option>Administratif</option>
            <option>Hotel</option>
          </Select>
          <Button variant="outline" size="icon" className="shrink-0"><Filter className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex gap-1 bg-muted p-1 rounded-lg overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 md:px-4 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >{tab}</button>
        ))}
      </div>

      <div className="grid gap-3 md:gap-4">
        {filtered.map(project => (
          <Link key={project.id} to={`/app/projects/${project.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center p-4 gap-3 sm:gap-4">
                <div className={`hidden sm:block h-full w-1.5 rounded-full self-stretch ${statusColors[project.status]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <div className={`sm:hidden h-2 w-2 rounded-full ${statusColors[project.status]}`} />
                    <h3 className="font-semibold text-sm md:text-base">{project.name}</h3>
                    <Badge variant="outline" className="text-[10px] md:text-xs">{project.buildingType}</Badge>
                    <Badge className={`${statusColors[project.status]} text-white text-[10px] md:text-xs`}>{statusLabels[project.status]}</Badge>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">{project.address}, {project.city} ({project.canton})</p>
                  <div className="flex flex-wrap gap-3 md:gap-6 mt-2 text-xs md:text-sm text-muted-foreground">
                    {project.yearBuilt && <span>Construit en {project.yearBuilt}</span>}
                    {project.nbApartments !== undefined && project.nbApartments > 0 && <span>{project.nbApartments} appts</span>}
                    {project.nbFloors && <span>{project.nbFloors} etages</span>}
                    {project.floorArea && <span>{project.floorArea} m2</span>}
                  </div>
                </div>
                {project.totalBudget && (
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-base md:text-lg font-bold">{formatCHF(project.totalBudget)}</p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Budget estime</p>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
