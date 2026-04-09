import { useParams, Link } from 'react-router-dom'
import { FileText, Download, Plus } from 'lucide-react'
import { Button, Card, Badge } from '@/components/ui'

export function ProjectRapports() {
  const { id } = useParams()

  const reports = [
    { id: 'rpt_1', name: 'Rapport diagnostic', type: 'DIAGNOSTIC', date: '20 mars 2026', status: 'Genere' },
    { id: 'rpt_2', name: 'Devis estimatif', type: 'DEVIS', date: '22 mars 2026', status: 'Brouillon' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rapports</h1>
        <div className="flex gap-2">
          <Button variant="outline"><Plus className="mr-2 h-4 w-4" />Rapport diagnostic</Button>
          <Button><Plus className="mr-2 h-4 w-4" />Devis estimatif</Button>
        </div>
      </div>

      <div className="space-y-3">
        {reports.map(r => (
          <Link key={r.id} to={`/app/reports/${r.id}`}>
            <Card className="hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4 p-5">
                <FileText className="h-10 w-10 text-red-500 shrink-0" />
                <div className="flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-muted-foreground">{r.type} - {r.date}</p>
                </div>
                <Badge variant={r.status === 'Genere' ? 'default' : 'secondary'}>{r.status}</Badge>
                <Button variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Telecharger</Button>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
