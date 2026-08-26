import { useMemo, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle, ClipboardCheck, Printer, FileText, Image, Share2, Copy, Check, ExternalLink, X, Download, LayoutList, Layers, Leaf } from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { ExportDialog } from '@/components/ExportDialog'
import { stateLabels, buildingTypeLabels } from '@/data/mock'
import { formatCHF, cn } from '@/lib/utils'
import { computeProjectMetrics, roofSurface } from '@/lib/formulas'
import { getMarketCoeff } from '@/lib/diagnostic-auto'
import { cfcGroupCode, cfcGroupLabels } from '@/lib/cfc'
import { api } from '@/lib/api'
import { useAuth } from '@/stores/auth'

/** En-tête de marque du rapport : logo + identité de l'entreprise (Paramètres → Entreprise). */
function ReportBrand({ canton }: { canton: string }) {
  const company = useAuth((s) => s.user?.preferences?.company)
  const name = company?.name?.trim()
  const line2 = [company?.postalCode, company?.city].filter(Boolean).join(' ')
  return (
    <div className="text-right text-sm shrink-0">
      {company?.logo && <img src={company.logo} alt="" className="h-12 ml-auto mb-1 object-contain" />}
      <p className="font-semibold">{name || 'Diagly'}</p>
      {company?.address && <p className="text-muted-foreground">{company.address}</p>}
      <p className="text-muted-foreground">{line2 || `${canton} · Suisse`}</p>
      {company?.vatNumber && <p className="text-muted-foreground text-xs">{company.vatNumber}</p>}
    </div>
  )
}

const TVA = 0.081
const toNum = (v: string | null | undefined) => (v ? Number(v) : 0)

type ReportKind = 'sommaire' | 'detaille' | 'documente' | 'scenario' | 'rapport' | 'photos'
type ScenarioId = 'maintenance' | 'renovation' | 'energetique'
const REPORT_TITLES: Record<ReportKind, string> = {
  sommaire: 'Rapport sommaire', detaille: 'Rapport détaillé', documente: 'Rapport documenté', scenario: 'Rapport par scénario',
  rapport: 'Rapport de diagnostic', photos: 'Rapport photo',
}

// L'onglet « Variantes » = les 4 types de rapports ; l'onglet « Rapports » = Rapport + Rapports photo.
const KINDS_VARIANTES = [['sommaire', 'Sommaire', LayoutList], ['detaille', 'Détaillé', FileText], ['documente', 'Documenté', Image], ['scenario', 'Par scénario', Layers]] as const
const KINDS_RAPPORTS = [['rapport', 'Rapport', FileText], ['photos', 'Rapports photo', Image]] as const

