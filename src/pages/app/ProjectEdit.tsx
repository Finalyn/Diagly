import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select } from '@/components/ui'
import { mockProjects } from '@/data/mock'

export function ProjectEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Modifier le projet</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
        <Button><Save className="mr-2 h-4 w-4" />Enregistrer</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations generales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-sm font-medium mb-1 block">Nom du projet</label>
              <Input defaultValue={project.name} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Adresse</label>
              <Input defaultValue={project.address} />
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
                <option value="LOGEMENT">Logement</option>
                <option value="SCOLAIRE">Scolaire</option>
                <option value="ADMINISTRATIF">Administratif</option>
                <option value="INDUSTRIEL">Industriel</option>
                <option value="HOTEL">Hotel</option>
                <option value="COMMERCIAL">Commercial</option>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Statut</label>
              <Select defaultValue={project.status}>
                <option value="CREATED">Cree</option>
                <option value="VISIT_PLANNED">Visite planifiee</option>
                <option value="DIAGNOSTIC_IN_PROGRESS">Diagnostic en cours</option>
                <option value="REPORT_DRAFT">Rapport brouillon</option>
                <option value="REPORT_DONE">Rapport termine</option>
                <option value="TENDER_OPEN">Appel d'offres</option>
                <option value="WORK_IN_PROGRESS">Travaux en cours</option>
                <option value="CLOSED">Cloture</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Dimensions et metres</CardTitle></CardHeader>
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
