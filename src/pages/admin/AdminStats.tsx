import { Shield, Users, FolderKanban, Building2, FileText, TrendingUp, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { formatCHF } from '@/lib/utils'

const stats = [
  { label: 'Utilisateurs', value: 47, icon: Users, color: 'text-blue-600 bg-blue-50', trend: '+12%' },
  { label: 'Projets actifs', value: 156, icon: FolderKanban, color: 'text-green-600 bg-green-50', trend: '+8%' },
  { label: 'Batiments geres', value: 89, icon: Building2, color: 'text-violet-600 bg-violet-50', trend: '+15%' },
  { label: 'Rapports generes', value: 342, icon: FileText, color: 'text-orange-600 bg-orange-50', trend: '+23%' },
]

const userGrowth = [
  { month: 'Oct', users: 18 }, { month: 'Nov', users: 22 }, { month: 'Dec', users: 27 },
  { month: 'Jan', users: 31 }, { month: 'Fev', users: 38 }, { month: 'Mar', users: 47 },
]

const planDistribution = [
  { name: 'Starter', value: 15, color: '#94a3b8' },
  { name: 'Pro', value: 24, color: '#3b82f6' },
  { name: 'Studio', value: 8, color: '#8b5cf6' },
]

const revenueData = [
  { month: 'Oct', revenue: 4200 }, { month: 'Nov', revenue: 5100 }, { month: 'Dec', revenue: 5800 },
  { month: 'Jan', revenue: 6900 }, { month: 'Fev', revenue: 8200 }, { month: 'Mar', revenue: 9850 },
]

const topUsers = [
  { name: 'Anne Schneider', projects: 15, reports: 28 },
  { name: 'Marc Dubois', projects: 12, reports: 22 },
  { name: 'Julie Favre', projects: 8, reports: 15 },
  { name: 'Sophie Berger', projects: 5, reports: 12 },
  { name: 'Pierre Muller', projects: 2, reports: 4 },
]

export function AdminStats() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div><h1 className="text-2xl font-bold">Statistiques globales</h1><p className="text-muted-foreground">Vue d'ensemble de la plateforme</p></div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><TrendingUp className="h-3 w-3" />{stat.trend} ce mois</p>
                </div>
                <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Croissance utilisateurs</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={userGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="users" stroke="#1e40af" strokeWidth={2} dot={{ fill: '#1e40af' }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Revenu mensuel (MRR)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCHF(Number(value))} />
                <Bar dataKey="revenue" name="Revenu" fill="#1e40af" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Repartition des plans</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {planDistribution.map(entry => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 mt-2">
              {planDistribution.map(p => (
                <div key={p.name} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name} ({p.value})
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Utilisateurs les plus actifs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topUsers.map((user, i) => (
                <div key={user.name} className="flex items-center gap-4">
                  <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="font-medium">{user.name}</p>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{user.projects} projets</span>
                      <span>{user.reports} rapports</span>
                    </div>
                  </div>
                  <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${(user.projects / topUsers[0].projects) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
