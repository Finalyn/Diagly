import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Loader2, AlertCircle, Lock } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCHF } from '@/lib/utils'
import { stateLabels, buildingTypeLabels } from '@/data/mock'
import { cfcGroupCode } from '@/lib/cfc'
import { priceBasisNote, setMarketInfo } from '@/lib/diagnostic-auto'

const toNum = (v: string | null | undefined) => (v ? Number(v) : 0)

export function PublicReport() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-report', token],
    queryFn: () => api.share.get(token!),
    enabled: !!token,
    retry: false,
  })

  // /api/market/index est public : la mention de la base de prix est disponible
  // ici aussi, sans connexion.
  useQuery({
    queryKey: ['market-index'],
    queryFn: async () => { const m = await api.market.index(); setMarketInfo(m); return m },
    staleTime: 1000 * 60 * 60,
  })

  const groups = useMemo(() => {
    const items = data?.items ?? []
    const map = new Map<string, typeof items>()
    const sorted = [...items].sort((a, b) => (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true }))
    for (const it of sorted) {
      const g = cfcGroupCode(it.cfcCode) ?? ''
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(it)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([code, its]) => ({ code, items: its }))
  }, [data])

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement du rapport…</div>
  }
  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-1">Lien indisponible</h1>
          <p className="text-sm text-gray-500">Ce lien de partage est invalide ou a été révoqué par son auteur.</p>
        </div>
      </div>
    )
  }

  const { project, company, costs } = data
  const items = data.items
  const accent = company?.accentColor || '#3b82f6'

  const { ht, honoraires, reserve, sousTotal, tva, total, byPriority } = costs
  const withPhotos = items.filter(i => i.photos.length > 0)

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-3 sm:px-6">
      {/* Barre d'action (non imprimée) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" />Lecture seule</span>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg text-white text-sm font-medium px-3 py-2" style={{ backgroundColor: accent }}>
          <Printer className="h-4 w-4" />Imprimer / PDF
        </button>
      </div>

      {/* Document */}
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm print:shadow-none print:rounded-none overflow-hidden">
        <div className="h-1.5" style={{ backgroundColor: accent }} />
        <div className="p-6 sm:p-10 space-y-6">
          {/* En-tête */}
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Rapport de diagnostic</h1>
              <p className="text-gray-500">{project.name}</p>
              <p className="text-gray-500 text-sm">{project.address}, {project.postalCode ?? ''} {project.city} ({project.canton})</p>
            </div>
            <div className="text-right text-sm shrink-0">
              {company?.logo && <img src={company.logo} alt="" className="h-12 ml-auto mb-1 object-contain" />}
              <p className="font-semibold">{company?.name || 'Diagly'}</p>
              {company?.address && <p className="text-gray-500">{company.address}</p>}
              {(company?.postalCode || company?.city) && <p className="text-gray-500">{[company?.postalCode, company?.city].filter(Boolean).join(' ')}</p>}
              {company?.vatNumber && <p className="text-gray-400 text-xs">{company.vatNumber}</p>}
            </div>
          </div>

          {/* Bâtiment */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Bâtiment</h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <Info l="Type" v={buildingTypeLabels[project.buildingType]} />
              <Info l="Année de construction" v={project.yearBuilt ? String(project.yearBuilt) : '—'} />
              <Info l="Logements / étages" v={`${project.nbApartments ?? '—'} / ${project.nbFloors ?? '—'}`} />
              <Info l="Parcelle" v={project.parcelNumber ?? '—'} />
            </div>
          </section>

          {/* Synthèse des coûts */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Synthèse des coûts</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1 text-sm">
                <Row l="Travaux (HT)" v={formatCHF(ht)} strong />
                <Row l="Honoraires" v={formatCHF(honoraires)} />
                <Row l="Réserve" v={formatCHF(reserve)} />
                <Row l="Sous-total" v={formatCHF(sousTotal)} />
                <Row l="TVA 8.1%" v={formatCHF(tva)} />
                <div className="flex justify-between pt-2 border-t font-bold"><span>Total TTC</span><span>{formatCHF(total)}</span></div>
              </div>
              <div className="space-y-1 text-sm">
                {byPriority.map(b => <Row key={b.p} l={`Priorité ${b.p} (${b.count})`} v={formatCHF(b.total)} />)}
                <p className="text-xs text-gray-400 pt-2">Estimation ±15%. {items.length} élément{items.length !== 1 ? 's' : ''} diagnostiqué{items.length !== 1 ? 's' : ''}.</p>
              </div>
            </div>
          </section>

          {/* Détail par CFC */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Détail des observations</h2>
            {items.length === 0 ? (
              <p className="text-sm text-gray-500">Aucun élément observé.</p>
            ) : (
              <div className="space-y-4">
                {groups.map(g => (
                  <div key={g.code || 'nc'} className="break-inside-avoid">
                    <h3 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-1">{g.code ? `CFC ${g.code}` : 'Non classé'}</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-400">
                          <th className="font-medium py-1 w-14">CFC</th>
                          <th className="font-medium">Élément</th>
                          <th className="font-medium w-20">État</th>
                          <th className="font-medium w-10">Prio.</th>
                          <th className="font-medium text-right w-24">Coût</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map(it => (
                          <tr key={it.id} className="border-t align-top">
                            <td className="font-mono py-1">{it.cfcCode}</td>
                            <td className="py-1">
                              {it.cfcLabel}
                              {it.works.length > 0 && <div className="text-gray-400">{it.works.join(' · ')}</div>}
                            </td>
                            <td className="py-1">{stateLabels[it.state]}</td>
                            <td className="py-1">{it.priority}</td>
                            <td className="py-1 text-right font-medium">{it.estimatedCost ? formatCHF(toNum(it.estimatedCost)) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Photos */}
          {withPhotos.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Photos</h2>
              <div className="space-y-4">
                {withPhotos.map(it => (
                  <div key={it.id} className="break-inside-avoid">
                    <p className="text-xs mb-1"><span className="font-mono text-gray-400">{it.cfcCode}</span> <span className="font-medium">{it.cfcLabel}</span></p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {it.photos.map((src, i) => <img key={i} src={src} alt="" className="w-full aspect-[4/3] object-cover rounded border" />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <p className="text-[10px] text-gray-400 border-t pt-3">
            {priceBasisNote()} Document en lecture seule, surfaces et coûts estimés, à vérifier sur place.
            Généré avec Diagly.
          </p>
        </div>
      </div>
    </div>
  )
}

function Info({ l, v }: { l: string; v: string }) {
  return <p><span className="text-gray-400">{l} :</span> {v}</p>
}
function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between"><span className="text-gray-500">{l}</span><span className={strong ? 'font-semibold' : ''}>{v}</span></div>
}
