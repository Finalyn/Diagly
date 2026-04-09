import { User, Users, Database, Link2, CreditCard, Bell } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Input, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui'
import { mockUser } from '@/data/mock'

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Parametres</h1>
        <p className="text-muted-foreground">Gerez votre compte et vos preferences.</p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="cfc">CFC</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="billing">Facturation</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Informations personnelles</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium mb-1 block">Prenom</label><Input defaultValue={mockUser.firstName} /></div>
                <div><label className="text-sm font-medium mb-1 block">Nom</label><Input defaultValue={mockUser.lastName} /></div>
                <div><label className="text-sm font-medium mb-1 block">Email</label><Input defaultValue={mockUser.email} /></div>
                <div><label className="text-sm font-medium mb-1 block">Telephone</label><Input defaultValue={mockUser.phone} /></div>
                <div className="col-span-2"><label className="text-sm font-medium mb-1 block">Entreprise</label><Input defaultValue={mockUser.companyName} /></div>
              </div>
              <Button>Sauvegarder</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Membres de l'equipe</CardTitle>
              <Button>Inviter un membre</Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Sophie Berger', email: 'sophie.berger@diagly-demo.ch', role: 'Administrateur' },
                  { name: 'Marc Dubois', email: 'marc.dubois@diagly-demo.ch', role: 'Directeur de travaux' },
                  { name: 'Julie Favre', email: 'julie.favre@diagly-demo.ch', role: 'Architecte' },
                ].map(m => (
                  <div key={m.email} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">{m.name.split(' ').map(n => n[0]).join('')}</div>
                    <div className="flex-1"><p className="font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.email}</p></div>
                    <Badge variant="secondary">{m.role}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cfc">
          <Card>
            <CardHeader><CardTitle>Codes CFC personnalises</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Vous pouvez personnaliser les prix unitaires des codes CFC pour les adapter a votre region et vos fournisseurs.</p>
              <Button variant="outline">Gerer les codes CFC</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader><CardTitle>Integrations</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Geoplanet (geo.admin.ch)', desc: 'Recherche de parcelles et surfaces terrain', connected: true },
                { name: 'Stripe', desc: 'Gestion des abonnements et paiements', connected: true },
                { name: 'SMTP Email', desc: 'Envoi de notifications et rapports', connected: false },
              ].map(i => (
                <div key={i.name} className="flex items-center gap-4 p-4 border rounded-lg">
                  <Link2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1"><p className="font-medium">{i.name}</p><p className="text-sm text-muted-foreground">{i.desc}</p></div>
                  <Badge variant={i.connected ? 'default' : 'secondary'}>{i.connected ? 'Connecte' : 'Non connecte'}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader><CardTitle>Abonnement</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { name: 'Starter', price: '49', features: ['5 projets', '1 utilisateur', 'Rapports PDF'], current: false },
                  { name: 'Pro', price: '129', features: ['Projets illimites', '5 utilisateurs', 'CRM batiments', 'CECB'], current: true },
                  { name: 'Studio', price: '290', features: ['Tout Pro', 'Utilisateurs illimites', 'API', 'Support prioritaire'], current: false },
                ].map(plan => (
                  <div key={plan.name} className={`p-6 rounded-lg border-2 ${plan.current ? 'border-primary bg-primary/5' : 'border-muted'}`}>
                    {plan.current && <Badge className="mb-2">Plan actuel</Badge>}
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-2xl font-bold mt-2">{plan.price} <span className="text-sm font-normal text-muted-foreground">CHF/mois</span></p>
                    <ul className="mt-4 space-y-2">
                      {plan.features.map(f => <li key={f} className="text-sm flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" />{f}</li>)}
                    </ul>
                    <Button variant={plan.current ? 'outline' : 'default'} className="w-full mt-4">{plan.current ? 'Gerer' : 'Choisir'}</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Preferences de notification</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Nouveau devis recu', desc: 'Quand une entreprise repond a un appel d\'offres' },
                { label: 'Rapport genere', desc: 'Quand un rapport PDF est pret' },
                { label: 'Rappel de visite', desc: '24h avant une visite planifiee' },
                { label: 'Modifications equipe', desc: 'Quand un membre modifie un diagnostic' },
              ].map(n => (
                <div key={n.label} className="flex items-center justify-between p-3 border rounded-lg">
                  <div><p className="font-medium text-sm">{n.label}</p><p className="text-xs text-muted-foreground">{n.desc}</p></div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" defaultChecked className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                  </label>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
