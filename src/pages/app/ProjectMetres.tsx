import { useParams } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { mockProjects, mockDiagnostics } from '@/data/mock'
import { formatCHF } from '@/lib/utils'

export function ProjectMetres() {
  const { id } = useParams()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]
  const diagnostic = mockDiagnostics.find(d => d.projectId === project.id)

  const totalHT = diagnostic?.items.reduce((s, i) => s + i.estimatedCost, 0) ?? 0
  const honoraires = totalHT * (project.honoraryPct / 100)
  const reserve = (totalHT + honoraires) * (project.reservePct / 100)
  const tva = (totalHT + honoraires + reserve) * 0.081
  const totalTTC = totalHT + honoraires + reserve + tva

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Couts et devis</h1>

      {diagnostic ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code CFC</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Unite</TableHead>
                  <TableHead className="text-right">Quantite</TableHead>
                  <TableHead className="text-right">Prix unitaire</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnostic.items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono">{item.cfcCode}</TableCell>
                    <TableCell>{item.cfcLabel}</TableCell>
                    <TableCell>{item.unit || '-'}</TableCell>
                    <TableCell className="text-right">{item.area || 1}</TableCell>
                    <TableCell className="text-right">{item.area ? formatCHF(Math.round(item.estimatedCost / item.area)) : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCHF(item.estimatedCost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Aucun diagnostic realise. Les couts seront disponibles apres le diagnostic.</CardContent></Card>
      )}

      {diagnostic && (
        <Card>
          <CardHeader><CardTitle>Recapitulatif financier</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-sm ml-auto">
              <div className="flex justify-between text-sm"><span>Sous-total HT</span><span className="font-medium">{formatCHF(totalHT)}</span></div>
              <div className="flex justify-between text-sm"><span>Honoraires ({project.honoraryPct}%)</span><span>{formatCHF(honoraires)}</span></div>
              <div className="flex justify-between text-sm"><span>Reserve ({project.reservePct}%)</span><span>{formatCHF(reserve)}</span></div>
              <div className="flex justify-between text-sm"><span>TVA (8.1%)</span><span>{formatCHF(tva)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Total TTC</span><span>{formatCHF(totalTTC)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
