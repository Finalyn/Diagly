import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Building2, MapPin, Calendar, Plus, Home } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Tabs, TabsList, TabsTrigger, TabsContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Progress } from '@/components/ui'
import { mockBuildings, mockProjects } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'

export function BuildingDetail() {
  const { id } = useParams()
  const building = mockBuildings.find(b => b.id === id) ?? mockBuildings[0]
  const linkedProjects = mockProjects.filter(p => p.address.includes(building.address.split(' ')[0]))

  const totalHistoryCost = building.apartments.flatMap(a => a.history).reduce((s, h) => s + (h.cost ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/app/buildings"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{building.name}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{building.address}, {building.city}</span>
            {building.yearBuilt && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{building.yearBuilt}</span>}
            <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />{building.apartments.length} appartements</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="apartments">Appartements</TabsTrigger>
          <TabsTrigger value="projects">Diagnostics lies</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Statistiques</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Appartements</span><span className="font-semibold">{building.apartments.length}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Surface totale</span><span className="font-semibold">{building.apartments.reduce((s, a) => s + (a.area ?? 0), 0)} m2</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Total interventions</span><span className="font-semibold">{building.apartments.flatMap(a => a.history).length}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Cout total travaux</span><span className="font-bold">{formatCHF(totalHistoryCost)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Etat parties communes</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Facade', value: 60 },
                  { label: 'Toiture', value: 40 },
                  { label: 'Hall / escaliers', value: 75 },
                  { label: 'Ascenseur', value: 85 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1"><span>{item.label}</span><span className="text-muted-foreground">{item.value}%</span></div>
                    <Progress value={item.value} />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Estimation CECB</CardTitle></CardHeader>
              <CardContent>
                <div className="flex gap-1 mb-3">
                  {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(grade => (
                    <div key={grade} className={`h-8 flex-1 flex items-center justify-center text-white font-bold text-xs rounded ${grade === 'E' ? 'ring-2 ring-offset-1 ring-orange-500' : 'opacity-40'} ${
                      grade === 'A' ? 'bg-green-600' : grade === 'B' ? 'bg-green-500' : grade === 'C' ? 'bg-yellow-400' :
                      grade === 'D' ? 'bg-orange-400' : grade === 'E' ? 'bg-orange-500' : grade === 'F' ? 'bg-red-400' : 'bg-red-600'
                    }`}>{grade}</div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">Estimation indicative - non officielle</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="apartments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Appartements ({building.apartments.length})</CardTitle>
              <Button><Plus className="mr-2 h-4 w-4" />Ajouter</Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Etage</TableHead>
                    <TableHead>Surface</TableHead>
                    <TableHead>Pieces</TableHead>
                    <TableHead>Locataire</TableHead>
                    <TableHead>Interventions</TableHead>
                    <TableHead className="text-right">Cout travaux</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {building.apartments.map(apt => (
                    <TableRow key={apt.id} className="cursor-pointer">
                      <TableCell className="font-semibold">{apt.number}</TableCell>
                      <TableCell>{apt.floor}e</TableCell>
                      <TableCell>{apt.area ? `${apt.area} m2` : '-'}</TableCell>
                      <TableCell>{apt.rooms ?? '-'}</TableCell>
                      <TableCell>{apt.tenant ?? '-'}</TableCell>
                      <TableCell><Badge variant="secondary">{apt.history.length}</Badge></TableCell>
                      <TableCell className="text-right font-medium">{formatCHF(apt.history.reduce((s, h) => s + (h.cost ?? 0), 0))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card>
            <CardHeader><CardTitle>Diagnostics lies</CardTitle></CardHeader>
            <CardContent>
              {linkedProjects.length > 0 ? linkedProjects.map(p => (
                <Link key={p.id} to={`/app/projects/${p.id}`} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1"><p className="font-medium">{p.name}</p><p className="text-sm text-muted-foreground">{p.buildingType} - {p.yearBuilt}</p></div>
                  <Badge variant="outline">{p.status}</Badge>
                </Link>
              )) : <p className="text-muted-foreground py-8 text-center">Aucun diagnostic lie a ce batiment.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Historique des travaux</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {building.apartments.flatMap(apt => apt.history.map(h => ({ ...h, aptNumber: apt.number }))).sort((a, b) => b.date.getTime() - a.date.getTime()).map(h => (
                  <div key={h.id} className="flex items-start gap-4 p-3 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{h.aptNumber}</div>
                    <div className="flex-1">
                      <p className="font-medium">{h.description}</p>
                      <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                        <span>{formatDate(h.date)}</span>
                        {h.cfcCode && <Badge variant="outline" className="text-xs">CFC {h.cfcCode}</Badge>}
                        {h.company && <span>{h.company}</span>}
                      </div>
                    </div>
                    {h.cost && <span className="font-semibold">{formatCHF(h.cost)}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
