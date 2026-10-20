import { useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useIsMobile } from '@/lib/use-mobile'
import { Loader2, AlertCircle, ClipboardCheck, Plus, CalendarCheck, Navigation, Phone } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardContent, Select, Input } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { ProjectMap } from '@/components/ProjectMap'
import { TerrainConstraintsCard } from '@/components/TerrainConstraintsCard'
import { StatistiquesDiagnostic, ZoneDanger } from '@/components/diagnostic/StatistiquesDiagnostic'
import { statusLabels, statusColors, buildingTypeLabels, type BuildingType } from '@/data/mock'
import type { ProjectStatus, ApiProject, RoofType, DimensionSuivie, SourceDimension } from '@/lib/api-types'
import { computeProjectMetrics, perimeterWarning, floorsWarning } from '@/lib/formulas'
import { LIBELLE_SOURCE, sourceDe, sourcesApresSaisie } from '@/lib/sources-dimensions'
import { formatDate } from '@/lib/utils'
import { api } from '@/lib/api'
import { aAppeler, lienItineraire } from '@/lib/visite-mails'

const STATUSES: ProjectStatus[] = ['NON_PLANIFIE', 'PLANIFIE', 'EN_COURS', 'EN_REVUE', 'TERMINE', 'ARCHIVE']
const STATUS_OPTIONS = STATUSES.map(s => ({ value: s, label: statusLabels[s], color: statusColors[s] }))
const BUILDING_TYPES: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET', 'SCOLAIRE', 'BUREAU', 'ADMINISTRATIF', 'INDUSTRIEL', 'HOTEL', 'COMMERCIAL', 'AUTRE']
const RESIDENTIAL: BuildingType[] = ['LOGEMENT', 'VILLA', 'CHALET']

function Field({ label, children, source }: { label: string; children: React.ReactNode; source?: SourceDimension | null }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
      {/* La mesure des plans se distingue d'une saisie : c'est elle que le rapport cite. */}
      {source === 'plans' && <p className="mt-1 text-[11px] font-medium text-emerald-700">{LIBELLE_SOURCE.plans}</p>}
    </div>
  )
}

/**
 * Ouvrir un dossier, c'est ouvrir son relevé : l'éditeur est l'écran du
 * travail, la fiche du bâtiment n'en est qu'un outil. Sur téléphone, la fiche
 * garde son rôle d'aiguillage vers l'éditeur plein écran.
 */
export function OuvertureDossier() {
  const { id } = useParams<{ id: string }>()
  const isMobile = useIsMobile()
  if (isMobile) return <ProjectDetail aiguillage />
  return <Navigate to={`/app/projects/${id}/diagnostic`} replace />
}

/**
 * La fiche du bâtiment. Avec `aiguillage` (l'ouverture d'un dossier sur
 * téléphone), elle ne s'affiche pas : elle mène à l'éditeur plein écran. Sans
 * lui, elle s'affiche partout, téléphone compris, depuis le sommaire du dossier.
 */
