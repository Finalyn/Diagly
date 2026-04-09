import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Select } from '@/components/ui'

export function BuildingNew() {
  const navigate = useNavigate()
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="text-2xl font-bold">Ajouter un batiment</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Informations du batiment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><label className="text-sm font-medium mb-1 block">Nom du batiment</label><Input placeholder="Ex: Residence du Lac" /></div>
          <div><label className="text-sm font-medium mb-1 block">Adresse</label><Input placeholder="Av. de Cour 42" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Ville</label><Input placeholder="Lausanne" /></div>
            <div><label className="text-sm font-medium mb-1 block">Annee de construction</label><Input type="number" placeholder="1972" /></div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
            <Button onClick={() => navigate('/app/buildings')}><Save className="mr-2 h-4 w-4" />Creer le batiment</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
