import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Download, Printer, Share2, FileText } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { mockProjects, mockDiagnostics, priorityColors, stateLabels } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'

export function ReportDetail() {
  const { id } = useParams()
  const project = mockProjects[0]
  const diagnostic = mockDiagnostics[0]
  const totalHT = diagnostic.items.reduce((s, i) => s + i.estimatedCost, 0)
  const honoraires = totalHT * (project.honoraryPct / 100)
  const reserve = (totalHT + honoraires) * (project.reservePct / 100)
  const tva = (totalHT + honoraires + reserve) * 0.081
  const totalTTC = totalHT + honoraires + reserve + tva

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/app/projects/${project.id}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Rapport diagnostic</h1>
          <p className="text-muted-foreground">{project.name} - Genere le {formatDate(new Date())}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><Share2 className="mr-2 h-4 w-4" />Partager</Button>
          <Button variant="outline"><Printer className="mr-2 h-4 w-4" />Imprimer</Button>
          <Button><Download className="mr-2 h-4 w-4" />Telecharger PDF</Button>
        </div>
      </div>

      {/* Preview rapport */}
      <Card className="overflow-hidden">
        <div className="bg-white p-12 space-y-8">
          {/* Page de garde */}
          <div className="text-center border-b pb-8">
            <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-3xl font-bold">Rapport de diagnostic</h2>
            <p className="text-lg text-muted-foreground mt-2">{project.name}</p>
            <p className="text-muted-foreground">{project.address}, {project.city} ({project.canton})</p>
            <div className="flex justify-center gap-8 mt-6 text-sm">
              <div><span className="text-muted-foreground">Date :</span> {formatDate(new Date())}</div>
              <div><span className="text-muted-foreground">Realise par :</span> Berger & Fils SA</div>
              <div><span className="text-muted-foreground">Reference :</span> DIAG-2026-001</div>
            </div>
          </div>

          {/* Resume */}
          <div>
            <h3 className="text-xl font-bold mb-4">1. Resume</h3>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-gray-50 text-center">
                <p className="text-sm text-muted-foreground">Elements diagnostiques</p>
                <p className="text-2xl font-bold">{diagnostic.items.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-red-50 text-center">
                <p className="text-sm text-red-600">Priorite I</p>
                <p className="text-2xl font-bold text-red-600">{diagnostic.items.filter(i => i.priority === 'I').length}</p>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 text-center">
                <p className="text-sm text-orange-600">Priorite II</p>
                <p className="text-2xl font-bold text-orange-600">{diagnostic.items.filter(i => i.priority === 'II').length}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 text-center">
                <p className="text-sm text-green-600">Priorite III</p>
                <p className="text-2xl font-bold text-green-600">{diagnostic.items.filter(i => i.priority === 'III').length}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground">Type :</span> {project.buildingType}</div>
              <div><span className="text-muted-foreground">Annee :</span> {project.yearBuilt}</div>
              <div><span className="text-muted-foreground">Etages :</span> {project.nbFloors}</div>
              <div><span className="text-muted-foreground">Surface plancher :</span> {project.floorArea} m2</div>
              <div><span className="text-muted-foreground">Surface facade :</span> {project.facadeArea} m2</div>
              <div><span className="text-muted-foreground">Appartements :</span> {project.nbApartments}</div>
            </div>
          </div>

          {/* Detail par element */}
          <div>
            <h3 className="text-xl font-bold mb-4">2. Detail par element CFC</h3>
            <div className="space-y-6">
              {diagnostic.items.map(item => (
                <div key={item.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="font-mono font-bold">{item.cfcCode}</span>
                    <span className="font-semibold">{item.cfcLabel}</span>
                    <Badge className={`${priorityColors[item.priority]} ml-auto`}>{item.priority}</Badge>
                    <span className="text-sm">{stateLabels[item.state]}</span>
                  </div>
                  {item.photos.length > 0 && (
                    <div className="flex gap-3 mb-3">
                      {item.photos.map((_, i) => (
                        <div key={i} className="h-24 w-36 rounded bg-muted border" />
                      ))}
                    </div>
                  )}
                  {item.notes && <p className="text-sm text-muted-foreground mb-2">{item.notes}</p>}
                  <div className="flex gap-2 mb-2">
                    {item.works.map((w, i) => <Badge key={i} variant="secondary" className="text-xs">{w}</Badge>)}
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t">
                    <span>{item.area ? `${item.area} ${item.unit}` : '-'} {item.yearInstalled ? `- Installe en ${item.yearInstalled}` : ''}</span>
                    <span className="font-bold">{formatCHF(item.estimatedCost)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recap financier */}
          <div>
            <h3 className="text-xl font-bold mb-4">3. Recapitulatif financier</h3>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Priorite</TableHead><TableHead>Elements</TableHead><TableHead className="text-right">Montant</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(['I', 'II', 'III'] as const).map(p => {
                  const items = diagnostic.items.filter(i => i.priority === p)
                  return (
                    <TableRow key={p}>
                      <TableCell><Badge className={priorityColors[p]}>Priorite {p}</Badge></TableCell>
                      <TableCell>{items.length} elements</TableCell>
                      <TableCell className="text-right font-semibold">{formatCHF(items.reduce((s, i) => s + i.estimatedCost, 0))}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="mt-4 space-y-2 max-w-sm ml-auto text-sm">
              <div className="flex justify-between"><span>Sous-total HT</span><span>{formatCHF(totalHT)}</span></div>
              <div className="flex justify-between"><span>Honoraires ({project.honoraryPct}%)</span><span>{formatCHF(honoraires)}</span></div>
              <div className="flex justify-between"><span>Reserve ({project.reservePct}%)</span><span>{formatCHF(reserve)}</span></div>
              <div className="flex justify-between"><span>TVA (8.1%)</span><span>{formatCHF(tva)}</span></div>
              <div className="flex justify-between text-lg font-bold border-t pt-2"><span>Total TTC</span><span>{formatCHF(totalTTC)}</span></div>
            </div>
          </div>

          {/* Mention */}
          <div className="text-center text-xs text-muted-foreground pt-6 border-t">
            Estimation indicative +/- 15% - Diagly - {formatDate(new Date())}
          </div>
        </div>
      </Card>
    </div>
  )
}
