import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
import { formatCHF } from '@/lib/utils'

/**
 * Graphiques de synthèse d'un diagnostic. Isolés dans leur propre module pour que
 * recharts (~375 Ko) soit chargé à la demande et non avec la page : la liste des
 * éléments s'affiche immédiatement, les courbes arrivent juste après.
 */
export interface PriorityDatum { name: string; fullName: string; count: number; cost: number; color: string }
export interface StateDatum { name: string; value: number; color: string }

export default function DiagnosticCharts({
  priorityData,
  stateDistribution,
}: {
  priorityData: PriorityDatum[]
  stateDistribution: StateDatum[]
}) {
  return (
    <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>Coûts par priorité</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={priorityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => `${v / 1000}k`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="fullName" tick={{ fontSize: 12 }} width={80} />
              <Tooltip formatter={(value) => formatCHF(Number(value))} />
              <Bar dataKey="cost" name="Coût estimé" radius={[0, 6, 6, 0]}>
                {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>État des éléments</CardTitle></CardHeader>
        <CardContent>
          {stateDistribution.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={stateDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {stateDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-2 mt-1">
                {stateDistribution.map(s => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name} ({s.value})
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune donnée.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
