import { useParams, Link } from 'react-router-dom'
import { Ruler, Plus, Upload } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'

const mockProjectPlans = [
  { id: 'plan_1', name: 'Plan RDC', type: 'FLOOR', scale: '1:100' },
  { id: 'plan_2', name: 'Plan 1er etage', type: 'FLOOR', scale: '1:100' },
  { id: 'plan_3', name: 'Facade Nord', type: 'FACADE', scale: '1:100' },
]

export function ProjectPlans() {
  const { id } = useParams()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plans</h1>
        <Button><Upload className="mr-2 h-4 w-4" />Ajouter un plan</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {mockProjectPlans.map(plan => (
          <Link key={plan.id} to={`/app/plans/${plan.id}`}>
            <Card className="overflow-hidden hover:shadow-md transition-shadow group cursor-pointer">
              <div className="h-40 bg-muted flex items-center justify-center relative">
                <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 200 150">
                  <rect x="20" y="15" width="160" height="120" fill="none" stroke="#6b7280" strokeWidth="1.5" />
                  <rect x="20" y="15" width="80" height="60" fill="none" stroke="#6b7280" strokeWidth="0.5" />
                  <rect x="100" y="15" width="80" height="60" fill="none" stroke="#6b7280" strokeWidth="0.5" />
                </svg>
                <Ruler className="h-8 w-8 text-muted-foreground relative z-10" />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm flex-1">{plan.name}</p>
                  <Badge variant="outline" className="text-xs">{plan.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Echelle {plan.scale}</p>
              </div>
            </Card>
          </Link>
        ))}
        <button className="border-2 border-dashed rounded-lg flex flex-col items-center justify-center min-h-[220px] text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          <Plus className="h-8 w-8 mb-2" /><span className="text-sm">Ajouter un plan</span>
        </button>
      </div>
    </div>
  )
}
