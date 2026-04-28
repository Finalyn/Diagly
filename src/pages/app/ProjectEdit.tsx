import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select } from '@/components/ui'
import { mockProjects, buildingTypeLabels, type BuildingType } from '@/data/mock'

const buildingTypeOrder: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET', 'SCOLAIRE', 'BUREAU', 'ADMINISTRATIF', 'INDUSTRIEL', 'HOTEL', 'COMMERCIAL', 'AUTRE']

export function ProjectEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Modifier le diagnostic</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
        <Button><Save className="mr-2 h-4 w-4" />Enregistrer</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations generales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Nom du diagnostic</label>
              <Input defaultValue={project.name} />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Adresse</label>
              <Input defaultValue={project.address} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Code postal</label>
              <Input defaultValue={project.postalCode ?? ''} placeholder="1006" maxLength={4} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Ville</label>
              <Input defaultValue={project.city} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Canton</label>
              <Select defaultValue={project.canton}>
                {['VD', 'GE', 'FR', 'NE', 'VS', 'BE', 'JU'].map(c => <option key={c}>{c}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Annee de construction</label>
              <Input type="number" defaultValue={project.yearBuilt} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Type de batiment</label>
              <Select defaultValue={project.buildingType}>
                {buildingTypeOrder.map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Statut</label>
              <Select defaultValue={project.status}>
                <option value="NON_PLANIFIE">Non planifie</option>
                <option value="PLANIFIE">Planifie</option>
                <option value="EN_COURS">En cours</option>
                <option value="EN_REVUE">En revue</option>
                <option value="TERMINE">Termine</option>
                <option value="ARCHIVE">Archive</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dimensions et surfaces</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre d'appartements</label>
              <Input type="number" defaultValue={project.nbApartments} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre d'etages</label>
              <Input type="number" defaultValue={project.nbFloors} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Hauteur d'etage (m)</label>
              <Input type="number" step="0.1" defaultValue={project.floorHeight} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Surface plancher (m2)</label>
              <Input type="number" defaultValue={project.floorArea} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Surface batie (m2)</label>
              <Input type="number" defaultValue={project.builtArea} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Surface facade (m2)</label>
              <Input type="number" defaultValue={project.facadeArea} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Surface terrain (m2)</label>
              <Input type="number" defaultValue={project.terrainArea} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Perimetre (ml)</label>
              <Input type="number" defaultValue={project.perimeter} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">% fenetres</label>
              <Input type="number" defaultValue={Math.round(project.windowPct * 100)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Parametres financiers</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Honoraires (%)</label>
              <Input type="number" defaultValue={project.honoraryPct} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Reserve (%)</label>
              <Input type="number" defaultValue={project.reservePct} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nombre de cages</label>
              <Input type="number" defaultValue={project.nbStaircases} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
        <Button onClick={() => navigate(`/app/projects/${project.id}`)}><Save className="mr-2 h-4 w-4" />Enregistrer les modifications</Button>
      </div>
    </div>
  )
}