export function ProjectRapports() {
  const { id } = useParams<{ id: string }>()
  const { pathname } = useLocation()
  const mode: 'variantes' | 'rapports' = pathname.endsWith('/rapports') ? 'rapports' : 'variantes'
  const kinds = mode === 'rapports' ? KINDS_RAPPORTS : KINDS_VARIANTES
  const [report, setReport] = useState<ReportKind>(mode === 'rapports' ? 'rapport' : 'detaille')
  const [scenario, setScenario] = useState<ScenarioId>('energetique')
  const [exportOpen, setExportOpen] = useState(false)

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => api.projects.get(id!), enabled: !!id })
  const project = projectQuery.data?.project
  const diagnostic = projectQuery.data?.diagnostics[0]

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', diagnostic?.id],
    queryFn: () => api.diagnostics.listItems(diagnostic!.id),
    enabled: !!diagnostic,
  })
  // Référence stable : `?? []` produirait un tableau neuf à chaque rendu et casserait les mémorisations en aval.
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data])

  const cfcQuery = useQuery({ queryKey: ['cfc-catalog'], queryFn: () => api.cfc.catalog(), staleTime: 3.6e6 })
  const labels = useMemo(() => cfcGroupLabels(cfcQuery.data?.entries ?? []), [cfcQuery.data])

  // Regroupement par groupe CFC (2 chiffres), trié par code.
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>()
    const sorted = [...items].sort((a, b) => (a.cfcCode ?? '').localeCompare(b.cfcCode ?? '', undefined, { numeric: true }))
    for (const it of sorted) {
      const g = cfcGroupCode(it.cfcCode) ?? ''
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(it)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([code, its]) => ({ code, label: code ? (labels.get(code) ?? `CFC ${code}`) : 'Non classé', items: its }))
  }, [items, labels])

  if (projectQuery.isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (projectQuery.isError || !project) {
    return <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">Projet introuvable</p></CardContent></Card>
  }
  if (!diagnostic) {
    return (
      <Card><CardContent className="py-16 text-center">
        <ClipboardCheck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">Aucun diagnostic</h3>
        <p className="text-sm text-muted-foreground mb-4">Le rapport se base sur le diagnostic. Démarrez-le d'abord.</p>
        <Link to={`/app/projects/${id}/diagnostic`}><Button>Aller au diagnostic</Button></Link>
      </CardContent></Card>
    )
  }

  const metrics = computeProjectMetrics({
    perimeter: project.perimeter ?? 0, nbFloors: project.nbFloors ?? 1, floorHeight: project.floorHeight ?? 2.7,
    builtArea: project.builtArea ?? 0, floorArea: project.floorArea ?? 0, facadeArea: project.facadeArea ?? undefined,
    windowPct: project.windowPct / 100, nbApartments: project.nbApartments ?? 0,
  })
  const roof = roofSurface(project.roofType, project.builtArea)

  const htRepair = items.reduce((s, i) => s + toNum(i.estimatedCost), 0)
  const htImprovement = items.reduce((s, i) => s + toNum(i.improvementCost), 0)
  const htNorms = items.reduce((s, i) => s + toNum(i.normsCost), 0)
  const ht = htRepair + htImprovement + htNorms
  const honoraires = ht * (project.honoraryPct ?? 0) / 100
  const afterH = ht + honoraires
  const reserve = afterH * (project.reservePct ?? 0) / 100
  const sousTotal = afterH + reserve
  const tva = sousTotal * TVA
  const total = sousTotal + tva
  const byPriority = (['I', 'II', 'III'] as const).map(p => ({
    p, total: items.filter(i => i.priority === p).reduce((s, i) => s + toNum(i.estimatedCost), 0),
    count: items.filter(i => i.priority === p).length,
  }))

  // 3 scénarios de rénovation cumulatifs, cascade honoraires/réserve/TVA sur chaque HT.
  const cascade = (h: number) => {
    const hon = h * (project.honoraryPct ?? 0) / 100
    const aH = h + hon
    const res = aH * (project.reservePct ?? 0) / 100
    const sT = aH + res
    const t = sT * TVA
    return { ht: h, honoraires: hon, reserve: res, sousTotal: sT, tva: t, total: sT + t }
  }
  // Enveloppes de scénario estimées depuis la géométrie (rénovation intérieure ≈ plancher, isolation ≈ enveloppe).
  const coeff = getMarketCoeff()
  const winPct = project.windowPct / 100
  const facade = metrics.facade
  const windowArea = facade * winPct
  const opaque = Math.max(facade - windowArea, 0)
  const roofM = roof ?? 0
  const floor = project.floorArea ?? 0
  const improvementPack = Math.round(floor * 120 * coeff)
  const energyPack = Math.round((opaque * 220 + windowArea * 250 + roofM * 180) * coeff)
  const variants = [
    { id: 'maintenance' as ScenarioId, name: 'Maintenance', envelopes: ['Réparation'], energyFocus: false, ...cascade(htRepair) },
    { id: 'renovation' as ScenarioId, name: 'Rénovation', envelopes: ['Réparation', 'Rénovation intérieure'], energyFocus: false, ...cascade(htRepair + improvementPack) },
    { id: 'energetique' as ScenarioId, name: 'Rénovation énergétique', envelopes: ['Réparation', 'Rénovation intérieure', 'Isolation enveloppe'], energyFocus: true, ...cascade(htRepair + improvementPack + energyPack) },
  ]
  const currentVariant = variants.find(v => v.id === scenario) ?? variants[2]

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Barre d'actions (non imprimée) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg bg-muted p-1">
            {kinds.map(([k, label, Icon]) => (
              <button
                key={k}
                onClick={() => setReport(k)}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  report === k ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          {report === 'scenario' && (
            <div className="inline-flex rounded-lg bg-muted p-1">
              {variants.map(v => (
                <button
                  key={v.id}
                  onClick={() => setScenario(v.id)}
                  className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    scenario === v.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                >
                  {v.energyFocus && <Leaf className="h-3.5 w-3.5 text-emerald-600" />}{v.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ShareControl projectId={id!} initialToken={project.shareToken ?? null} />
          <Button variant="outline" onClick={() => setExportOpen(true)}><Download className="mr-2 h-4 w-4" />Exporter</Button>
          <Button onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Imprimer / PDF</Button>
        </div>
      </div>
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} projectId={id!} />

      {/* Document */}
      {report !== 'scenario' && report !== 'photos' && (
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-6 md:p-10 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold">{REPORT_TITLES[report]}</h1>
              <p className="text-muted-foreground">{project.name}</p>
            </div>
            <ReportBrand canton={project.canton} />
          </div>

          {/* Bâtiment */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Bâtiment</h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <Info l="Adresse" v={`${project.address}, ${project.postalCode ?? ''} ${project.city} (${project.canton})`} />
              <Info l="Type" v={buildingTypeLabels[project.buildingType]} />
              <Info l="Année de construction" v={project.yearBuilt ? String(project.yearBuilt) : '—'} />
              <Info l="Année de rénovation" v={project.renovationYear ? String(project.renovationYear) : '—'} />
              <Info l="Parcelle" v={project.parcelNumber ?? '—'} />
              <Info l="Logements / étages" v={`${project.nbApartments ?? '—'} / ${project.nbFloors ?? '—'}`} />
              <Info l="Surface plancher / bâtie" v={`${project.floorArea ?? '—'} / ${project.builtArea ?? '—'} m²`} />
              <Info l="Façade / Toiture" v={`${metrics.facade.toFixed(0)} m² / ${roof != null ? roof + ' m²' : 'à préciser'}`} />
            </div>
          </section>

          {/* Contraintes & données géo/énergétiques */}
          {(project.geoData || project.energyClassGlobal || project.sre != null) && (() => {
            const g = project.geoData
            const heritage = [
              g?.heritage?.isos && `ISOS (${g.heritage.isos})`,
              g?.heritage?.unesco && `UNESCO (${g.heritage.unesco})`,
              g?.heritage?.bln && `BLN (${g.heritage.bln})`,
            ].filter(Boolean).join(' · ')
            const radonHigh = g?.radonPct != null && g.radonPct >= 20
            const notes = [
              heritage && 'Bâtiment en secteur protégé : surcoûts patrimoniaux possibles.',
              radonHigh && 'Zone radon élevée : mesures de mitigation possibles.',
            ].filter(Boolean).join(' ')
            return (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contraintes &amp; données géo/énergétiques</h2>
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  {(g?.affectationDetail || g?.affectation) && <Info l="Affectation" v={(g?.affectationDetail ?? g?.affectation) as string} />}
                  {g?.noise && <Info l="Sensibilité au bruit" v={g.noise} />}
                  {project.egid && <Info l="EGID" v={project.egid} />}
                  {g?.radonPct != null && <Info l="Radon (dépassement)" v={`${g.radonPct} %`} />}
                  {g?.seismic && <Info l="Classe de sol sismique" v={g.seismic} />}
                  {heritage && <Info l="Patrimoine protégé" v={heritage} />}
                  {project.energyClassGlobal && <Info l="Classe énergétique" v={project.energyClassGlobal} />}
                  {project.sre != null && <Info l="SRE (certificat)" v={`${project.sre} m²`} />}
                  {project.energyAgent && <Info l="Agent énergétique" v={project.energyAgent} />}
                </div>
                {notes && <p className="mt-2 text-xs text-amber-700">{notes}</p>}
              </section>
            )
          })()}

          {/* Synthèse coûts */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Synthèse des coûts</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1 text-sm">
                <Row l="Réparation (HT)" v={formatCHF(htRepair)} />
                {htImprovement > 0 && <Row l="Amélioration (HT)" v={formatCHF(htImprovement)} />}
                {htNorms > 0 && <Row l="Remise aux normes (HT)" v={formatCHF(htNorms)} />}
                <Row l="Travaux (HT)" v={formatCHF(ht)} strong />
                <Row l={`Honoraires (${project.honoraryPct ?? 0}%)`} v={formatCHF(honoraires)} />
                <Row l={`Réserve (${project.reservePct ?? 0}%)`} v={formatCHF(reserve)} />
                <Row l="Sous-total" v={formatCHF(sousTotal)} />
                <Row l="TVA 8.1%" v={formatCHF(tva)} />
                <div className="flex justify-between pt-2 border-t font-bold">
                  <span>Total TTC</span><span>{formatCHF(total)}</span>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                {byPriority.map(b => (
                  <Row key={b.p} l={`Priorité ${b.p} (${b.count})`} v={formatCHF(b.total)} />
                ))}
                <p className="text-xs text-muted-foreground pt-2">Estimation ±15%. {items.length} élément{items.length !== 1 ? 's' : ''} diagnostiqué{items.length !== 1 ? 's' : ''}.</p>
              </div>
            </div>
          </section>

          {/* Scénarios de rénovation (sommaire) */}
          {report === 'sommaire' && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Scénarios de rénovation</h2>
              <VariantsCompare variants={variants} energyClass={project.energyClassGlobal ?? project.energyClassEnvelope ?? null} />
            </section>
          )}

          {/* Détail par CFC */}
          {report !== 'sommaire' && (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Détail des observations (par CFC)</h2>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun élément observé.</p>
            ) : (
              <div className="space-y-4">
                {groups.map(g => (
                  <div key={g.code || 'nc'} className="break-inside-avoid">
                    <h3 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-1">{g.code ? `${g.code} · ${g.label}` : g.label}</h3>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
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
                              {it.works.length > 0 && <div className="text-muted-foreground">{it.works.join(' · ')}</div>}
                            </td>
                            <td className="py-1">{it.state ? stateLabels[it.state] : 'À évaluer'}</td>
                            <td className="py-1">{it.priority ?? '—'}</td>
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
          )}

          <p className="text-[10px] text-muted-foreground border-t pt-3">
            Rapport indicatif généré par Diagly. Surfaces et coûts estimés par formules, à vérifier sur place.
          </p>
        </CardContent>
      </Card>
      )}

      {/* Reportage photo : dans « Documenté » et dans « Rapports photo » */}
      {(report === 'documente' || report === 'photos') && <PhotoReport projectName={project.name} canton={project.canton} groups={groups} />}

      {/* Rapport par scénario de rénovation */}
      {report === 'scenario' && (
        <ScenarioReport
          projectName={project.name}
          canton={project.canton}
          variant={currentVariant}
          allVariants={variants}
          items={items}
          energyClass={project.energyClassGlobal ?? project.energyClassEnvelope ?? null}
        />
      )}
    </div>
  )
}

function PhotoReport({ projectName, canton, groups }: {
  projectName: string
  canton: string
  groups: { code: string; label: string; items: { id: string; cfcCode: string; cfcLabel: string; state: keyof typeof stateLabels | null; priority: string | null; photos: string[]; notes: string | null; works: string[] }[] }[]
}) {
  // On ne garde que les éléments qui ont des photos.
  const withPhotos = groups
    .map(g => ({ ...g, items: g.items.filter(i => i.photos.length > 0) }))
    .filter(g => g.items.length > 0)
  const total = withPhotos.reduce((s, g) => s + g.items.reduce((n, i) => n + i.photos.length, 0), 0)

  return (
    <Card className="print:shadow-none print:border-0">
      <CardContent className="p-6 md:p-10 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">Rapport photo</h1>
            <p className="text-muted-foreground">{projectName}</p>
          </div>
          <ReportBrand canton={canton} />
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune photo n'a encore été prise dans le diagnostic. Ajoute des photos sur les éléments depuis l'éditeur.</p>
        ) : (
          <div className="space-y-6">
            {withPhotos.map(g => (
              <section key={g.code || 'nc'}>
                <h2 className="text-sm font-bold uppercase tracking-wide border-b pb-1 mb-3">{g.code ? `${g.code} · ${g.label}` : g.label}</h2>
                <div className="space-y-5">
                  {g.items.map(it => (
                    <div key={it.id} className="break-inside-avoid">
                      <div className="flex flex-wrap items-baseline gap-x-3 mb-2">
                        <span className="font-mono text-sm text-muted-foreground">{it.cfcCode}</span>
                        <span className="font-medium">{it.cfcLabel}</span>
                        <span className="text-xs text-muted-foreground">{it.state ? stateLabels[it.state] : 'À évaluer'}{it.priority ? ` · Priorité ${it.priority}` : ''}</span>
                      </div>
                      {(it.notes || it.works.length > 0) && (
                        <p className="text-xs text-muted-foreground mb-2">{it.notes || it.works.join(' · ')}</p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {it.photos.map((src, i) => (
                          <img key={i} src={src} alt="" className="w-full aspect-[4/3] object-cover rounded border" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground border-t pt-3">
          Rapport photo généré par Diagly · {total} photo{total !== 1 ? 's' : ''}.
        </p>
      </CardContent>
    </Card>
  )
}

// ---- Scénarios de rénovation ----
interface RVariant {
  id: ScenarioId; name: string; envelopes: string[]; energyFocus: boolean
  ht: number; honoraires: number; reserve: number; sousTotal: number; tva: number; total: number
}
type RItem = {
  id: string; cfcCode: string; cfcLabel: string; state: keyof typeof stateLabels | null
  priority: string | null; estimatedCost: string | null; improvementCost: string | null; normsCost: string | null
}

/** Tableau comparatif compact des 3 scénarios (utilisé dans le rapport sommaire). */
function VariantsCompare({ variants, energyClass }: { variants: RVariant[]; energyClass: string | null }) {
  const v0 = variants[0]
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted-foreground border-b">
            <th className="font-medium py-1.5">Poste</th>
            {variants.map(v => <th key={v.id} className="font-medium text-right py-1.5 whitespace-nowrap">{v.name}</th>)}
          </tr>
        </thead>
        <tbody>
          <tr className="border-b"><td className="py-1 text-muted-foreground">Périmètre</td>{variants.map(v => <td key={v.id} className="py-1 text-right text-[11px] text-muted-foreground">{v.envelopes.join(' + ')}</td>)}</tr>
          <tr className="border-b"><td className="py-1">Travaux (HT)</td>{variants.map(v => <td key={v.id} className="py-1 text-right">{formatCHF(v.ht)}</td>)}</tr>
          <tr className="border-t-2 font-bold"><td className="py-2">Total TTC</td>{variants.map(v => <td key={v.id} className="py-2 text-right text-primary">{formatCHF(v.total)}</td>)}</tr>
          <tr className="text-xs text-muted-foreground"><td className="py-1">Écart vs Maintenance</td>{variants.map(v => <td key={v.id} className="py-1 text-right">{v.total === v0.total ? '—' : `+${formatCHF(v.total - v0.total)}`}</td>)}</tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Leaf className="h-3.5 w-3.5 text-emerald-600 shrink-0" />Classe énergétique actuelle : <b>{energyClass ?? 'non renseignée'}</b>. La variante énergétique vise l'amélioration de la performance.</p>
    </div>
  )
}

/** Rapport dédié à un scénario de rénovation : périmètre, cascade de coûts, éléments concernés. */
function ScenarioReport({ projectName, canton, variant, allVariants, items, energyClass }: {
  projectName: string; canton: string; variant: RVariant; allVariants: RVariant[]; items: RItem[]; energyClass: string | null
}) {
  const amountFor = (it: RItem) => {
    let a = toNum(it.estimatedCost)
    if (variant.id !== 'maintenance') a += toNum(it.improvementCost)
    if (variant.id === 'energetique') a += toNum(it.normsCost)
    return a
  }
  const lines = items.map(it => ({ it, amount: amountFor(it) })).filter(l => l.amount > 0).sort((a, b) => b.amount - a.amount)
  const v0 = allVariants[0]

  return (
    <Card className="print:shadow-none print:border-0">
      <CardContent className="p-6 md:p-10 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {variant.energyFocus && <Leaf className="h-6 w-6 text-emerald-600" />}Scénario : {variant.name}
            </h1>
            <p className="text-muted-foreground">{projectName}</p>
          </div>
          <ReportBrand canton={canton} />
        </div>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Périmètre du scénario</h2>
          <div className="flex flex-wrap gap-1.5">
            {variant.envelopes.map(e => <Badge key={e} variant="outline">{e}</Badge>)}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Coût du scénario</h2>
          <div className="grid sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <Row l="Travaux (HT)" v={formatCHF(variant.ht)} strong />
              <Row l="Honoraires" v={formatCHF(variant.honoraires)} />
              <Row l="Réserve" v={formatCHF(variant.reserve)} />
              <Row l="Sous-total" v={formatCHF(variant.sousTotal)} />
              <Row l="TVA 8.1%" v={formatCHF(variant.tva)} />
              <div className="flex justify-between pt-2 border-t font-bold"><span>Total TTC</span><span>{formatCHF(variant.total)}</span></div>
            </div>
            <div className="space-y-1 text-muted-foreground">
              {allVariants.map(v => (
                <Row key={v.id} l={v.name} v={`${formatCHF(v.total)}${v.total === v0.total ? '' : ` (+${formatCHF(v.total - v0.total)})`}`} />
              ))}
              <p className="text-xs pt-2">Estimation ±15%. {lines.length} élément{lines.length !== 1 ? 's' : ''} concerné{lines.length !== 1 ? 's' : ''}.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Éléments concernés</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun coût pour ce scénario. Renseignez les enveloppes correspondantes dans le diagnostic.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="font-medium py-1 w-14">CFC</th>
                  <th className="font-medium">Élément</th>
                  <th className="font-medium w-20">État</th>
                  <th className="font-medium w-10">Prio.</th>
                  <th className="font-medium text-right w-24">Montant</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ it, amount }) => (
                  <tr key={it.id} className="border-t align-top">
                    <td className="font-mono py-1">{it.cfcCode}</td>
                    <td className="py-1">{it.cfcLabel}</td>
                    <td className="py-1">{it.state ? stateLabels[it.state] : 'À évaluer'}</td>
                    <td className="py-1">{it.priority ?? '—'}</td>
                    <td className="py-1 text-right font-medium">{formatCHF(amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {variant.energyFocus && (
          <p className="text-xs text-emerald-700 flex items-center gap-1"><Leaf className="h-3.5 w-3.5 shrink-0" />Scénario à visée énergétique — classe actuelle : <b>{energyClass ?? 'non renseignée'}</b>. Inclut isolation et remise aux normes.</p>
        )}

        <p className="text-[10px] text-muted-foreground border-t pt-3">Rapport indicatif généré par Diagly · scénario « {variant.name} ».</p>
      </CardContent>
    </Card>
  )
}

/** Bouton + popover pour activer / copier / révoquer le lien de partage client. */
function ShareControl({ projectId, initialToken }: { projectId: string; initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = token ? `${window.location.origin}/share/${token}` : ''

  const enable = async () => {
    setLoading(true)
    try { const r = await api.projects.enableShare(projectId); setToken(r.token); setOpen(true) }
    finally { setLoading(false) }
  }
  const revoke = async () => {
    setLoading(true)
    try { await api.projects.disableShare(projectId); setToken(null); setOpen(false) }
    finally { setLoading(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* ignore */ }
  }

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => (token ? setOpen((o) => !o) : enable())} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
        {token ? 'Lien de partage' : 'Partager'}
      </Button>

      {open && token && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 z-50 rounded-xl border bg-background shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Partager au client</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Toute personne disposant de ce lien peut consulter le rapport en lecture seule, sans connexion.</p>
            <div className="flex items-center gap-1.5">
              <input readOnly value={url} onFocus={(e) => e.target.select()} className="flex-1 min-w-0 rounded-lg border bg-muted/40 px-2.5 py-1.5 text-xs" />
              <button onClick={copy} className="h-8 w-8 rounded-lg border flex items-center justify-center hover:bg-muted shrink-0" title="Copier">
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" />Ouvrir</a>
              <button onClick={revoke} disabled={loading} className="text-xs text-red-600 hover:underline">Révoquer le lien</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Info({ l, v }: { l: string; v: string }) {
  return <p><span className="text-muted-foreground">{l} :</span> {v}</p>
}
function Row({ l, v, strong }: { l: string; v: string; strong?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className={strong ? 'font-semibold' : ''}>{v}</span></div>
}
