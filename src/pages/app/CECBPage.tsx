import { Zap, Building2, ArrowRight } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Select } from '@/components/ui'
import { mockBuildings, mockProjects } from '@/data/mock'

const grades = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const
const gradeColors: Record<string, string> = { A: 'bg-green-600', B: 'bg-green-500', C: 'bg-yellow-400', D: 'bg-orange-400', E: 'bg-orange-500', F: 'bg-red-400', G: 'bg-red-600' }

const estimations = [
  { building: 'Residence du Lac', grade: 'D', year: 1972, city: 'Lausanne' },
  { building: 'Les Tilleuls', grade: 'E', year: 1985, city: 'Lausanne' },
  { building: 'Ecole des Paquis', grade: 'C', year: 1965, city: 'Geneve' },
  { building: 'Centre Numa Droz', grade: 'D', year: 1980, city: 'Neuchatel' },
]

export function CECBPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Estimations CECB</h1>
        <p className="text-muted-foreground">Certificat energetique cantonal des batiments - estimations indicatives</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {estimations.map(est => (
          <Card key={est.building} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <Building2 className="h-8 w-8 text-muted-foreground" />
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold ${gradeColors[est.grade]}`}>{est.grade}</div>
              </div>
              <h3 className="font-semibold">{est.building}</h3>
              <p className="text-sm text-muted-foreground">{est.city} - {est.year}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Nouvelle estimation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Batiment</label>
              <Select>
                <option>Selectionner un batiment</option>
                {mockBuildings.map(b => <option key={b.id}>{b.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Type de chauffage</label>
              <Select>
                <option>Mazout</option>
                <option>Gaz naturel</option>
                <option>Pompe a chaleur</option>
                <option>Pellets</option>
                <option>Chauffage a distance</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Etat enveloppe</label>
              <Select>
                <option>Non isole</option>
                <option>Partiellement isole</option>
                <option>Isole</option>
                <option>Tres bien isole</option>
              </Select>
            </div>
          </div>
          <Button><Zap className="mr-2 h-4 w-4" />Estimer le CECB</Button>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-orange-800 font-medium">Estimation indicative - non officielle</p>
            <p className="text-sm text-orange-700 mt-1">L'estimation CECB de Diagly est basee sur des criteres simplifies. Pour un certificat officiel, contactez un expert CECB agree.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Echelle CECB</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {grades.map(grade => (
              <div key={grade} className="flex-1">
                <div className={`h-12 flex items-center justify-center text-white font-bold text-lg rounded ${gradeColors[grade]}`}>{grade}</div>
                <p className="text-xs text-center text-muted-foreground mt-1">
                  {grade === 'A' ? 'Tres performant' : grade === 'B' ? 'Performant' : grade === 'C' ? 'Assez bon' : grade === 'D' ? 'Moyen' : grade === 'E' ? 'Peu performant' : grade === 'F' ? 'Mauvais' : 'Tres mauvais'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
