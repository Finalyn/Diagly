import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Home, Calendar, Wallet, Building2, Edit3 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Input, Select, Textarea } from '@/components/ui'
import { mockBuildings } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'
import { useState } from 'react'

export function ApartmentDetail() {
  const { id, aptId } = useParams()
  const navigate = useNavigate()
  const building = mockBuildings.find(b => b.id === id) ?? mockBuildings[0]
  const apt = building.apartments.find(a => a.id === aptId) ?? building.apartments[0]
  const [showForm, setShowForm] = useState(false)
  const [filterYear, setFilterYear] = useState('')
  const [filterCFC, setFilterCFC] = useState('')

  const totalCost = apt.history.reduce((s, h) => s + (h.cost ?? 0), 0)
  const filteredHistory = apt.history.filter(h => {
    if (filterYear && !h.date.getFullYear().toString().includes(filterYear)) return false
    if (filterCFC && h.cfcCode && !h.cfcCode.includes(filterCFC)) return false
    return true
  }).sort((a, b) => b.date.getTime() - a.date.getTime())

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/app/buildings/${building.id}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Appartement {apt.number}</h1>
            <Badge variant="secondary">{apt.floor}e etage</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{building.name} - {building.address}, {building.city}</p>
        </div>
        <Button variant="outline"><Edit3 className="mr-2 h-4 w-4" />Modifier</Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center"><Home className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Surface</p><p className="font-bold">{apt.area ? `${apt.area} m2` : '-'}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center"><Building2 className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Pieces</p><p className="font-bold">{apt.rooms ?? '-'}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center"><Calendar className="h-5 w-5 text-violet-600" /></div>
            <div><p className="text-xs text-muted-foreground">Interventions</p><p className="font-bold">{apt.history.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center"><Wallet className="h-5 w-5 text-orange-600" /></div>
            <div><p className="text-xs text-muted-foreground">Cout total</p><p className="font-bold">{formatCHF(totalCost)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-muted-foreground">Numero :</span> {apt.number}</div>
            <div><span className="text-muted-foreground">Etage :</span> {apt.floor}</div>
            <div><span className="text-muted-foreground">Surface :</span> {apt.area ? `${apt.area} m2` : 'Non renseignee'}</div>
            <div><span className="text-muted-foreground">Pieces :</span> {apt.rooms ?? 'Non renseigne'}</div>
            <div className="col-span-2"><span className="text-muted-foreground">Locataire :</span> {apt.tenant ?? 'Vacant'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Historique des travaux</CardTitle>
          <Button onClick={() => setShowForm(!showForm)}><Plus className="mr-2 h-4 w-4" />Ajouter une intervention</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5 space-y-3">
              <h4 className="font-semibold">Nouvelle intervention</h4>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-medium mb-1 block">Date</label><Input type="date" /></div>
                <div><label className="text-xs font-medium mb-1 block">Code CFC</label><Input placeholder="Ex: 511" /></div>
                <div className="col-span-2"><label className="text-xs font-medium mb-1 block">Description</label><Textarea placeholder="Description des travaux..." rows={2} /></div>
                <div><label className="text-xs font-medium mb-1 block">Cout (CHF)</label><Input type="number" placeholder="1500" /></div>
                <div><label className="text-xs font-medium mb-1 block">Entreprise</label><Input placeholder="Nom de l'entreprise" /></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
                <Button size="sm" onClick={() => setShowForm(false)}>Enregistrer</Button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Input placeholder="Filtrer par annee..." value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-40" />
            <Input placeholder="Filtrer par code CFC..." value={filterCFC} onChange={e => setFilterCFC(e.target.value)} className="w-40" />
          </div>

          {filteredHistory.length > 0 ? (
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-border" />
              {filteredHistory.map(h => (
                <div key={h.id} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-4 top-1.5 h-3 w-3 rounded-full bg-primary border-2 border-white" />
                  <div className="p-4 border rounded-lg ml-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{h.description}</p>
                        <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                          <span>{formatDate(h.date)}</span>
                          {h.cfcCode && <Badge variant="outline" className="text-xs">CFC {h.cfcCode}</Badge>}
                          {h.company && <span>{h.company}</span>}
                        </div>
                      </div>
                      {h.cost && <span className="font-bold text-lg">{formatCHF(h.cost)}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Aucune intervention enregistree.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
