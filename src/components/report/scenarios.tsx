/**
 * Scénarios de rénovation : types partagés et tableau comparatif.
 *
 * Le calcul des trois scénarios vit dans la page des rapports, parce qu'il sert
 * aussi bien au sélecteur qu'aux documents. Les formes qu'il produit sont ici,
 * pour que le rapport sommaire et le rapport par scénario parlent du même objet.
 */
import { Leaf } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { stateLabels } from '@/data/mock'

export type ScenarioId = 'maintenance' | 'renovation' | 'energetique'

/** Forfait de scénario : estimé depuis la géométrie, hors éléments diagnostiqués. */
export interface RPack { label: string; basis: string; amount: number }

export interface RVariant {
  id: ScenarioId; name: string; envelopes: string[]; energyFocus: boolean
  packs: RPack[]
  ht: number; honoraires: number; reserve: number; sousTotal: number; tva: number; total: number
}

export type RItem = {
  id: string; cfcCode: string; cfcLabel: string; state: keyof typeof stateLabels | null
  priority: string | null; estimatedCost: string | null; improvementCost: string | null; normsCost: string | null
}

/** Tableau comparatif compact des 3 scénarios (utilisé dans le rapport sommaire). */
export function VariantsCompare({ variants, energyClass }: { variants: RVariant[]; energyClass: string | null }) {
  const v0 = variants[0]
  return (
    <div>
      <table className="doc-tableau w-full">
        <colgroup>
          <col />
          {variants.map((v) => <col key={v.id} style={{ width: '34mm' }} />)}
        </colgroup>
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Poste</th>
            {variants.map(v => <th key={v.id} className="py-1.5 text-right font-medium">{v.name}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="py-1 text-muted-foreground">Périmètre</td>{variants.map(v => <td key={v.id} className="py-1 text-right text-muted-foreground">{v.envelopes.join(' + ')}</td>)}</tr>
          <tr className="border-b"><td className="py-1">Travaux (HT)</td>{variants.map(v => <td key={v.id} className="py-1 text-right tabular-nums">{formatCHF(v.ht)}</td>)}</tr>
          <tr className="border-t-2 font-bold"><td className="py-2">Total TTC</td>{variants.map(v => <td key={v.id} className="py-2 text-right tabular-nums">{formatCHF(v.total)}</td>)}</tr>
          <tr className="text-muted-foreground"><td className="py-1">Écart vs Maintenance</td>{variants.map(v => <td key={v.id} className="py-1 text-right tabular-nums">{v.total === v0.total ? '0' : `+${formatCHF(v.total - v0.total)}`}</td>)}</tr>
        </tbody>
      </table>
      <p className="mt-2 flex items-center gap-1 text-muted-foreground">
        <Leaf className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        Classe énergétique actuelle : <b>{energyClass ?? 'non renseignée'}</b>. La variante énergétique vise l'amélioration de la performance.
      </p>
    </div>
  )
}
