import { useParams } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { mockProjects } from '@/data/mock'

export function ProjectCECB() {
  const { id } = useParams()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Estimation CECB</h1>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-8 mb-6">
            <div className="flex gap-1">
              {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(grade => (
                <div key={grade} className={`h-12 flex items-center justify-center text-white font-bold text-sm ${
                  grade === 'D' ? 'w-16 rounded' : 'w-10 rounded opacity-40'
                } ${
                  grade === 'A' ? 'bg-green-600' : grade === 'B' ? 'bg-green-500' : grade === 'C' ? 'bg-yellow-400' :
                  grade === 'D' ? 'bg-orange-400' : grade === 'E' ? 'bg-orange-500' : grade === 'F' ? 'bg-red-400' : 'bg-red-600'
                }`}>{grade}</div>
              ))}
            </div>
            <div>
              <p className="text-2xl font-bold">D</p>
              <p className="text-sm text-muted-foreground">Peu performant</p>
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <p className="text-sm text-orange-800 font-medium">Estimation indicative - non officielle</p>
            <p className="text-sm text-orange-700 mt-1">Basee sur l'annee de construction ({project.yearBuilt}), l'etat de l'enveloppe et le type de chauffage diagnostique.</p>
          </div>
          <div className="mt-4">
            <Button variant="outline"><Zap className="mr-2 h-4 w-4" />Demander un CECB officiel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
