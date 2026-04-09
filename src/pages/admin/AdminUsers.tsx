import { Search, Plus, MoreHorizontal, Shield, Edit3, Trash2 } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Select, Avatar } from '@/components/ui'

const users = [
  { id: '1', name: 'Sophie Berger', email: 'sophie.berger@diagly-demo.ch', company: 'Berger & Fils SA', role: 'DT', plan: 'PRO', projects: 5, lastActive: '9 avril 2026' },
  { id: '2', name: 'Marc Dubois', email: 'marc.dubois@diagly-demo.ch', company: 'Dubois Architecture', role: 'ARCHITECT', plan: 'STUDIO', projects: 12, lastActive: '8 avril 2026' },
  { id: '3', name: 'Julie Favre', email: 'julie.favre@diagly-demo.ch', company: 'Regie Favre SA', role: 'REGIE', plan: 'PRO', projects: 8, lastActive: '7 avril 2026' },
  { id: '4', name: 'Pierre Muller', email: 'pierre.muller@diagly-demo.ch', company: 'Muller Bat Sarl', role: 'DT', plan: 'STARTER', projects: 2, lastActive: '5 avril 2026' },
  { id: '5', name: 'Anne Schneider', email: 'anne.schneider@diagly-demo.ch', company: 'Immobiliere Schneider', role: 'REGIE', plan: 'PRO', projects: 15, lastActive: '9 avril 2026' },
]

const roleLabels: Record<string, string> = { DT: 'Directeur travaux', ARCHITECT: 'Architecte', REGIE: 'Regie', ADMIN: 'Administrateur' }
const planColors: Record<string, string> = { STARTER: 'bg-gray-100 text-gray-800', PRO: 'bg-blue-100 text-blue-800', STUDIO: 'bg-violet-100 text-violet-800' }

export function AdminUsers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-primary" />
          <div><h1 className="text-2xl font-bold">Gestion des utilisateurs</h1><p className="text-muted-foreground">{users.length} utilisateurs inscrits</p></div>
        </div>
        <Button><Plus className="mr-2 h-4 w-4" />Ajouter un utilisateur</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un utilisateur..." className="pl-10" />
        </div>
        <Select className="w-40"><option>Tous les roles</option><option>DT</option><option>Architecte</option><option>Regie</option></Select>
        <Select className="w-40"><option>Tous les plans</option><option>Starter</option><option>Pro</option><option>Studio</option></Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Projets</TableHead>
                <TableHead>Derniere activite</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar name={user.name} size="sm" />
                      <div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></div>
                    </div>
                  </TableCell>
                  <TableCell>{user.company}</TableCell>
                  <TableCell><Badge variant="outline">{roleLabels[user.role]}</Badge></TableCell>
                  <TableCell><Badge className={planColors[user.plan]}>{user.plan}</Badge></TableCell>
                  <TableCell className="text-right">{user.projects}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.lastActive}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Edit3 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
