/**
 * Le chapitre des variantes de projet : la comparaison au devis de base, puis
 * le détail de chaque variante.
 *
 * Une variante reprend tout le diagnostic et ne remplace que les ouvrages
 * qu'elle désigne : ses écarts se lisent par rapport au devis du rapport.
 */
import { stateLabels } from '@/data/mock'
import { uniteCourte, type Devis } from '@/lib/devis'
import type { Variante } from '@/lib/variantes'
import { cn, formatCHF } from '@/lib/utils'

/** Le devis de base et chaque variante, côte à côte : c'est la lecture utile. */
export function ComparaisonVariantes({ base, variantes }: { base: Devis; variantes: Variante[] }) {
  const moinsCher = variantes.reduce((a, b) => (b.ht < a.ht ? b : a))
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="py-1 font-medium">Scénario</th>
          <th className="w-20 py-1 text-right font-medium">Arbitrages</th>
          <th className="w-28 py-1 text-right font-medium">Travaux HT</th>
          <th className="w-28 py-1 text-right font-medium">Total TTC</th>
          <th className="w-28 py-1 text-right font-medium">Écart</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-t">
          <td className="py-1 font-medium">Devis du diagnostic</td>
          <td className="py-1 text-right text-muted-foreground">0</td>
          <td className="py-1 text-right tabular-nums">{formatCHF(base.ht)}</td>
          <td className="py-1 text-right font-medium tabular-nums">{formatCHF(base.cascade.total)}</td>
          <td className="py-1 text-right text-muted-foreground">référence</td>
        </tr>
        {variantes.map((v) => (
          <tr key={v.variant.id} className="border-t">
            <td className="py-1 font-medium">
              {v.variant.name}
              {variantes.length > 1 && v.ht === moinsCher.ht && (
                <span className="ml-1.5 text-[8pt] font-normal text-emerald-700">(le moins cher)</span>
              )}
            </td>
            <td className="py-1 text-right tabular-nums">{v.arbitrages.length}</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(v.ht)}</td>
            <td className="py-1 text-right font-medium tabular-nums">{formatCHF(v.cascade.total)}</td>
            <td className={cn('py-1 text-right font-medium tabular-nums', couleurEcart(v.ecartHt))}>
              {ecartLisible(v.ecartHt)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Un écart se lit à son signe : moins cher en vert, plus cher en rouge. */
function couleurEcart(ecart: number): string {
  return ecart < 0 ? 'text-emerald-700' : ecart > 0 ? 'text-red-700' : 'text-muted-foreground'
}
function ecartLisible(ecart: number): string {
  if (ecart === 0) return '0'
  return `${ecart > 0 ? '+' : '−'}${formatCHF(Math.abs(ecart))}`
}

export function TitreVariante({ calcul }: { calcul: Variante }) {
  return (
    <>
      <h3 className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 border-b-2 border-foreground pb-1">
        <span className="font-bold uppercase tracking-wide">{calcul.variant.name}</span>
        <span className="font-bold tabular-nums">{formatCHF(calcul.ht)} HT</span>
      </h3>
      {calcul.variant.description && (
        <p className="mt-2 text-muted-foreground">{calcul.variant.description}</p>
      )}
    </>
  )
}

/** Le détail d'une variante : ce qu'elle remplace, par quoi, et ce que ça change. */
export function DetailVariante({ calcul }: { calcul: Variante }) {
  return (
    <div className="mt-3">
      <table className="w-full">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1 font-medium">Au lieu de</th>
            <th className="py-1 font-medium">On retient</th>
            <th className="w-24 py-1 text-right font-medium">Montant HT</th>
            <th className="w-24 py-1 text-right font-medium">Écart</th>
          </tr>
        </thead>
        <tbody>
          {calcul.arbitrages.map((a) => (
            <tr key={a.ligne.id} className="border-t align-top">
              <td className="py-1 pr-3">
                {a.remplace ? (
                  <>
                    <span className="font-mono text-muted-foreground">{a.remplace.cfcCode}</span> {a.remplace.cfcLabel}
                    <div className="text-muted-foreground">
                      {a.remplace.state && <>{stateLabels[a.remplace.state]} · </>}
                      {formatCHF(a.montantRemplace)}
                    </div>
                  </>
                ) : (
                  <span className="text-muted-foreground">Travail nouveau, absent du diagnostic</span>
                )}
              </td>
              <td className="py-1 pr-3">
                <span className="font-mono text-muted-foreground">{a.ligne.cfcCode}</span> {a.ligne.label}
                {/* L'état retenu fait partie de l'arbitrage : passer un ouvrage de moyen à
                    mauvais change le prix autant que changer d'article. */}
                {(a.ligne.state || a.quantite != null) && (
                  <div className="text-muted-foreground">
                    {a.ligne.state && <>{stateLabels[a.ligne.state]}</>}
                    {a.ligne.state && a.quantite != null && ' · '}
                    {a.quantite != null && (
                      <>{a.quantite} {uniteCourte(a.ligne.unit) ?? ''}{a.baseMetre ? ` (${a.baseMetre})` : ''}</>
                    )}
                  </div>
                )}
                {a.ligne.note && <div className="italic text-muted-foreground">{a.ligne.note}</div>}
              </td>
              <td className="py-1 text-right tabular-nums">{formatCHF(a.montant)}</td>
              <td className={cn('py-1 text-right font-medium tabular-nums', couleurEcart(a.ecart))}>
                {ecartLisible(a.ecart)}
              </td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="py-1" colSpan={2}>Travaux conservés du diagnostic</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(calcul.htConserve)}</td>
            <td className="py-1" />
          </tr>
          <tr className="font-semibold">
            <td className="py-1" colSpan={2}>Total des travaux de la variante (HT)</td>
            <td className="py-1 text-right tabular-nums">{formatCHF(calcul.ht)}</td>
            <td className={cn('py-1 text-right tabular-nums', couleurEcart(calcul.ecartHt))}>
              {ecartLisible(calcul.ecartHt)}
            </td>
          </tr>
          <tr className="text-muted-foreground">
            <td className="py-0.5" colSpan={2}>Total TTC (honoraires, réserve et TVA compris)</td>
            <td className="py-0.5 text-right tabular-nums">{formatCHF(calcul.cascade.total)}</td>
            <td className="py-0.5" />
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-muted-foreground">
        Les ouvrages non cités ci-dessus sont repris tels quels du diagnostic : seuls les
        arbitrages listés distinguent cette variante du devis du diagnostic.
      </p>
    </div>
  )
}
