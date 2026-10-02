/**
 * Onglet Plans.
 *
 * La page listait des vignettes et proposait, au-dessus, un « atelier
 * multi-plans » qui composait plusieurs plans sur un même canvas. Deux outils de
 * dessin pour le même dossier, dont un que rien ne reliait au diagnostic :
 * l'atelier est retiré, et la page se concentre sur ce qu'un plan apporte
 * vraiment au relevé.
 *
 * Elle tient donc en trois temps : choisir un plan dans la colonne de gauche,
 * le voir en grand avec ses zones déjà tracées, et lire en dessous ce que ces
 * zones donnent comme quantités pour les ouvrages du diagnostic.
 */
import { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Upload, Trash2, Loader2, AlertCircle, Ruler, Pencil, FileText, Image as ImageIcon,
  Check, ArrowRight, Link2,
} from 'lucide-react'
import { Button, Card, CardContent, Badge } from '@/components/ui'
import { PlanEditor } from '@/components/PlanEditor'
import { ApercuPlan } from '@/components/plans/ApercuPlan'
import { useOuvragesDuProjet } from '@/components/plans/ouvrages'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { uniteCourte } from '@/lib/devis'
import { computeCost, getMarketCoeff } from '@/lib/diagnostic-auto'
import {
  apportsDesPlans, reportPossible, arrondiQuantite, natureDe,
  type ApportPlan,
} from '@/lib/plan-quantites'
import type { ApiPlan, ApiDiagnosticItem } from '@/lib/api-types'

