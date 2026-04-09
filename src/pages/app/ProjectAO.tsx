import { useParams, Link } from 'react-router-dom'
import { Send, Plus } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui'
import { mockProjects, mockTenders } from '@/data/mock'
import { formatCHF } from '@/lib/utils'

export function ProjectAO() {
  const { id } = useParams()
  const project = mockProjects.find(p => p.id === id) ?? mockProjects[0]
  const tenders = mockTenders.filter(t => t.projectId === project.id)

  if (tenders.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Appels d'offres</h1>
        <Card>
          <CardContent className="py-16 text-center">
            <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">Aucun appel d'offres</h3>
            <p className="text-sm text-muted-foreground mb-4">Creez un appel d'offres pour comparer les devis.</p>
            <Button><Plus className="mr-2 h-4 w-4" />Nouvel appel d'offres</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Appels d'offres</h1>
        <Button><Plus className="mr-2 h-4 w-4" />Nouvel appel d'offres</Button>
      </div>

      {tenders.map(tender => (
        <Card key={tender.id}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{tender.title}</CardTitle>
              <Badge variant="secondary" className="mt-1">{tender.status}</Badge>
            </div>
            <Link to={`/app/tenders/${tender.id}`}>
              <Button variant="outline" size="sm">Voir le detail</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tender.companies.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email}</TableCell>
                    <TableCell className="text-right font-medium">{c.amount ? formatCHF(c.amount) : '-'}</TableCell>
                    <TableCell><Badge variant={c.status === 'received' ? 'default' : 'secondary'}>{c.status === 'received' ? 'Recu' : 'En attente'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
