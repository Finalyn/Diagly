import { Link } from 'react-router-dom'
import { Plus, Building2, MapPin, Calendar } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'
import { mockBuildings } from '@/data/mock'

export function BuildingsList() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parc immobilier</h1>
          <p className="text-muted-foreground">{mockBuildings.length} batiments</p>
        </div>
        <Link to="/app/buildings/new">
          <Button><Plus className="mr-2 h-4 w-4" />Ajouter un batiment</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {mockBuildings.map(building => (
          <Link key={building.id} to={`/app/buildings/${building.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{building.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{building.address}, {building.city}</span>
                      {building.yearBuilt && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{building.yearBuilt}</span>}
                    </div>
                    <div className="flex gap-3 mt-3">
                      <Badge variant="secondary">{building.apartments.length} appartements</Badge>
                      <Badge variant="outline">{building.apartments.filter(a => a.history.length > 0).length} avec historique</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
