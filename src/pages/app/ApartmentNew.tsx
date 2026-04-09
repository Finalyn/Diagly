import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input } from '@/components/ui'
import { mockBuildings } from '@/data/mock'

export function ApartmentNew() {
  const { id } = useParams()
  const navigate = useNavigate()
  const building = mockBuildings.find(b => b.id === id) ?? mockBuildings[0]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Ajouter un appartement</h1>
          <p className="text-muted-foreground">{building.name}</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Informations de l'appartement</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium mb-1 block">Numero</label><Input placeholder="Ex: 2A" /></div>
            <div><label className="text-sm font-medium mb-1 block">Etage</label><Input type="number" placeholder="2" /></div>
            <div><label className="text-sm font-medium mb-1 block">Surface (m2)</label><Input type="number" placeholder="72" /></div>
            <div><label className="text-sm font-medium mb-1 block">Pieces</label><Input type="number" step="0.5" placeholder="3.5" /></div>
          </div>
          <div><label className="text-sm font-medium mb-1 block">Locataire actuel (optionnel)</label><Input placeholder="Nom du locataire" /></div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate(-1)}>Annuler</Button>
            <Button onClick={() => navigate(`/app/buildings/${building.id}`)}><Save className="mr-2 h-4 w-4" />Ajouter</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
