/**
 * Rapport par scénario de rénovation, paginé en A4.
 *
 * Le tableau des éléments concernés passe par les blocs de type `lignes` : s'il
 * déborde d'une page, il reprend sur la suivante sous ses intitulés de colonnes
 * plutôt que de perdre ses en-têtes en chemin.
 */
import { useMemo, type ReactNode } from 'react'
import { Leaf } from 'lucide-react'
import { DocumentA4, type BlocDocument } from './PagesA4'
import { LogoEntete, Row, SectionTitre, TitreRapport } from './shared'
import { toNum } from './constants'
import type { RItem, RVariant } from './scenarios'
import { stateLabels } from '@/data/mock'
import { priceBasisNote } from '@/lib/diagnostic-auto'
import { formatCHF, formatDate } from '@/lib/utils'

const COLONNES = (
  <>
    <col style={{ width: '16mm' }} />
    <col />
    <col style={{ width: '22mm' }} />
    <col style={{ width: '12mm' }} />
    <col style={{ width: '28mm' }} />
  </>
)

const ENTETE = (
  <thead>
    <tr className="text-left text-muted-foreground">
      <th className="py-1 font-medium">CFC</th>
      <th className="py-1 font-medium">Élément</th>
      <th className="py-1 font-medium">État</th>
      <th className="py-1 font-medium">Prio.</th>
      <th className="py-1 text-right font-medium">Montant</th>
    </tr>
  </thead>
)

export function RapportScenario({ projectName, variant, allVariants, items, energyClass, auteur }: {
  projectName: string
  variant: RVariant
  allVariants: RVariant[]
  items: RItem[]
  energyClass: string | null
  auteur: string
}) {
  const aujourdhui = formatDate(new Date())
  const v0 = allVariants[0]

  const lignes = useMemo(() => {
    const montant = (it: RItem) => {
      let a = toNum(it.estimatedCost)
      if (variant.id !== 'maintenance') a += toNum(it.improvementCost)
      if (variant.id === 'energetique') a += toNum(it.normsCost)
      return a
    }
    return items.map((it) => ({ it, amount: montant(it) }))
      .filter((l) => l.amount > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [items, variant.id])

  const blocs = useMemo(() => {
    const out: BlocDocument[] = []
    const bloc = (cle: string, noeud: ReactNode, o: { nouvellePage?: boolean; avecSuivant?: boolean } = {}) =>
      out.push({ type: 'bloc', cle, noeud, ...o })

    bloc('titre', (
      <TitreRapport
        titre={`Scénario : ${variant.name}`}
        projet={projectName}
        mention={`Édité le ${aujourdhui}${auteur ? ` par ${auteur}` : ''}`}
      />
    ), { avecSuivant: true })

    bloc('perimetre', (
      <section>
        <SectionTitre>Périmètre du scénario</SectionTitre>
        <p>{variant.envelopes.join(' · ')}</p>
      </section>
    ))

    bloc('cout', (
      <section>
        <SectionTitre>Coût du scénario</SectionTitre>
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-1">
            <Row l="Travaux (HT)" v={formatCHF(variant.ht)} strong />
            <Row l="Honoraires" v={formatCHF(variant.honoraires)} />
            <Row l="Réserve" v={formatCHF(variant.reserve)} />
            <Row l="Sous-total" v={formatCHF(variant.sousTotal)} />
            <Row l="TVA 8.1%" v={formatCHF(variant.tva)} />
            <div className="flex justify-between border-t pt-2 font-bold">
              <span>Total TTC</span><span>{formatCHF(variant.total)}</span>
            </div>
          </div>
          <div className="space-y-1 text-muted-foreground">
            {allVariants.map((v) => (
              <Row key={v.id} l={v.name} v={`${formatCHF(v.total)}${v.total === v0.total ? '' : ` (+${formatCHF(v.total - v0.total)})`}`} />
            ))}
            <p className="pt-2">
              Estimation ±15%. {lignes.length} élément{lignes.length !== 1 ? 's' : ''} diagnostiqué{lignes.length !== 1 ? 's' : ''}
              {variant.packs.length > 0 && ` + ${variant.packs.length} forfait${variant.packs.length !== 1 ? 's' : ''} de scénario`}.
            </p>
          </div>
        </div>
      </section>
    ))

    bloc('elements-titre', <SectionTitre>Éléments concernés</SectionTitre>, { avecSuivant: true })

    if (lignes.length === 0 && variant.packs.length === 0) {
      bloc('elements-vide', (
        <p className="text-muted-foreground">
          Aucun coût pour ce scénario. Renseignez les enveloppes correspondantes dans le diagnostic.
        </p>
      ))
    } else {
      for (const { it, amount } of lignes) {
        out.push({
          type: 'lignes', cle: `el-${it.id}`, tableauId: 'elements', colonnes: COLONNES, entete: ENTETE,
          lignes: (
            <tr className="border-t align-top">
              <td className="py-1 font-mono">{it.cfcCode}</td>
              <td className="py-1">{it.cfcLabel}</td>
              <td className="py-1">{it.state ? stateLabels[it.state] : 'À évaluer'}</td>
              <td className="py-1">{it.priority ?? '—'}</td>
              <td className="py-1 text-right font-medium tabular-nums">{formatCHF(amount)}</td>
            </tr>
          ),
        })
      }
      for (const pack of variant.packs) {
        out.push({
          type: 'lignes', cle: `pack-${pack.label}`, tableauId: 'elements', colonnes: COLONNES, entete: ENTETE,
          lignes: (
            <tr className="border-t align-top">
              <td className="py-1 text-muted-foreground">—</td>
              <td className="py-1">
                {pack.label}
                <div className="text-muted-foreground">{pack.basis}</div>
              </td>
              <td className="py-1 text-muted-foreground">estimé</td>
              <td className="py-1 text-muted-foreground">—</td>
              <td className="py-1 text-right font-medium tabular-nums">{formatCHF(pack.amount)}</td>
            </tr>
          ),
        })
      }
      out.push({
        type: 'lignes', cle: 'el-total', tableauId: 'elements', colonnes: COLONNES, entete: ENTETE,
        lignes: (
          <tr className="border-t-2 font-semibold">
            <td className="py-1" colSpan={4}>Total travaux (HT)</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(variant.ht)}</td>
          </tr>
        ),
      })
    }

    if (variant.energyFocus) {
      bloc('energie', (
        <p className="mt-4 flex items-center gap-1 text-emerald-700">
          <Leaf className="h-3.5 w-3.5 shrink-0" />
          Scénario à visée énergétique, classe actuelle : <b>{energyClass ?? 'non renseignée'}</b>.
          Inclut isolation et remise aux normes.
        </p>
      ))
    }

    bloc('mentions', (
      <p className="mt-6 border-t pt-3 text-muted-foreground">
        {priceBasisNote()} Scénario « {variant.name} », rapport généré par Diagly.
      </p>
    ))

    return out
  }, [projectName, variant, allVariants, v0, lignes, energyClass, aujourdhui, auteur])

  return (
    <DocumentA4
      blocs={blocs}
      entete={<LogoEntete />}
      mentionPied={`${projectName} · ${variant.name} · ${aujourdhui}`}
    />
  )
}