function formatTaille(octets: number): string {
  if (octets < 1024) return `${octets} o`
  if (octets < 1024 * 1024) return `${Math.round(octets / 1024)} Ko`
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`
}

export function ProjectPlans() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const champFichier = useRef<HTMLInputElement>(null)
  const [edite, setEdite] = useState<ApiPlan | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['plans', id],
    queryFn: () => api.plans.list(id!),
    enabled: !!id,
  })
  const plans = useMemo(() => data?.plans ?? [], [data])

  const envoyer = useMutation({
    mutationFn: (file: File) => api.plans.upload(id!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', id] }),
    onError: (e) => setErreur((e as Error)?.message ?? "Échec de l'envoi"),
  })
  const supprimer = useMutation({
    mutationFn: (planId: string) => api.plans.delete(planId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', id] }),
  })

  const surFichiers = async (files: FileList | null) => {
    if (!files) return
    setErreur(null)
    for (const file of Array.from(files)) await envoyer.mutateAsync(file).catch(() => {})
    if (champFichier.current) champFichier.current.value = ''
  }

  // Tout ce qui est rattaché, sur l'ensemble des plans : quatre façades relevées
  // sur quatre documents donnent bien une seule quantité pour l'ouvrage.
  const apports = useMemo(() => apportsDesPlans(plans), [plans])
  const zonesLiees = useMemo(() => {
    const s = new Set<string>()
    for (const a of apports.values()) for (const z of a.zones) s.add(z.annotationId)
    return s
  }, [apports])

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl font-bold md:text-2xl">Plans</h1>
          <p className="text-sm text-muted-foreground">
            {plans.length} plan{plans.length !== 1 ? 's' : ''} · PDF ou image, 30 Mo max
          </p>
        </div>
        <Button onClick={() => champFichier.current?.click()} disabled={envoyer.isPending} data-visite="plans-ajouter" className="w-full sm:w-auto">
          {envoyer.isPending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Envoi…</>
            : <><Upload className="mr-2 h-4 w-4" />Ajouter un plan</>}
        </Button>
        <input ref={champFichier} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => surFichiers(e.target.files)} />
      </div>

      {erreur && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erreur}</div>}

      {isLoading ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></CardContent></Card>
      ) : isError ? (
        <Card><CardContent className="py-16 text-center"><AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-500" /><p className="text-sm text-red-700">Erreur de chargement</p></CardContent></Card>
      ) : plans.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center md:py-20">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Ruler className="h-8 w-8 text-primary" />
            </div>
            <h2 className="mb-2 text-lg font-semibold">Aucun plan</h2>
            <p className="mx-auto mb-6 max-w-sm text-sm text-muted-foreground">
              Ajoutez les plans du bâtiment. Une fois le plan étalonné, les zones que vous tracez
              se rattachent aux ouvrages du diagnostic et leur donnent une quantité relevée.
            </p>
            <Button size="lg" className="px-8" data-visite="plans-vide" onClick={() => champFichier.current?.click()}>
              <Upload className="mr-2 h-5 w-5" />Ajouter un plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-visite="plans-liste">
            {plans.map((p, i) => (
              <VignettePlan
                key={p.id}
                // La première vignette sert de repère à la visite guidée, qui
                // fait ouvrir l'éditeur pour y montrer les outils.
                repere={i === 0 ? 'plan-vignette' : undefined}
                plan={p}
                zonesLiees={zonesLiees}
                onOuvrir={() => setEdite(p)}
                onSupprimer={() => { if (confirm(`Supprimer « ${p.name} » ?`)) supprimer.mutate(p.id) }}
              />
            ))}
          </div>
          <div data-visite="plans-quantites"><Quantites projectId={id!} apports={apports} /></div>
        </div>
      )}

      {edite && <PlanEditor plan={edite} onClose={() => setEdite(null)} />}
    </div>
  )
}

/**
 * Une vignette par plan : l'aperçu, son nom, et ce qu'il vaut pour le relevé.
 *
 * Le plan s'ouvrait auparavant en grand dans la page avant de pouvoir être
 * édité. C'était une étape pour rien : on vient ici pour dessiner, pas pour
 * regarder. La vignette dit l'essentiel, et le clic mène directement à
 * l'éditeur.
 */
function VignettePlan({ plan, zonesLiees, onOuvrir, onSupprimer, repere }: {
  /** Nom du repère `data-visite`, s'il y en a un. */
  repere?: string
  plan: ApiPlan
  zonesLiees: Set<string>
  onOuvrir: () => void
  onSupprimer: () => void
}) {
  const mesures = (plan.annotations ?? []).filter((a) => natureDe(a) !== 'aucune')
  const rattachees = mesures.filter((a) => zonesLiees.has(a.id)).length

  return (
    /* La suppression est posée par-dessus la vignette et non dedans : un bouton
       dans un bouton n'est pas du HTML valide, et le navigateur défait alors
       l'imbrication en déplaçant les nœuds. */
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <button onClick={onOuvrir} data-visite={repere} className="block w-full text-left" title={`Ouvrir ${plan.name}`}>
        <div className="relative">
          <ApercuPlan plan={plan} largeurCible={480} zonesLiees={zonesLiees} className="aspect-[4/3] w-full border-b" />
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/0 transition-colors group-hover:bg-foreground/10">
            <span className="flex items-center gap-1.5 rounded-lg bg-background/95 px-2.5 py-1.5 text-xs font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <Pencil className="h-3.5 w-3.5" />Éditer
            </span>
          </span>
        </div>
        <div className="p-3 pr-10">
          <p className="truncate text-sm font-medium" title={plan.name}>{plan.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {plan.mimeType === 'application/pdf' ? <FileText className="h-3 w-3 shrink-0" /> : <ImageIcon className="h-3 w-3 shrink-0" />}
            {formatTaille(plan.size)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {plan.scalePxPerM
              ? <Badge variant="outline" className="gap-1 text-[11px] font-normal"><Check className="h-3 w-3" />Étalonné</Badge>
              : <Badge variant="outline" className="gap-1 text-[11px] font-normal text-amber-700"><AlertCircle className="h-3 w-3" />Pas d’échelle</Badge>}
            {mesures.length > 0 && (
              <Badge variant="outline" className="gap-1 text-[11px] font-normal">
                <Link2 className="h-3 w-3" />{rattachees}/{mesures.length}
              </Badge>
            )}
          </div>
        </div>
      </button>
      <button
        onClick={onSupprimer}
        className="absolute right-2 top-2 rounded-lg bg-background/90 p-1.5 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
        title="Supprimer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Ce que les plans apportent au diagnostic.
 *
 * Le tableau confronte, pour chaque ouvrage rattaché, la quantité relevée sur
 * les plans et celle qui figure aujourd'hui dans le relevé. Le report est
 * explicite : la quantité du dossier peut avoir été relevée sur place, et une
 * mesure de plan n'a pas à l'écraser dans le dos de celui qui l'a prise.
 */
function Quantites({ projectId, apports }: { projectId: string; apports: Map<string, ApportPlan> }) {
  const queryClient = useQueryClient()
  const { items } = useOuvragesDuProjet(projectId)

  const reporter = useMutation({
    mutationFn: async ({ it, quantite }: { it: ApiDiagnosticItem; quantite: number }) => {
      // Même règle qu'à la saisie : la quantité passe en « relevée », et le coût
      // suit, sauf s'il a été forcé à la main.
      const patch: Partial<ApiDiagnosticItem> = { area: quantite, quantityManual: true }
      if (!it.costManual && it.state) {
        const catalogue = it.catalogItemId != null ? (await api.cfc.item(it.catalogItemId)).item : null
        const cout = computeCost(catalogue, it.state, quantite)
        patch.estimatedCost = (cout ?? null) as unknown as string | null
        patch.costIndex = getMarketCoeff()
      }
      return api.diagnostics.updateItem(it.id, patch)
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic-items', r.item.diagnosticId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const lignes = useMemo(() => {
    return Array.from(apports.values())
      .map((apport) => ({ apport, ouvrage: items.find((i) => i.id === apport.itemId) ?? null }))
      .filter((l) => l.ouvrage)
      .sort((a, b) => (a.ouvrage!.cfcCode ?? '').localeCompare(b.ouvrage!.cfcCode ?? '', undefined, { numeric: true }))
  }, [apports, items])

  if (apports.size === 0) {
    return (
      <Card>
        <CardContent className="p-4">
          <h2 className="font-semibold">Quantités depuis les plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aucune zone n’est encore rattachée. Dans l’éditeur, tracez une zone ou une cote,
            sélectionnez-la, puis « Rattacher à un ouvrage » : sa surface ou sa longueur viendra
            remplacer l’estimation déduite des dimensions du bâtiment.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="font-semibold">Quantités depuis les plans</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
          Somme des zones rattachées, tous plans confondus.
        </p>

        <div className="space-y-2">
          {lignes.map(({ apport, ouvrage }) => (
            <LigneQuantite
              key={apport.itemId}
              apport={apport}
              ouvrage={ouvrage!}
              enCours={reporter.isPending && reporter.variables?.it.id === ouvrage!.id}
              onReporter={(quantite) => reporter.mutate({ it: ouvrage!, quantite })}
            />
          ))}
        </div>

        {reporter.isError && (
          <p className="mt-3 text-sm text-red-700">Le report a échoué : {(reporter.error as Error)?.message}</p>
        )}
      </CardContent>
    </Card>
  )
}

const RAISONS: Record<string, string> = {
  'non-etalonne': 'Plan non étalonné',
  'unite-incompatible': 'Unité incompatible',
  'rien-a-reporter': 'Rien à reporter',
  'deja-a-jour': 'À jour',
}

function LigneQuantite({ apport, ouvrage, enCours, onReporter }: {
  apport: ApportPlan
  ouvrage: ApiDiagnosticItem
  enCours: boolean
  onReporter: (quantite: number) => void
}) {
  const verdict = reportPossible(apport, ouvrage)
  const symbole = apport.nature === 'surface' ? 'm²' : 'm'
  const unite = uniteCourte(ouvrage.unit)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className="mr-2 font-mono text-xs text-muted-foreground">{ouvrage.cfcCode}</span>
          {ouvrage.cfcLabel}
        </p>
        <p className="text-xs text-muted-foreground">
          {apport.zones.length} mesure{apport.zones.length !== 1 ? 's' : ''} sur{' '}
          {new Set(apport.zones.map((z) => z.planId)).size} plan{new Set(apport.zones.map((z) => z.planId)).size !== 1 ? 's' : ''}
          {unite ? ` · ouvrage en ${unite}` : ''}
          {apport.nonEtalonnees > 0 && (
            <span className="text-amber-700"> · {apport.nonEtalonnees} sur un plan sans échelle</span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2 text-sm tabular-nums">
        <span className="text-muted-foreground">{ouvrage.area != null ? `${ouvrage.area} ${unite ?? ''}` : 'aucune'}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-semibold">{arrondiQuantite(apport.total)} {symbole}</span>
      </div>

      {verdict.ok ? (
        <Button size="sm" onClick={() => onReporter(verdict.quantite)} disabled={enCours}>
          {enCours ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reporter
        </Button>
      ) : (
        <span className={cn('text-xs', verdict.raison === 'deja-a-jour' ? 'text-emerald-700' : 'text-amber-700')}>
          {verdict.raison === 'deja-a-jour' && <Check className="mr-1 inline h-3.5 w-3.5" />}
          {RAISONS[verdict.raison]}
        </span>
      )}
    </div>
  )
}
