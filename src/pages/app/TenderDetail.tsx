import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Send, Plus, FileText, Download, Check, Clock, Mail } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Input, Textarea, Select } from '@/components/ui'
import { mockTenders, mockProjects } from '@/data/mock'
import { formatCHF, formatDate } from '@/lib/utils'

export function TenderDetail() {
  const { id } = useParams()
  const tender = mockTenders.find(t => t.id === id) ?? mockTenders[0]
  const project = mockProjects.find(p => p.id === tender.projectId)
  const receivedCompanies = tender.companies.filter(c => c.amount !== undefined)
  const bestOffer = receivedCompanies.length > 0 ? receivedCompanies.reduce((min, c) => (c.amount! < min.amount! ? c : min)) : null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/app/projects/${tender.projectId}`}><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{tender.title}</h1>
            <Badge variant={tender.status === 'SENT' ? 'default' : tender.status === 'RECEIVED' ? 'default' : 'secondary'}>{tender.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{project?.name} - Cree le {formatDate(tender.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          {tender.status === 'DRAFT' && <Button><Send className="mr-2 h-4 w-4" />Envoyer</Button>}
          <Button variant="outline"><FileText className="mr-2 h-4 w-4" />Generer comparatif PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Entreprises sollicitees</p>
            <p className="text-2xl font-bold">{tender.companies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Devis recus</p>
            <p className="text-2xl font-bold">{receivedCompanies.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground">Meilleure offre</p>
            <p className="text-2xl font-bold text-green-600">{bestOffer ? formatCHF(bestOffer.amount!) : '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Comparatif des offres</CardTitle>
          <Button variant="outline" size="sm"><Plus className="mr-2 h-4 w-4" />Ajouter une entreprise</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-right">Ecart</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tender.companies.map(company => {
                const isBest = bestOffer?.id === company.id
                const ecart = company.amount && bestOffer?.amount ? ((company.amount - bestOffer.amount) / bestOffer.amount * 100) : null
                return (
                  <TableRow key={company.id} className={isBest ? 'bg-green-50/50' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{company.name}</span>
                        {isBest && <Badge className="bg-green-500 text-white text-[10px]">Meilleure offre</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{company.email}</TableCell>
                    <TableCell>
                      {company.status === 'received' ? (
                        <Badge className="bg-green-100 text-green-800"><Check className="mr-1 h-3 w-3" />Recu</Badge>
                      ) : (
                        <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />En attente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">{company.amount ? formatCHF(company.amount) : '-'}</TableCell>
                    <TableCell className="text-right">
                      {ecart !== null ? (
                        <span className={ecart === 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                          {ecart === 0 ? 'Ref.' : `+${ecart.toFixed(1)}%`}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Mail className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Description de l'appel d'offres</CardTitle></CardHeader>
        <CardContent>
          <Textarea defaultValue={`Appel d'offres pour ${tender.title}\n\nProjet : ${project?.name}\nAdresse : ${project?.address}, ${project?.city}\n\nMerci de nous faire parvenir votre meilleure offre.`} rows={6} />
        </CardContent>
      </Card>

      {tender.status === 'RECEIVED' && bestOffer && (
        <Card className="border-green-200 bg-green-50/30">
          <CardHeader><CardTitle>Attribuer le marche</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Selectionnez l'entreprise a laquelle attribuer ce lot.</p>
            <div className="flex gap-3">
              <Select className="flex-1">
                {receivedCompanies.map(c => <option key={c.id} value={c.id}>{c.name} - {formatCHF(c.amount!)}</option>)}
              </Select>
              <Button><Check className="mr-2 h-4 w-4" />Attribuer</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