export function ProjectDetail({ aiguillage = false }: { aiguillage?: boolean } = {}) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  })

  // Les interlocuteurs de la visite : la fiche propose d'appeler celui qui ouvre.
  const visiteQ = useQuery({ queryKey: ['visite', id], queryFn: () => api.visite.get(id!), enabled: !!id && !aiguillage })

  const update = useMutation({
    mutationFn: (body: Partial<ApiProject>) => api.projects.update(id!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const createDiag = useMutation({
    mutationFn: () => api.projects.createDiagnostic(id!, {}),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      // Téléphone : l'éditeur plein écran ; ordinateur : le relevé dans son dossier.
      navigate(window.matchMedia('screen and (max-width: 767px)').matches ? `/app/diagnostic/${res.diagnostic.id}` : `/app/projects/${id}/diagnostic`)
    },
  })

  // Sur mobile : ouvrir un diagnostic mène DIRECTEMENT à l'éditeur, jamais à la page projet.
  // S'il n'existe pas encore de diagnostic, on en crée un puis on bascule sur l'éditeur.
  const isMobile = useIsMobile()
  const firstDiagId = data?.diagnostics?.[0]?.id
  const autoDiag = useRef(false)
  useEffect(() => {
    if (!aiguillage || !isMobile || !data) return
    if (firstDiagId) { navigate(`/app/diagnostic/${firstDiagId}`, { replace: true }); return }
    if (!autoDiag.current && !createDiag.isPending) { autoDiag.current = true; createDiag.mutate() }
  }, [aiguillage, isMobile, data, firstDiagId, navigate, createDiag])

  // Mobile : on n'affiche jamais la page projet (onglets, cartes…), seulement un chargement le temps de basculer.
  if (aiguillage && isMobile && (isLoading || data)) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Ouverture de l'éditeur…</div>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (isError || !data) {
    return (
      <Card><CardContent className="py-16 text-center">
        <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <p className="text-sm text-red-700">{(error as Error)?.message ?? 'Projet introuvable'}</p>
        <Link to="/app/projects"><Button variant="outline" className="mt-4">Retour aux diagnostics</Button></Link>
      </CardContent></Card>
    )
  }

  const { project, diagnostics } = data
  const diagnostic = diagnostics[0]
  const metrics = computeProjectMetrics(project)
  // Garde-fous : les données de registre couvrent parfois un îlot entier, pas le bâtiment.
  const perimetreDouteux = perimeterWarning(project.perimeter, project.builtArea)
  const etagesDouteux = floorsWarning(project.nbFloors, project.floorArea, project.builtArea)
  const tropDeRenoves = (project.renovatedApartments ?? 0) > (project.nbApartments ?? 0)

  // Sauvegarde au blur (seulement si la valeur a changé).
  const saveText = (key: keyof ApiProject, current: string | null, required = false) =>
    (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      const v = e.target.value.trim()
      if (v === (current ?? '')) return
      if (required && v === '') return
      update.mutate({ [key]: v === '' ? null : v } as Partial<ApiProject>)
    }
  const SUIVIES: DimensionSuivie[] = ['floorArea', 'builtArea', 'facadeArea', 'perimeter', 'nbFloors', 'floorHeight', 'windowPct', 'roofArea', 'nbApartments', 'nbStaircases']
  const saveNum = (key: keyof ApiProject, current: number | null) =>
    (e: React.FocusEvent<HTMLInputElement>) => {
      const raw = e.target.value.trim()
      const v = raw === '' ? null : Number(raw)
      if (v === (current ?? null)) return
      // Une dimension corrigée à la main passe en « saisi au dossier » : elle
      // l'emporte sur les plans, tant qu'ils ne donnent pas une autre mesure.
      const suivie = SUIVIES.includes(key as DimensionSuivie)
      update.mutate({ [key]: v, ...(suivie ? { sources: sourcesApresSaisie(project, [key as DimensionSuivie]) } : {}) } as Partial<ApiProject>)
    }
  const src = (champ: DimensionSuivie) => sourceDe(project, champ)

  const isResidential = RESIDENTIAL.includes(project.buildingType)
  const adresse = [project.address, [project.postalCode, project.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const contact = aAppeler(visiteQ.data?.contacts ?? [])
  const lienDiscret = 'inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground'

  return (
    <div className="space-y-6">
      {/* Header : nom + statut + action diagnostic */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <Input
            defaultValue={project.name}
            onBlur={saveText('name', project.name, true)}
            className="text-xl md:text-2xl font-bold h-auto border-0 px-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <Dropdown
                value={project.status}
                options={STATUS_OPTIONS}
                disabled={update.isPending}
                onChange={(v) => update.mutate({ status: v as ProjectStatus })}
              />
              {update.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            {/* Se rendre au bâtiment, et joindre qui l'ouvre. */}
            <a href={lienItineraire(adresse)} target="_blank" rel="noopener noreferrer" className={lienDiscret}>
              <Navigation className="h-3.5 w-3.5" />Itinéraire
            </a>
            {contact ? (
              <a href={`tel:${contact.phone!.replace(/\s/g, '')}`} className={lienDiscret} title={`Appeler ${contact.name}`}>
                <Phone className="h-3.5 w-3.5" />Appeler {contact.name}<span className="text-muted-foreground/70">{contact.phone}</span>
              </a>
            ) : visiteQ.data && (
              <Link to={`/app/projects/${project.id}/visite`} className={lienDiscret}>
                <Phone className="h-3.5 w-3.5" />Ajouter un numéro à appeler
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
        {/* L'organisation de la visite a son onglet : interlocuteurs, rendez-vous, mails. */}
        <Link to={`/app/projects/${project.id}/visite`} className="shrink-0">
          <Button variant="outline" className="w-full sm:w-auto"><CalendarCheck className="mr-2 h-4 w-4" />Organiser la visite</Button>
        </Link>
        {diagnostic ? (
          <Link to={`/app/projects/${project.id}/diagnostic`} className="shrink-0">
            <Button className="w-full sm:w-auto"><ClipboardCheck className="mr-2 h-4 w-4" />Ouvrir le relevé</Button>
          </Link>
        ) : (
          <Button onClick={() => createDiag.mutate()} disabled={createDiag.isPending} className="w-full shrink-0 sm:w-auto">
            {createDiag.isPending
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Création…</>
              : <><Plus className="mr-2 h-4 w-4" />Démarrer un diagnostic</>}
          </Button>
        )}
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        {/* Informations principales — éditables */}
        <Card className="flex flex-col">
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="grid flex-1 grid-cols-2 gap-4 content-between">
              <div className="col-span-2">
                <Field label="Adresse">
                  <Input defaultValue={project.address} onBlur={saveText('address', project.address, true)} />
                </Field>
              </div>
              <Field label="NPA"><Input defaultValue={project.postalCode ?? ''} maxLength={4} onBlur={saveText('postalCode', project.postalCode)} /></Field>
              <Field label="Ville"><Input defaultValue={project.city} onBlur={saveText('city', project.city, true)} /></Field>
              <Field label="Canton"><Input defaultValue={project.canton} maxLength={2} onBlur={saveText('canton', project.canton, true)} /></Field>
              <Field label="Parcelle"><Input defaultValue={project.parcelNumber ?? ''} onBlur={saveText('parcelNumber', project.parcelNumber)} /></Field>
              <Field label="Année construction"><Input type="number" defaultValue={project.yearBuilt ?? ''} onBlur={saveNum('yearBuilt', project.yearBuilt)} /></Field>
              <Field label="Année rénovation"><Input type="number" defaultValue={project.renovationYear ?? ''} placeholder="Si rénové" onBlur={saveNum('renovationYear', project.renovationYear)} /></Field>
              <Field label="Type de bâtiment">
                <Select value={project.buildingType} onChange={(e) => update.mutate({ buildingType: e.target.value as BuildingType })}>
                  {BUILDING_TYPES.map(t => <option key={t} value={t}>{buildingTypeLabels[t]}</option>)}
                </Select>
              </Field>
              <Field label="Type de toiture">
                <Select value={project.roofType ?? ''} onChange={(e) => update.mutate({ roofType: (e.target.value || null) as RoofType | null })}>
                  <option value="">Non précisé</option>
                  <option value="PLATE">Plate</option>
                  <option value="PENTE">En pente</option>
                  <option value="MIXTE">Mixte</option>
                </Select>
              </Field>
              {isResidential && (
                <>
                <Field label="Appartements"><Input type="number" defaultValue={project.nbApartments ?? ''} onBlur={saveNum('nbApartments', project.nbApartments)} /></Field>
                <Field label="Dont rénovés">
                  <Input type="number" min="0" defaultValue={project.renovatedApartments ?? ''} onBlur={saveNum('renovatedApartments', project.renovatedApartments ?? null)} />
                  {tropDeRenoves && <p className="mt-1 text-[11px] text-amber-700">Plus de logements rénovés que de logements.</p>}
                </Field>
                </>
              )}
              <Field label="Étages" source={src('nbFloors')}>
                <Input type="number" defaultValue={project.nbFloors ?? ''} onBlur={saveNum('nbFloors', project.nbFloors)} />
                {etagesDouteux && <p className="mt-1 text-[11px] text-amber-700">{etagesDouteux}</p>}
              </Field>
              <Field label="Hauteur étage (m)"><Input type="number" step="0.1" defaultValue={project.floorHeight ?? ''} onBlur={saveNum('floorHeight', project.floorHeight)} /></Field>
            </div>
          </CardContent>
        </Card>

        {/* Colonne droite : surfaces + carte compacte */}
        <div className="flex flex-col gap-4 md:gap-6">

          {/* Surfaces — saisies éditables + estimations calculées */}
          <Card>
            <CardHeader><CardTitle>Surfaces</CardTitle></CardHeader>
            <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Plancher (m²)" source={src('floorArea')}><Input type="number" defaultValue={project.floorArea ?? ''} onBlur={saveNum('floorArea', project.floorArea)} /></Field>
              <Field label="Bâtie (m²)" source={src('builtArea')}><Input type="number" defaultValue={project.builtArea ?? ''} onBlur={saveNum('builtArea', project.builtArea)} /></Field>
              <Field label="Périmètre (ml)" source={src('perimeter')}>
                <Input type="number" defaultValue={project.perimeter ?? ''} onBlur={saveNum('perimeter', project.perimeter)} />
                {perimetreDouteux && <p className="mt-1 text-[11px] text-amber-700">{perimetreDouteux}</p>}
              </Field>
              <Field label="Terrain (m²)"><Input type="number" defaultValue={project.terrainArea ?? ''} onBlur={saveNum('terrainArea', project.terrainArea)} /></Field>
              <Field label="% fenêtres" source={src('windowPct')}><Input type="number" defaultValue={project.windowPct} onBlur={saveNum('windowPct', project.windowPct)} /></Field>
            </div>

            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-4 mb-2">Façade et toiture</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { l: 'Façade',   v: `${metrics.facade.toFixed(0)} m²`, s: src('facadeArea') },
                { l: 'Fenêtres', v: `${metrics.windows.toFixed(0)} m²`, s: src('windowPct') },
                { l: 'Toiture',  v: metrics.roof != null ? `${metrics.roof} m²` : `${metrics.flatRoof.toFixed(0)}–${metrics.slopedRoof.toFixed(0)} m² (à préciser)`, s: src('roofArea') },
              ].map(m => (
                <div key={m.l} className="flex items-baseline justify-between gap-2 rounded bg-muted/50 p-2 text-sm">
                  <span className="text-muted-foreground">{m.l}</span>
                  <span className="text-right font-medium">
                    {m.v}
                    {m.s === 'plans' && <span className="block text-[11px] font-medium text-emerald-700">{LIBELLE_SOURCE.plans}</span>}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              Calculées du périmètre, des étages et du type de toiture, sauf quand les plans les mesurent. La surface à échafauder est celle que le devis chiffre (onglet Coûts).{!project.roofType && !project.roofArea && ' Toiture non présumée tant que le type n\'est pas précisé (ci-dessus).'}
            </p>
          </CardContent>
        </Card>
          {/* Localisation — carte compacte, libellés flottants */}
          <Card className="relative h-60 shrink-0 overflow-hidden sm:h-64">
            <ProjectMap
              address={project.address}
              postalCode={project.postalCode}
              city={project.city}
              canton={project.canton}
            />
          </Card>
        </div>
      </div>

      <TerrainConstraintsCard project={project} />

      {/* L'état du diagnostic, là où l'on vient savoir où en est le bâtiment.
          Ces chiffres occupaient l'onglet Diagnostic, qui ne porte plus que
          l'éditeur. */}
      {diagnostic && (
        <>
          <div className="pt-2">
            <h2 className="text-lg font-semibold">Le diagnostic</h2>
            <p className="text-sm text-muted-foreground">
              {diagnostic.visitDate
                ? `Visite du ${formatDate(new Date(diagnostic.visitDate))}`
                : 'Visite non planifiée'}
            </p>
          </div>
          <StatistiquesDiagnostic diagnosticId={diagnostic.id} projectId={project.id} />
          <ZoneDanger diagnosticId={diagnostic.id} onSupprime={() => navigate('/app/projects')} />
        </>
      )}
    </div>
  )
}
