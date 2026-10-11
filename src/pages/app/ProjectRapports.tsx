import { useMemo, useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertCircle, BookOpen, ClipboardCheck, ClipboardList, Printer, FileText, Image, Share2, Copy, Check, ExternalLink, X, Download, LayoutList, Layers, Leaf } from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { ExportDialog } from '@/components/ExportDialog'
import { cn } from '@/lib/utils'
import { computeProjectMetrics } from '@/lib/formulas'
import { getMarketCoeff } from '@/lib/diagnostic-auto'
import { cfcGroupCode, cfcGroupLabels } from '@/lib/cfc'
import { api } from '@/lib/api'
import { useBaseCfc } from '@/lib/base-cfc/requete'
import type { ElementState } from '@/lib/api-types'
import { useAuth } from '@/stores/auth'
import { MarqueDuRapport } from '@/components/report/marque-contexte'
import { PersonnaliserLeRapport } from '@/components/report/PersonnaliserLeRapport'
import { RapportComplet } from '@/components/report/RapportComplet'
import { RapportStandard } from '@/components/report/RapportStandard'
import { RapportExistant } from '@/components/report/RapportExistant'
import { RapportPhoto } from '@/components/report/RapportPhoto'
import { RapportScenario } from '@/components/report/RapportScenario'
import type { RVariant, ScenarioId } from '@/components/report/scenarios'
import { TVA, toNum } from '@/components/report/constants'

type ReportKind = 'complet' | 'sommaire' | 'detaille' | 'documente' | 'scenario' | 'rapport' | 'photos' | 'existant'
const REPORT_TITLES: Record<ReportKind, string> = {
  complet: 'Rapport complet',
  sommaire: 'Rapport sommaire', detaille: 'Rapport détaillé', documente: 'Rapport documenté', scenario: 'Rapport par scénario',
  rapport: 'Rapport de diagnostic', photos: 'Rapport photo', existant: "Rapport de l'existant",
}

// L'onglet « Variantes » = les 4 types de rapports ; l'onglet « Rapports » = Rapport + Rapports photo.
const KINDS_VARIANTES = [['sommaire', 'Sommaire', LayoutList], ['detaille', 'Détaillé', FileText], ['documente', 'Documenté', Image], ['scenario', 'Par scénario', Layers]] as const
const KINDS_RAPPORTS = [['complet', 'Complet', BookOpen], ['rapport', 'Rapport', FileText], ['existant', "De l'existant", ClipboardList], ['photos', 'Rapports photo', Image]] as const

/** Les quatre types qui partagent le corps du rapport standard. */
const STANDARDS: ReportKind[] = ['sommaire', 'detaille', 'documente', 'rapport']

export function ProjectRapports() {
  const { id } = useParams<{ id: string }>()
  const { pathname } = useLocation()
  const mode: 'variantes' | 'rapports' = pathname.endsWith('/rapports') ? 'rapports' : 'variantes'
  const user = useAuth((s) => s.user)
  const auteur = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.companyName || ''
  const kinds = mode === 'rapports' ? KINDS_RAPPORTS : KINDS_VARIANTES
  const [report, setReport] = useState<ReportKind>(mode === 'rapports' ? 'complet' : 'detaille')
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

  // Variantes du projet : le rapport complet en fait son chapitre 5.
  const variantsQuery = useQuery({ queryKey: ['variants', id], queryFn: () => api.variants.list(id!), enabled: !!id })

  const cfcQuery = useQuery({ queryKey: ['cfc-catalog'], queryFn: () => api.cfc.catalog(), staleTime: 3.6e6 })
  // Catalogue des items : il porte la description de l'état constaté (« état existant »
  // du tableau de référence), qui doit figurer dans le rapport et pas seulement à la saisie.
  const catalogQuery = useQuery({ queryKey: ['cfc-items'], queryFn: () => api.cfc.items(), staleTime: 3.6e6 })
  // La base v3 porte le devis, ses postes et le nom des étapes. L'ancien
  // catalogue reste là pour les relevés d'avant la bascule, dont il décrit
  // l'état constaté, et pour les variantes.
  const baseQuery = useBaseCfc()
  const etatExistant = useMemo(() => {
    const parId = new Map((catalogQuery.data?.items ?? []).map((c) => [c.id, c]))
    return (it: { catalogItemId: number | null; state: ElementState | null }): string | null => {
      if (!it.state || it.catalogItemId == null) return null
      const c = parId.get(it.catalogItemId)
      if (!c) return null
      return it.state === 'TRES_BON' ? c.descTbe : it.state === 'BON' ? c.descBon : it.state === 'MOYEN' ? c.descMoyen : c.descMauvais
    }
  }, [catalogQuery.data])
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

  const metrics = computeProjectMetrics(project)
  const roof = metrics.roof
  const htRepair = items.reduce((s, i) => s + toNum(i.estimatedCost), 0)

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
  // Forfaits de scénario : estimés depuis la géométrie, donc absents de la liste des
  // éléments diagnostiqués. Ils sont énoncés ligne par ligne, avec leur base de calcul,
  // pour que le total du scénario se retrouve à la main.
  const packRenovation = {
    label: 'Rénovation intérieure (forfait)',
    basis: `${Math.round(floor)} m² de plancher × 120 CHF × indice ${coeff}`,
    amount: improvementPack,
  }
  const packEnergie = {
    label: 'Isolation de l’enveloppe (forfait)',
    basis: `${Math.round(opaque)} m² opaque × 220 + ${Math.round(windowArea)} m² vitré × 250${roofM ? ` + ${Math.round(roofM)} m² toiture × 180` : ''} CHF × indice ${coeff}`,
    amount: energyPack,
  }
  const variants: RVariant[] = [
    { id: 'maintenance', name: 'Maintenance', envelopes: ['Réparation'], energyFocus: false, packs: [], ...cascade(htRepair) },
    { id: 'renovation', name: 'Rénovation', envelopes: ['Réparation', 'Rénovation intérieure'], energyFocus: false, packs: [packRenovation], ...cascade(htRepair + improvementPack) },
    { id: 'energetique', name: 'Rénovation énergétique', envelopes: ['Réparation', 'Rénovation intérieure', 'Isolation enveloppe'], energyFocus: true, packs: [packRenovation, packEnergie], ...cascade(htRepair + improvementPack + energyPack) },
  ]
  const currentVariant = variants.find(v => v.id === scenario) ?? variants[2]
  const classeEnergie = project.energyClassGlobal ?? project.energyClassEnvelope ?? null

  return (
    /* Une colonne à gauche, le document à droite.
       Les types de rapport tenaient dans une pilule horizontale au-dessus du
       document : au quatrième type les libellés se serraient, et le document
       descendait d'autant. En colonne, la liste porte des noms entiers, reste
       visible pendant qu'on fait défiler le document, et les actions se rangent
       dessous au lieu de flotter à l'opposé de ce qu'elles actionnent. */
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Le document à gauche, les commandes à droite. Il commence ainsi au
          bord de l'écran, là où l'on se met pour le lire, et la colonne garde
          la place qu'il faut au panneau de personnalisation. Elle défile
          d'elle-même quand elle dépasse, sans emporter le document. */}
      <aside className="shrink-0 space-y-4 print:hidden lg:order-2 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-5.5rem)] lg:w-64 lg:overflow-y-auto lg:pb-2">
        <nav className="space-y-1" aria-label="Type de rapport">
          {kinds.map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setReport(k)}
              aria-current={report === k ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                report === k
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />{label}
            </button>
          ))}
        </nav>

        {report === 'scenario' && (
          <div>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Scénario
            </p>
            <div className="space-y-1">
              {variants.map(v => (
                <button
                  key={v.id}
                  onClick={() => setScenario(v.id)}
                  aria-current={scenario === v.id ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    scenario === v.id
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  {v.energyFocus && <Leaf className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}{v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <PersonnaliserLeRapport
          projectId={id!}
          dossier={project.reportBranding}
          auteurParDefaut={auteur}
        />

        <div className="space-y-2 border-t pt-4">
          <Button onClick={() => window.print()} className="w-full justify-start">
            <Printer className="mr-2 h-4 w-4" />Imprimer / PDF
          </Button>
          <Button variant="outline" onClick={() => setExportOpen(true)} className="w-full justify-start">
            <Download className="mr-2 h-4 w-4" />Exporter
          </Button>
          <ShareControl projectId={id!} initialToken={project.shareToken ?? null} />
        </div>
      </aside>

      {/* Les feuilles A4 ont une largeur fixe : quand la fenêtre offre moins de
          210 mm, on les fait défiler horizontalement plutôt que de laisser toute
          la page déborder. À l'impression, la contrainte disparaît. */}
      {/* Tout le document porte la marque du dossier : les en-têtes de page
          sont trop loin d'ici pour qu'on la leur passe de main en main. */}
      <MarqueDuRapport dossier={project.reportBranding} auteur={auteur}>
      <div className="min-w-0 flex-1 space-y-4 overflow-x-auto print:overflow-visible lg:order-1">
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} projectId={id!} />

      {/* Rapport complet : le livrable clé en main, garde + sommaire + méthode + état + devis */}
      {report === 'complet' && (
        <RapportComplet
          project={project}
          items={items}
          etatExistant={etatExistant}
          cfcEntries={cfcQuery.data?.entries ?? []}
          base={{
            articles: baseQuery.data?.articles ?? [],
            postes: baseQuery.data?.postes ?? [],
            etapes: baseQuery.data?.etapes ?? [],
          }}
          catalogItems={catalogQuery.data?.items ?? []}
          variants={variantsQuery.data?.variants ?? []}
          auteur={auteur}
        />
      )}

      {/* Corps commun : sommaire, détaillé, documenté, et le rapport de l'onglet Rapports */}
      {STANDARDS.includes(report) && (
        <RapportStandard
          project={project}
          items={items}
          groups={groups}
          etatExistant={etatExistant}
          auteur={auteur}
          titre={REPORT_TITLES[report]}
          sommaire={report === 'sommaire'}
          avecPhotos={report === 'documente'}
          variants={variants}
        />
      )}

      {/* Rapport de l'existant : qualitatif, calqué sur le modèle du bureau */}
      {report === 'existant' && (
        <RapportExistant project={project} items={items} etatExistant={etatExistant} auteur={auteur} />
      )}

      {/* Reportage photo seul */}
      {report === 'photos' && (
        <RapportPhoto projectName={project.name} groups={groups} auteur={auteur} />
      )}

      {/* Rapport par scénario de rénovation */}
      {report === 'scenario' && (
        <RapportScenario
          projectName={project.name}
          variant={currentVariant}
          allVariants={variants}
          items={items}
          energyClass={classeEnergie}
          auteur={auteur}
        />
      )}
      </div>
      </MarqueDuRapport>
    </div>
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
      <Button variant="outline" onClick={() => (token ? setOpen((o) => !o) : enable())} disabled={loading} className="w-full justify-start">
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
