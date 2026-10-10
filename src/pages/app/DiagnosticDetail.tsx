import { useMemo, useState, useEffect, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Loader2, AlertCircle, AlertTriangle, Search, Plus, Check, ImagePlus, X, ArrowRight, ScanSearch, Trash2, ChevronDown, RefreshCw,
} from 'lucide-react'
import {
  Button, Card, CardHeader, CardTitle, CardContent, Badge, Textarea, Input,
} from '@/components/ui'
import { useGuideMode, GUIDE_MODE_LABELS, type GuideMode } from '@/lib/use-guide-mode'
import { DiagnosticGuide } from '@/components/DiagnosticGuide'
import { stateLabels, stateColors, priorityColors, priorityDescriptions } from '@/data/mock'
import {
  groupesDuReleve, groupesIncomplets, partEffective, partALAjout, quantiteDuType,
  phraseDuGroupe, type GroupeSurface,
} from '@/lib/groupes-surface'
import { formatCHF, cn } from '@/lib/utils'
import { dureeVieDeReference, dureeVieResiduelle } from '@/lib/duree-vie'
import { aUnOubliImportant, bilanDesOublis, oublisDUnReleve, phraseDAlerte, relevesIncomplets } from '@/lib/oublis'
import { circonference, decalageAnneau, partRemplie } from '@/lib/anneau'
import { RecapOublis, type ModeRecap } from '@/components/diagnostic/RecapOublis'
import {
  STATE_PRIORITY, workForState, priceForState, computeCost, computeCostFromPrice,
  appliedUnitPrice, getMarketCoeff, priceBasisNote, priceToNumber, type PrixCatalogue,
} from '@/lib/diagnostic-auto'
// La base CFC du bureau remplace l'ancien catalogue : les étapes de visite, les
// états et les prix viennent d'elle, et le relevé est le couple article et étape.
import { useBaseCfc } from '@/lib/base-cfc/requete'
import {
  filtrerLeParcours, localisationDeLaZone, parcoursDuDiagnostic,
  type EtapeDuDiagnostic, type LigneDeVisite,
} from '@/lib/base-cfc/catalogue'
import {
  ouvrageDeLArticle, ouvrageDuReleve, resolutionDeQuantite, type OuvrageSaisi,
} from '@/lib/base-cfc/pont'
import { donneesDuBatiment } from '@/lib/base-cfc/batiment'
import { cleDuReleve } from '@/lib/base-cfc/etapes'
import type { DonneesBatiment } from '@/lib/base-cfc/quantites'
// Les relevés d'avant la bascule portent encore une localisation au lieu d'une étape.
import { LIBELLE_LOCALISATION } from '@/lib/localisation'
import { api, ApiError } from '@/lib/api'
import { ProjectSectionsMenu } from '@/components/ProjectSectionsMenu'
import { CameraCapture } from '@/components/CameraCapture'
import { PanneauGlissant } from '@/components/PanneauGlissant'
import { vibrer } from '@/lib/motion'
import { useIsMobile } from '@/lib/use-mobile'
import type { ApiDiagnosticItem, ElementState, Priority } from '@/lib/api-types'

/**
 * Réindexation des coûts au marché du jour.
 *
 * Les coûts sont figés à la saisie. Quand l'indice de construction change, ce
 * bouton les ramène tous au coefficient courant, sans ressaisir le dossier.
 * On montre l'effet avant de l'appliquer : un chiffrage qui bouge tout seul
 * derrière le dos de celui qui l'a remis n'est pas acceptable.
 */
function ReindexPanel({ diagnosticId }: { diagnosticId: string }) {
  const qc = useQueryClient()
  const [apercu, setApercu] = useState<Awaited<ReturnType<typeof api.diagnostics.reindex>> | null>(null)

  const simuler = useMutation({
    mutationFn: () => api.diagnostics.reindex(diagnosticId, true),
    onSuccess: setApercu,
  })
  const appliquer = useMutation({
    mutationFn: () => api.diagnostics.reindex(diagnosticId, false),
    onSuccess: () => {
      setApercu(null)
      qc.invalidateQueries({ queryKey: ['diagnostic', diagnosticId] })
      qc.invalidateQueries({ queryKey: ['diagnostic-items', diagnosticId] })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  if (!apercu) {
    return (
      <button
        onClick={() => simuler.mutate()}
        disabled={simuler.isPending}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {simuler.isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <RefreshCw className="h-3.5 w-3.5" />}
        Actualiser les prix au marché du jour
      </button>
    )
  }

  const rien = apercu.items.updated === 0
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2">
      {rien ? (
        <p>Les coûts sont déjà au coefficient du jour (×{apercu.market.coeff}). Rien à changer.</p>
      ) : (
        <>
          <p>
            {apercu.items.updated} poste{apercu.items.updated > 1 ? 's' : ''} sur {apercu.items.total} passerai
            {apercu.items.updated > 1 ? 'ent' : 't'} au coefficient ×{apercu.market.coeff}.
            {apercu.items.manual > 0 && ` ${apercu.items.manual} coût${apercu.items.manual > 1 ? 's' : ''} repris à la main ${apercu.items.manual > 1 ? 'restent' : 'reste'} inchangé${apercu.items.manual > 1 ? 's' : ''}.`}
          </p>
          <p className="tabular-nums">
            Total {formatCHF(apercu.before)} → <strong>{formatCHF(apercu.after)}</strong>{' '}
            <span className={apercu.delta >= 0 ? 'text-amber-600' : 'text-green-600'}>
              ({apercu.delta >= 0 ? '+' : ''}{formatCHF(apercu.delta)})
            </span>
          </p>
        </>
      )}
      <div className="flex gap-2">
        {!rien && (
          <Button size="sm" onClick={() => appliquer.mutate()} disabled={appliquer.isPending}>
            {appliquer.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Appliquer
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => setApercu(null)}>Fermer</Button>
      </div>
      <p className="text-[11px] text-muted-foreground border-t pt-2">{priceBasisNote()}</p>
    </div>
  )
}

// ---------- Helpers ----------

const STATES: ElementState[] = ['TRES_BON', 'BON', 'MOYEN', 'MAUVAIS']
const PRIORITIES: Priority[] = ['I', 'II', 'III']

// Année d'intervention par défaut (déduite de la priorité), utilisée comme placeholder tant
// que le diagnostiqueur ne l'a pas saisie. Doit rester en phase avec deriveInterventionYear() serveur.
function deriveInterventionYearClient(priority: Priority | null): number {
  const base = new Date().getFullYear()
  // Barème du bureau : I = 0-5 ans, II = 5-10 ans, III = au-delà de 10 ans.
  return priority === 'I' ? base : priority === 'II' ? base + 5 : priority === 'III' ? base + 10 : base + 5
}

/** Coût numérique à partir d'un champ Decimal stocké en string (ou null). */
const toNum = (v: string | null | undefined): number => (v ? Number(v) : 0)

/** Forme du cache de la liste d'éléments (queryKey ['diagnostic-items', id]). */
type ItemsData = { items: ApiDiagnosticItem[]; count: number }

// ---------- Component ----------

/**
 * L'éditeur de diagnostic.
 *
 * Il sert à deux endroits : à son adresse propre, /app/diagnostic/:id, et encastré
 * dans l'onglet Diagnostic d'un projet, qui ne contient plus que lui. D'où les deux
 * paramètres : `diagnosticId` quand l'identifiant ne vient pas de l'URL, et
 * `encastre` pour retirer la flèche de retour et le titre, que la barre d'onglets
 * porte déjà.
 */
export function DiagnosticDetail({ diagnosticId, encastre = false }: {
  diagnosticId?: string
  encastre?: boolean
} = {}) {
  const { id: idUrl } = useParams<{ id: string }>()
  const id = diagnosticId ?? idUrl
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isMobile = useIsMobile()

  // ----- queries -----
  const diagQuery = useQuery({
    queryKey: ['diagnostic', id],
    queryFn: () => api.diagnostics.get(id!),
    enabled: !!id,
  })

  const itemsQuery = useQuery({
    queryKey: ['diagnostic-items', id],
    queryFn: () => api.diagnostics.listItems(id!),
    enabled: !!id,
  })

  const baseQuery = useBaseCfc()

  // Projet (pour les surfaces qui servent au calcul auto des quantités).
  const projectId = diagQuery.data?.diagnostic.projectId
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.projects.get(projectId!),
    enabled: !!projectId,
  })

  // Données du bâtiment, d'où les quantités découlent. Un champ vide y vaut null
  // et non zéro : un ouvrage dont on ignore la surface n'est pas un ouvrage de
  // surface nulle, et le devis ne doit pas les confondre.
  const batiment = useMemo(() => donneesDuBatiment(projectQuery.data?.project ?? {}), [projectQuery.data])

  // ----- local UI state -----
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [guideMode, setGuideMode] = useGuideMode()

  // ----- mutations -----
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['diagnostic', id] })
    queryClient.invalidateQueries({ queryKey: ['diagnostic-items', id] })
    queryClient.invalidateQueries({ queryKey: ['project'] }) // garde le compteur du résumé à jour
  }

  // Cache de la liste affichée : mis à jour de façon optimiste pour que la saisie
  // apparaisse instantanément (et fonctionne hors-ligne, la mutation partant en file).
  const itemsKey = ['diagnostic-items', id] as const
  const setItemsCache = (fn: (d: ItemsData) => ItemsData) =>
    queryClient.setQueryData<ItemsData>(itemsKey, (old) => (old ? fn(old) : old))
  const snapshotItems = () => queryClient.getQueryData<ItemsData>(itemsKey)

  /**
   * Part proposée pour un type qu'on ajoute à un groupe de surface.
   *
   * Calculée ici et passée à la mutation : lue depuis `mutationFn`, elle faisait
   * renoncer le compilateur React à mémoriser le relevé entier.
   */
  const partPourUnAjout = (ligne: LigneDeVisite) => {
    const groupe = ligne.article.groupeAlternatives
    if (!groupe) return null
    // Par étape : les sols de la cage d'escalier et ceux des appartements font
    // chacun leurs cent pour cent, et le premier type relevé de chaque côté
    // prend toute sa surface.
    const cle = `${groupe}@${ligne.etapeNumero}`
    const dejaLa = groupesSurface.find((g) => g.cle === cle)?.membres.length ?? 0
    return partALAjout(dejaLa)
  }

  const addItem = useMutation({
    mutationFn: (input: { ligne: LigneDeVisite; state?: ElementState | null; sharePct?: number | null }) => {
      const { ligne, state } = input
      const catalog = ouvrageDeLArticle(ligne.article, ligne.etapeNumero)
      const quantity = resolutionDeQuantite(catalog, batiment).quantity
      // Ajout « non évalué » par défaut : ni état, ni coût tant que le diagnostiqueur n'a pas choisi.
      const cost = state ? computeCost(catalog, state, quantity) : undefined
      const work = state ? workForState(catalog, state) : null
      return api.diagnostics.createItem(id!, {
        cfcCode: catalog.cfcCode,
        cfcLabel: catalog.description,
        // L'article et l'étape identifient le relevé : la peinture de la cage
        // d'escalier et celle des appartements ne se confondent plus.
        articleId: catalog.articleId,
        etapeNumero: ligne.etapeNumero,
        localisation: localisationDeLaZone(ligne.zone),
        state: state ?? null,
        priority: state ? STATE_PRIORITY[state] : null,
        works: work && work !== 'Néant' ? [work] : [],
        photos: [],
        // Le premier type relevé d'un groupe prend toute la surface ; les
        // suivants arrivent sans part, parce que la répartition est une
        // observation de terrain, pas une valeur à inventer.
        sharePct: input.sharePct ?? null,
        area: quantity,                              // quantité auto (surfaces) conservée
        unit: catalog.unit,
        estimatedCost: (cost ?? undefined) as unknown as string | undefined,
      })
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const prev = snapshotItems()
      const { ligne, state } = input
      const catalog = ouvrageDeLArticle(ligne.article, ligne.etapeNumero)
      const quantity = resolutionDeQuantite(catalog, batiment).quantity
      const cost = state ? computeCost(catalog, state, quantity) : undefined
      const work = state ? workForState(catalog, state) : null
      const now = new Date().toISOString()
      const temp: ApiDiagnosticItem = {
        id: `temp-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
        diagnosticId: id!,
        cfcCode: catalog.cfcCode,
        cfcLabel: catalog.description,
        catalogItemId: null,
        articleId: catalog.articleId,
        etapeNumero: ligne.etapeNumero,
        localisation: localisationDeLaZone(ligne.zone),
        state: state ?? null,
        priority: state ? STATE_PRIORITY[state] : null,
        notes: null,
        works: work && work !== 'Néant' ? [work] : [],
        photos: [],
        area: quantity ?? null,
        unit: catalog.unit,
        yearInstalled: null,
        interventionYear: null,
        estimatedCost: cost != null ? String(cost) : null,
        improvement: null,
        improvementCost: null,
        norms: null,
        normsCost: null,
        createdAt: now,
        updatedAt: now,
      }
      setItemsCache((d) => ({ items: [...d.items, temp], count: d.count + 1 }))
      setSelectedItemId(temp.id)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(itemsKey, ctx.prev) },
    onSuccess: (res) => {
      invalidateAll()
      setSelectedItemId(res.item.id)
    },
  })

  const updateItem = useMutation({
    mutationFn: (input: { itemId: string; data: Partial<ApiDiagnosticItem> }) =>
      api.diagnostics.updateItem(input.itemId, input.data),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const prev = snapshotItems()
      setItemsCache((d) => ({
        ...d,
        items: d.items.map((it) => (it.id === input.itemId ? { ...it, ...input.data } : it)),
      }))
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(itemsKey, ctx.prev) },
    onSuccess: () => invalidateAll(),
  })

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => api.diagnostics.deleteItem(itemId),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: itemsKey })
      const prev = snapshotItems()
      setItemsCache((d) => ({ items: d.items.filter((it) => it.id !== itemId), count: Math.max(0, d.count - 1) }))
      setSelectedItemId(null)
      return { prev }
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(itemsKey, ctx.prev) },
    onSuccess: () => {
      invalidateAll()
      setSelectedItemId(null)
    },
  })

  // Suppression du diagnostic entier (depuis le menu Sections).
  const deleteDiagnostic = useMutation({
    mutationFn: () => api.diagnostics.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      navigate(projectId ? `/app/projects/${projectId}` : '/app/dashboard')
    },
  })
  const handleDeleteDiagnostic = () => {
    if (window.confirm('Supprimer définitivement ce diagnostic et tous ses éléments ? Le bâtiment ne sera pas supprimé.')) {
      deleteDiagnostic.mutate()
    }
  }

  // ----- derived data -----
  // Référence stable : `?? []` produirait un tableau neuf à chaque rendu et casserait les mémorisations en aval.
  const items = useMemo(() => itemsQuery.data?.items ?? [], [itemsQuery.data])
  const articles = useMemo(() => baseQuery.data?.articles ?? [], [baseQuery.data])
  const etapesDeLaBase = useMemo(() => baseQuery.data?.etapes ?? [], [baseQuery.data])

  /**
   * Le parcours de visite : les étapes du tour du bâtiment, leurs ouvrages, et
   * le relevé déjà fait de chacun.
   *
   * Sans mémorisation manuelle : le compilateur React s'en charge, et un
   * `useMemo` qu'il ne sait pas reprendre lui fait abandonner tout le composant.
   * L'intitulé des surfaces principales suit l'affectation : « Salles de classe »
   * devant une école, « Bureaux » devant un immeuble administratif.
   */
  const parcours = parcoursDuDiagnostic(
    { articles, etapes: etapesDeLaBase },
    items,
    projectQuery.data?.project?.buildingType,
  )

  /**
   * Les groupes d'alternatives du relevé.
   *
   * Plusieurs types de façade décrivent une seule façade : chacun ne prend
   * qu'une part de sa surface. Les parts se comptent par étape, et les groupes
   * sont calculés ici, où l'on voit tout le relevé ; l'éditeur reçoit celui de
   * l'ouvrage ouvert.
   */
  const groupesSurface = groupesDuReleve(
    items.map((it) => ({
      id: it.id,
      cfcLabel: it.cfcLabel,
      sharePct: it.sharePct,
      etapeNumero: it.etapeNumero ?? null,
      cleArticle: it.articleId && it.etapeNumero != null ? cleDuReleve(it.articleId, it.etapeNumero) : null,
      catalogItemId: it.catalogItemId,
    })),
    parcours.etapes.flatMap((e) => e.domaines.flatMap((d) => d.lignes))
      .map((l) => ({ id: l.cle, surfaceGroup: l.article.groupeAlternatives })),
  )
  const groupeDeLOuvrage = (itemId: string) =>
    groupesSurface.find((g) => g.membres.some((m) => m.id === itemId)) ?? null

  // Une recherche en cours réduit le parcours aux ouvrages qui y répondent,
  // accents et casse ignorés.
  const grouped = filtrerLeParcours(parcours.etapes, search)

  // Parcours de visite : une étape à la fois, comme sur le terrain. null = tout voir.
  // Le récapitulatif de ce qui reste à faire, ouvert soit depuis l'alerte, soit
  // au moment de clore la visite.
  const [recap, setRecap] = useState<ModeRecap | null>(null)

  const terminer = useMutation({
    mutationFn: () => api.diagnostics.update(id!, { status: 'COMPLETED' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnostic', id] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      setRecap(null)
    },
  })

  const [etape, setEtape] = useState<EtapeChoisie>(null)
  // Ouvrage choisi dans l'étape (façade, fenêtres…) : le niveau intermédiaire du
  // parcours guidé, entre l'étape et les types.
  const [categorie, setCategorie] = useState<string | null>(null)
  const etapesVisibles = etape == null ? grouped : grouped.filter((g) => g.numero === etape)

  // selected
  const selectedDiagItem = items.find(i => i.id === selectedItemId) ?? null
  // null pour un relevé dont l'article n'est pas dans la base : il garde son état
  // et ses montants, et se corrige à la main.
  const selectedCatalog = ouvrageDuReleve(selectedDiagItem, articles)

  /**
   * Ce qui distingue deux relevés du même ouvrage : l'étape où il a été vu.
   *
   * Les relevés d'avant la bascule n'ont pas d'étape mais une localisation :
   * « communs » ou « logements ». On la garde pour eux, plutôt que de laisser
   * deux lignes identiques sans savoir laquelle on regarde.
   */
  const sousTitreDuReleve = (it: ApiDiagnosticItem): string | null =>
    parcours.etapes.find((e) => e.numero === it.etapeNumero)?.nom
    ?? (it.localisation ? LIBELLE_LOCALISATION[it.localisation].toLowerCase() : null)

  // Pas d'auto-sélection : au chargement, l'éditeur reste vide tant qu'on ne
  // choisit pas un élément (évite de retomber toujours sur le premier).

  // Les totaux par priorité ne sont plus calculés ici : ils ont rejoint le résumé
  // du projet, avec le reste des statistiques. L'éditeur ne porte que l'avancement.

  // Avancement de la visite, calculé sur le parcours entier et non sur `grouped` :
  // une recherche en cours filtre l'affichage, elle ne doit pas faire reculer la barre.
  // Un ouvrage compte dès qu'il porte un état, même règle que dans le parcours guidé.
  const avancementVisite = { faits: parcours.faits, total: parcours.attendus, etapes: parcours.etapes }

  // ----- loading / error states -----
  if (diagQuery.isLoading || itemsQuery.isLoading || baseQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…
      </div>
    )
  }
  if (diagQuery.isError || !diagQuery.data) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700">
            {(diagQuery.error as ApiError | null)?.message ?? 'Diagnostic introuvable'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    // Encastré, l'éditeur prend la hauteur que son conteneur lui laisse : la barre
    // d'onglets occupe déjà une place qu'un calcul en hauteur de fenêtre ignorerait,
    // et les colonnes sortiraient par le bas en faisant défiler la page entière.
    <div className={cn('flex flex-col gap-4', encastre ? 'h-full' : 'h-[calc(100dvh-7rem)]')}>
      {/* Header (masqué sur mobile pendant l'édition d'un élément) */}
      <div className={cn('space-y-3 shrink-0', isMobile && selectedItemId && 'hidden')}>
        {!encastre && (
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">Diagnostic</h1>
              <p className="text-sm text-muted-foreground truncate">
                {items.length} élément{items.length !== 1 ? 's' : ''} diagnostiqué{items.length !== 1 ? 's' : ''}
              </p>
            </div>
            {projectId && !isMobile && <ProjectSectionsMenu projectId={projectId} onDeleteDiagnostic={handleDeleteDiagnostic} />}
          </div>
        )}
        {/* Le même bandeau sur les deux tailles d'écran. Les montants par priorité
            sont partis dans le résumé du projet, avec les autres statistiques : ici,
            pendant qu'on relève, ce qui se décide est ce qu'il reste à voir. */}
        <AvancementVisite
          faits={avancementVisite.faits}
          total={avancementVisite.total}
          etapes={avancementVisite.etapes}
          etape={etape}
          alerte={phraseDAlerte(bilanDesOublis(items))}
          onAlerte={() => setRecap('consultation')}
          onTerminer={() => setRecap('fin')}
          termine={diagQuery.data?.diagnostic?.status === 'COMPLETED'}
        />

        <ReindexPanel diagnosticId={id!} />

        <GuideModeToggle mode={guideMode} onChange={setGuideMode} />
      </div>

      <div className="relative flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* ===== Catalogue : plein écran sur mobile (masqué pendant l'édition), colonne à gauche sur desktop ===== */}
        <Card className={cn(
          'w-full overflow-hidden flex flex-col',
          isMobile ? (selectedItemId ? 'hidden' : 'flex-1 min-h-0') : 'lg:w-96 shrink-0',
        )}>
          <CardHeader className="py-3 px-4 shrink-0 border-b">
            <CardTitle className="text-sm">Catalogue CFC</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-7 h-8 text-sm"
                placeholder="Rechercher un élément…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="px-2 py-0 pb-4 overflow-y-auto flex-1">
            {grouped.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun résultat</p>
            )}

            {/* L'écran doit dire où on en est du tour du bâtiment, pas dérouler 113
                lignes. Cela valait pour le terrain ; cela vaut aussi au bureau, où le
                diagnostiqueur relit son dossier dans l'ordre où il l'a rempli. Deux
                parcours différents selon la taille de l'écran obligeaient à apprendre
                l'outil deux fois.

                Une recherche en cours rend la liste plate : on cherche alors un ouvrage
                précis, pas une étape. */}
            {!search.trim() && grouped.length > 0 ? (
              <ParcoursGuide
                etapes={grouped}
                etape={etape}
                onEtape={(n) => { setEtape(n); setCategorie(null) }}
                categorie={categorie}
                onCategorie={setCategorie}
                onOuvrir={setSelectedItemId}
                onAjouter={(ligne) => addItem.mutate({ ligne, sharePct: partPourUnAjout(ligne) })}
                ajoutEnCours={addItem.isPending}
              />
            ) : (
            <>

            {/* Étapes de la visite : cliquer en isole une, comme un parcours guidé. */}
            {grouped.length > 1 && (
              <div className="no-scrollbar -mx-2 mb-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
                <button
                  onClick={() => setEtape(null)}
                  className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                    etape == null ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
                >Tout</button>
                {grouped.map(g => (
                  <button
                    key={g.numero}
                    onClick={() => setEtape(g.numero)}
                    className={cn('shrink-0 rounded-full border px-2.5 py-1 text-[11px]',
                      etape === g.numero ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground')}
                  >{g.numero}. {g.nom}</button>
                ))}
              </div>
            )}

            {etapesVisibles.map((etapeGroup) => (
              <div key={etapeGroup.numero}>
                {etape == null && (
                  <div className="px-2 pt-2 pb-1 text-[11px] font-semibold text-foreground">
                    {etapeGroup.numero}. {etapeGroup.nom}{' '}
                    <span className="font-normal text-muted-foreground">({etapeGroup.attendus})</span>
                  </div>
                )}
                {etapeGroup.domaines.map((group) => (
              <div key={`${etapeGroup.numero}-${group.nom}`} className="mb-3">
                <div className="sticky top-0 z-10 bg-card px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/75">
                  {group.nom}
                  {/* La même grille se remplit dans la cage d'escalier et dans les
                      logements : sans ce repère, deux lignes identiques se suivraient
                      sans qu'on sache laquelle on relève. */}
                  {etape == null && (
                    <span className="ml-1.5 font-normal normal-case tracking-normal text-muted-foreground">
                      · {etapeGroup.nom.toLowerCase()}
                    </span>
                  )}
                </div>
                {group.lignes.map(ligne => {
                  const c = ligne.article
                  const existing = ligne.releve
                  const isAdded = !!existing
                  const isSelected = existing?.id === selectedItemId
                  return (
                    <button
                      key={ligne.cle}
                      onClick={() => {
                        if (existing) setSelectedItemId(existing.id)
                        else addItem.mutate({ ligne, sharePct: partPourUnAjout(ligne) })
                      }}
                      disabled={addItem.isPending}
                      className={cn(
                        'flex items-start gap-2 w-full text-left rounded hover:bg-muted/50 transition-colors',
                        isMobile ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs',
                        isSelected && 'bg-primary/10 text-primary',
                      )}
                    >
                      <span className={cn(
                        'h-2 w-2 rounded-full shrink-0 mt-1.5',
                        isAdded ? 'bg-green-500' : 'bg-gray-300',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium leading-snug">
                          <span className="mr-1.5 font-mono font-normal text-muted-foreground">{c.cfcCode}</span>
                          {c.nom}
                        </p>
                        {existing && (
                          <div className="flex gap-1 mt-0.5">
                            {existing.state ? (
                              <>
                                <span className={cn('text-[10px] px-1.5 rounded text-white', stateColors[existing.state])}>{stateLabels[existing.state]}</span>
                                {existing.priority && <span className={cn('text-[10px] px-1.5 rounded', priorityColors[existing.priority])}>{existing.priority}</span>}
                              </>
                            ) : (
                              <span className="text-[10px] px-1.5 rounded bg-muted text-muted-foreground">À évaluer</span>
                            )}
                          </div>
                        )}
                      </div>
                      {!isAdded && <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      {isAdded && !isSelected && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
                    </button>
                  )
                })}
              </div>
                ))}
              </div>
            ))}

            {/* Plus de bouton « étape suivante » ici : cette branche n'est plus atteinte
                qu'en cours de recherche, où la notion d'étape n'a pas de sens. Le passage
                d'une étape à l'autre est porté par le parcours guidé. */}
            </>
            )}
          </CardContent>
        </Card>

        {/* ===== Éditeur ===== */}
        {/* Sur mobile : panneau qui entre par la droite et se renvoie d'un glissement.
            Sur grand écran : colonne fixe, aucun mouvement n'aurait de sens. */}
        {isMobile ? (
          <PanneauGlissant
            ouvert={!!selectedItemId}
            onFermer={() => setSelectedItemId(null)}
            // L'editeur gere son propre defilement et son propre degagement du bas :
            // une marge ici raccourcirait le panneau et laisserait une bande vide.
            className="absolute inset-0 z-30 overflow-hidden bg-background"
          >
            {selectedDiagItem && (
              <ItemEditor
                item={selectedDiagItem}
                catalog={selectedCatalog}
                batiment={batiment}
                sousTitre={sousTitreDuReleve(selectedDiagItem)}
                groupe={groupeDeLOuvrage(selectedDiagItem.id)}
                mobile
                guideMode={guideMode}
                projectId={projectId}
                yearBuilt={projectQuery.data?.project?.yearBuilt ?? null}
                onBack={() => setSelectedItemId(null)}
                onUpdate={(data) => updateItem.mutate({ itemId: selectedDiagItem.id, data })}
                onDelete={() => {
                  const it = selectedDiagItem
                  const aPerdre = [
                    it.photos.length > 0 && `${it.photos.length} photo${it.photos.length > 1 ? 's' : ''}`,
                    it.notes && 'des notes de terrain',
                    it.quantityManual && 'une quantité relevée',
                    it.costManual && 'un coût forcé',
                  ].filter(Boolean) as string[]
                  if (aPerdre.length > 0 && !window.confirm(`Retirer « ${it.cfcLabel} » ? Vous perdez ${aPerdre.join(', ')}.`)) return
                  deleteItem.mutate(it.id)
                }}
                isMutating={updateItem.isPending}
                isDeleting={deleteItem.isPending}
              />
            )}
          </PanneauGlissant>
        ) : (
        /* Un cadre fixe, dont le contenu defile a l'interieur, comme la colonne du
           catalogue. Avant, c'etait la carte de l'editeur elle-meme qui defilait :
           elle se faisait trancher net au bas de la fenetre, sans bord ni angle, et
           on lisait cela comme une page qui deborde plutot que comme une liste a
           derouler. */
        <div className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-black/[0.06] bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.10)]">
        <div className="h-full overflow-y-auto overflow-x-hidden pb-4">
          {selectedDiagItem ? (
            <ItemEditor
              cadreExterne
              item={selectedDiagItem}
              catalog={selectedCatalog}
              batiment={batiment}
              sousTitre={sousTitreDuReleve(selectedDiagItem)}
              groupe={groupeDeLOuvrage(selectedDiagItem.id)}
              mobile={isMobile}
              guideMode={guideMode}
              projectId={projectId}
              yearBuilt={projectQuery.data?.project?.yearBuilt ?? null}
              onBack={() => setSelectedItemId(null)}
              onUpdate={(data) => updateItem.mutate({ itemId: selectedDiagItem.id, data })}
              onDelete={() => {
                // L'élément peut porter des photos, des notes de terrain, une quantité
                // relevée ou un coût forcé : on ne supprime pas tout cela en un clic.
                const it = selectedDiagItem
                const aPerdre = [
                  it.photos.length > 0 && `${it.photos.length} photo${it.photos.length > 1 ? 's' : ''}`,
                  it.notes && 'des notes de terrain',
                  it.quantityManual && 'une quantité relevée',
                  it.costManual && 'un coût forcé',
                ].filter(Boolean) as string[]
                if (aPerdre.length > 0 && !window.confirm(`Retirer « ${it.cfcLabel} » ? Vous perdez ${aPerdre.join(', ')}.`)) return
                deleteItem.mutate(it.id)
              }}
              isMutating={updateItem.isPending}
              isDeleting={deleteItem.isPending}
            />
          ) : (
            /* Le cadre est désormais porté par la colonne : une carte de plus ici
               dessinerait une bordure dans une bordure. */
            <div className="flex h-full items-center justify-center p-10 text-center">
              <p className="text-muted-foreground">
                Cliquez sur un élément du catalogue à gauche pour l'ajouter au diagnostic.
              </p>
            </div>
          )}
        </div>
        </div>
        )}
      </div>

      {recap && (
        <RecapOublis
          incomplets={relevesIncomplets(items)}
          restants={Math.max(0, avancementVisite.total - avancementVisite.faits)}
          groupesMalRepartis={groupesIncomplets(groupesSurface)}
          mode={recap}
          onOuvrir={(itemId) => { setSelectedItemId(itemId); setRecap(null) }}
          onFermer={() => setRecap(null)}
          onTerminer={() => terminer.mutate()}
          terminaisonEnCours={terminer.isPending}
        />
      )}
    </div>
  )
}

// ---------- ItemEditor ----------

/** Réduit une image (photo terrain) en data URL JPEG compacte (sous la limite API). */
function downscaleImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas'))
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

/** En-tête d'étape mobile : pastille numérotée + libellé, pour guider pas à pas. */
function StepHeader({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <p className="text-sm font-semibold">{label}</p>
    </div>
  )
}

/**
 * Année de pose de l'ouvrage.
 *
 * Elle ne sert pas qu'à l'archive : c'est elle qui donne la durée de vie
 * résiduelle du rapport. Elle vivait dans les réglages repliés, donc elle n'était
 * jamais renseignée et le rapport retombait sur l'année de construction pour tout
 * le bâtiment. Elle est maintenant demandée pour chaque ouvrage, à côté de l'état,
 * avec le reste à vivre calculé sous le champ — c'est ce retour immédiat qui donne
 * envie de la saisir.
 *
 * Une prestation de chantier (échafaudage, nettoyage) n'a pas de durée de vie : le
 * champ le dit plutôt que d'afficher un calcul qui n'aurait pas de sens.
 */
function AnneeDePose({ item, yearBuilt, onUpdate, isMutating }: {
  item: ApiDiagnosticItem
  yearBuilt?: number | null
  onUpdate: (data: Partial<ApiDiagnosticItem>) => void
  isMutating: boolean
}) {
  const reference = dureeVieDeReference(item.cfcCode)
  const vie = dureeVieResiduelle(item, { yearBuilt })
  const anneeCourante = new Date().getFullYear()

  return (
    <div>
      <p className="mb-2 text-sm font-medium">Année de pose</p>
      <div className="flex items-start gap-3">
        <Input
          type="number" inputMode="numeric"
          min="1500" max={anneeCourante + 1}
          key={`pose-${item.id}-${item.yearInstalled}`}
          defaultValue={item.yearInstalled ?? ''}
          placeholder={yearBuilt ? String(yearBuilt) : 'AAAA'}
          disabled={isMutating}
          className="h-14 w-24 shrink-0 text-center text-lg tabular-nums"
          onBlur={(e) => {
            const brut = e.target.value.trim()
            const v = brut ? Number(brut) : undefined
            // Une année aberrante vaut moins que pas d'année : on refuse plutôt que de fausser
            // la durée résiduelle, et on rend au champ sa valeur précédente.
            if (brut && (!Number.isInteger(v) || v! < 1500 || v! > anneeCourante + 1)) {
              e.target.value = String(item.yearInstalled ?? '')
              return
            }
            if (v !== (item.yearInstalled ?? undefined)) onUpdate({ yearInstalled: v ?? null })
          }}
        />
        <div className="min-w-0 pt-0.5 text-xs leading-snug">
          {reference == null ? (
            <p className="text-muted-foreground">
              Prestation de chantier : pas de durée de vie, l'année n'est pas utilisée dans le rapport.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground">Durée de vie de référence : {reference} ans.</p>
              {vie ? (
                <p className={cn('mt-0.5 font-medium', vie.depassement > 0 ? 'text-red-700' : 'text-foreground')}>
                  {vie.depassement > 0
                    ? `Durée de vie dépassée de ${vie.depassement} an${vie.depassement > 1 ? 's' : ''}.`
                    : `Durée de vie résiduelle : ${vie.residuelle} an${vie.residuelle > 1 ? 's' : ''}.`}
                  {vie.poseEstimee && <span className="font-normal text-muted-foreground"> D'après l'année de construction, à confirmer.</span>}
                </p>
              ) : (
                <p className="mt-0.5 text-amber-700">
                  Sans année de pose ni année de construction, le rapport n'affichera pas de durée résiduelle.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Nom d'affichage d'une catégorie du catalogue.
 *
 * Les catégories viennent du classeur du bureau et gardent sa mise en forme :
 * capitales sans accent pour les unes, code CFC en tête pour les autres. Devant
 * le bâtiment, on veut lire « Fenêtres » et « Menuiserie », pas « FENETRES » ni
 * « 273 Menuiserie » : une mise en minuscules automatique rendrait « Facade »
 * sans cédille, d'où la table pour les quelques cas en capitales.
 */
const NOMS_CATEGORIES: Record<string, string> = {
  FACADE: 'Façade',
  FENETRES: 'Fenêtres',
  'PORTES EXTERIEURES': 'Portes extérieures',
  'STORES et VOLETS': 'Stores et volets',
  TOITURE: 'Toiture',
  STRUCTURE: 'Structure',
  VENTILATION: 'Ventilation',
}
function nomCategorie(brut: string): string {
  return NOMS_CATEGORIES[brut] ?? brut.replace(/^[\d.]+\s+/, '')
}

/** Pastille d'avancement : le rang de l'étape, ou une coche quand tout est relevé. */
/**
 * L'avancement d'une étape, en anneau.
 *
 * Une pastille pleine disait seulement « commencé » ou « fini ». Pendant une
 * visite, ce qu'on cherche du regard est la proportion : combien reste-t-il
 * derrière cette porte. L'anneau se remplit relevé par relevé, et le chiffre au
 * centre reste lisible, parce que la couleur seule ne dit pas où on en est.
 */
function Pastille({ faits, total, rang, alerte }: {
  faits: number
  total: number
  rang: ReactNode
  /** Un relevé de cette étape porte un oubli : l'anneau le signale sans le détailler. */
  alerte?: boolean
}) {
  const fini = total > 0 && faits === total
  // r = 15.5 sur une boîte de 36 : il reste 2 px de part et d'autre du trait de 3.
  const R = 15.5
  const part = partRemplie(faits, total)

  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
        <circle cx="18" cy="18" r={R} fill="none" strokeWidth="3" className="stroke-black/[0.07]" />
        {part > 0 && (
          <circle
            cx="18" cy="18" r={R} fill="none" strokeWidth="3" strokeLinecap="round"
            className={cn('transition-[stroke-dashoffset] duration-500', fini ? 'stroke-green-500' : 'stroke-primary')}
            strokeDasharray={circonference(R)}
            strokeDashoffset={decalageAnneau(faits, total, R)}
          />
        )}
      </svg>
      <span className={cn('relative text-sm font-bold',
        fini ? 'text-green-600' : faits > 0 ? 'text-primary' : 'text-muted-foreground')}>
        {fini ? <Check className="h-4 w-4" /> : rang}
      </span>
      {alerte && !fini && (
        <span
          className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-orange-500 ring-2 ring-background"
          title="Un relevé de cette étape est incomplet"
        >
          <span className="text-[9px] font-bold leading-none text-white">!</span>
        </span>
      )}
    </span>
  )
}

/** Retour d'un niveau du parcours. */
function Retour({ vers, libelle }: { vers: () => void; libelle: string }) {
  return (
    <button onClick={vers} className="mb-2 flex items-center gap-1.5 px-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowRight className="h-4 w-4 rotate-180" />{libelle}
    </button>
  )
}

/**
 * L'étape choisie dans le parcours.
 *
 * `null` = aucune, on montre la liste des étapes. La base numérote ses sept
 * étapes, « Autres » comprise : il n'y a plus de cas particulier à distinguer.
 */
type EtapeChoisie = number | null

/**
 * Parcours guidé de la visite, sur téléphone et tablette.
 *
 * On est devant le bâtiment, la tablette à la main. L'écran ne doit pas présenter
 * 113 lignes de catalogue : il doit dire où on en est du tour du bâtiment. On
 * descend donc en trois temps avant d'arriver à l'état :
 *
 *   1. l'étape — façade, cage d'escalier, locaux techniques, toiture,
 *      appartements, abords ;
 *   2. l'ouvrage qu'on a devant les yeux — façade, fenêtres, portes, stores ;
 *   3. son type — façade ventilée métallique, bardage bois, crépi…
 *
 * puis l'éditeur, où se choisissent l'état et la photo. Chaque niveau porte son
 * avancement : c'est ce qui permet de savoir, en redescendant de la toiture, ce
 * qui reste à relever.
 */
/**
 * Avancement de la visite, en tête de l'éditeur mobile.
 *
 * Le bandeau des montants ne tenait pas sur un téléphone : trois colonnes dont
 * deux restent à zéro tant que rien n'est relevé, et un total qui débordait du
 * cadre. Surtout, il répondait à la mauvaise question : pendant la visite, ce
 * qui se décide n'est pas le budget mais ce qu'il reste à voir avant de quitter
 * l'étage. On montre donc l'étape en cours et la part du bâtiment déjà relevée.
 * Les montants gardent leur écran, celui des coûts, où ils ont la place d'être
 * lus poste par poste.
 */
function AvancementVisite({ faits, total, etapes, etape, alerte, onAlerte, onTerminer, termine }: {
  faits: number
  total: number
  etapes: EtapeDuDiagnostic[]
  etape: EtapeChoisie
  /** Ce qui manque et qui engage, en une phrase. null quand il n'y a rien à dire. */
  alerte?: string | null
  /** Ouvre la liste de ce qui reste à faire. */
  onAlerte?: () => void
  onTerminer?: () => void
  termine?: boolean
}) {
  const rang = etapes.findIndex((g) => g.numero === etape)
  const courante = rang >= 0 ? etapes[rang] : null
  const titre = courante
    ? `${courante.nom} · étape ${rang + 1} sur ${etapes.length}`
    : `Tour du bâtiment · ${etapes.length} étape${etapes.length > 1 ? 's' : ''}`
  const part = total > 0 ? Math.round((faits / total) * 100) : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{titre}</p>
        <p className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">{part} %</p>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={faits}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label="Avancement de la visite"
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${part}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-xs text-muted-foreground">
          {faits} ouvrage{faits > 1 ? 's' : ''} relevé{faits > 1 ? 's' : ''} sur {total}
        </p>
        {/* Dit pendant la visite, tant qu'on peut encore y retourner. Au moment du
            rapport, il faudrait remonter trois étages pour une photo. L'alerte est
            un bouton : nommer un manque sans donner le chemin oblige à redescendre
            toute la nomenclature pour le retrouver. */}
        {alerte && (
          <button
            onClick={onAlerte}
            className="flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-100"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {alerte}
            <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
          </button>
        )}
        <span className="flex-1" />
        {onTerminer && (
          <button
            onClick={onTerminer}
            className={cn(
              'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              termine
                ? 'bg-green-100 text-green-800'
                : 'border border-black/[0.08] hover:bg-muted',
            )}
          >
            {termine ? 'Relevé terminé' : 'Terminer le relevé'}
          </button>
        )}
      </div>
    </div>
  )
}

function ParcoursGuide({ etapes, etape, onEtape, categorie, onCategorie, onOuvrir, onAjouter, ajoutEnCours }: {
  etapes: EtapeDuDiagnostic[]
  etape: EtapeChoisie
  onEtape: (n: EtapeChoisie) => void
  categorie: string | null
  onCategorie: (c: string | null) => void
  onOuvrir: (itemId: string) => void
  onAjouter: (ligne: LigneDeVisite) => void
  ajoutEnCours: boolean
}) {
  // Le relevé voyage avec sa ligne, puisque le couple article et étape
  // l'identifie : chercher par le seul article renvoyait celui de l'autre côté
  // du bâtiment.
  /** Relevés / total d'une liste de lignes : une ligne compte dès qu'elle porte un état. */
  const avancement = (lignes: LigneDeVisite[]) => ({
    faits: lignes.filter((l) => l.releve?.state).length,
    total: lignes.length,
  })
  /**
   * Un relevé de cette liste porte-t-il un oubli qui engage.
   *
   * Seuls les oublis importants remontent jusqu'ici : faire clignoter une étape
   * parce qu'un ouvrage en très bon état n'a pas de photo apprendrait à ignorer
   * le signal, et c'est alors la vraie alerte qui passerait inaperçue.
   */
  const alerte = (lignes: LigneDeVisite[]) =>
    lignes.some((l) => (l.releve ? aUnOubliImportant(l.releve) : false))
  const courante = etape == null ? undefined : etapes.find((g) => g.numero === etape)
  const titreEtape = (g: EtapeDuDiagnostic) => g.nom

  // --- Niveau 1 : les grandes étapes du tour du bâtiment ---
  if (!courante) {
    return (
      <div className="space-y-2 px-2 py-2">
        <p className="px-1 text-xs text-muted-foreground">
          Suivez le bâtiment dans l'ordre : on commence dehors, on entre, on monte, puis on
          redescend. Touchez une étape pour relever ce qu'elle contient.
        </p>
        {etapes.map((g) => {
          const lignes = g.domaines.flatMap((d) => d.lignes)
          const { faits, total } = avancement(lignes)
          const incomplet = alerte(lignes)
          return (
            <button
              key={g.numero}
              onClick={() => { onEtape(g.numero); onCategorie(null) }}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left hover:bg-muted/50"
            >
              <Pastille faits={faits} total={total} rang={g.numero} alerte={incomplet} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{titreEtape(g)}</span>
                <span className="block text-xs text-muted-foreground">
                  {faits} relevé{faits > 1 ? 's' : ''} sur {total}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )
        })}
      </div>
    )
  }

  const rang = etapes.findIndex((g) => g.numero === etape)
  const suivante = etapes[rang + 1] ?? null
  // Une étape qui ne contient qu'un seul ouvrage n'a pas de choix à proposer : on
  // passe directement à ses types plutôt que d'afficher une liste d'un élément.
  const choisie = courante.domaines.length === 1
    ? courante.domaines[0]
    : courante.domaines.find((d) => d.nom === categorie)

  // --- Niveau 2 : les ouvrages de l'étape ---

  if (!choisie) {
    const { faits, total } = avancement(courante.domaines.flatMap((d) => d.lignes))
    return (
      <div className="px-2 py-2">
        <Retour vers={() => onEtape(null)} libelle="Étapes" />
        <div className="mb-3 px-1">
          <p className="font-semibold">{titreEtape(courante)}</p>
          <p className="text-xs text-muted-foreground">
            {faits} relevé{faits > 1 ? 's' : ''} sur {total} · touchez l'ouvrage que vous avez devant vous
          </p>
        </div>
        <div className="space-y-2">
          {courante.domaines.map((cat) => {
            const a = avancement(cat.lignes)
            const incompletCat = alerte(cat.lignes)
            return (
              <button
                key={cat.nom}
                onClick={() => onCategorie(cat.nom)}
                className="flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left hover:bg-muted/50"
              >
                <Pastille faits={a.faits} total={a.total} rang={a.total} alerte={incompletCat} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{nomCategorie(cat.nom)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {a.faits} relevé{a.faits > 1 ? 's' : ''} sur {a.total} type{a.total > 1 ? 's' : ''}
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )
          })}
        </div>
        {suivante && (
          <button
            onClick={() => { vibrer('succes'); onEtape(suivante.numero); onCategorie(null) }}
            className="mt-3 flex w-full items-center justify-between rounded-lg border px-3 py-3 text-sm hover:bg-muted/50"
          >
            <span className="text-muted-foreground">Étape suivante</span>
            <span className="flex items-center gap-1 font-medium">
              {titreEtape(suivante)}<ArrowRight className="h-4 w-4" />
            </span>
          </button>
        )}
      </div>
    )
  }

  // --- Niveau 3 : les types de l'ouvrage choisi ---
  const a = avancement(choisie.lignes)
  const seulOuvrage = courante.domaines.length === 1
  return (
    <div className="px-2 py-2">
      <Retour
        vers={() => (seulOuvrage ? onEtape(null) : onCategorie(null))}
        libelle={seulOuvrage ? 'Étapes' : titreEtape(courante)}
      />
      <div className="mb-3 px-1">
        <p className="font-semibold">{nomCategorie(choisie.nom)}</p>
        <p className="text-xs text-muted-foreground">
          {a.faits} relevé{a.faits > 1 ? 's' : ''} sur {a.total} · touchez le type rencontré
        </p>
      </div>

      {choisie.lignes.map((ligne) => {
        const c = ligne.article
        const existant = ligne.releve
        return (
          <button
            key={ligne.cle}
            onClick={() => (existant ? onOuvrir(existant.id) : onAjouter(ligne))}
            disabled={ajoutEnCours}
            className="flex w-full items-start gap-2.5 rounded-lg px-3 py-3 text-left text-sm hover:bg-muted/50"
          >
            <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full',
              existant?.state ? stateColors[existant.state] : existant ? 'bg-amber-400' : 'bg-gray-300')} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug">
                <span className="mr-1.5 font-mono text-xs font-normal text-muted-foreground">{c.cfcCode}</span>
                {c.nom}
              </span>
              {existant && (
                <span className="mt-0.5 flex flex-wrap gap-1">
                  {existant.state ? (
                    <>
                      <span className={cn('rounded px-1.5 text-[10px] text-white', stateColors[existant.state])}>
                        {stateLabels[existant.state]}
                      </span>
                      {existant.priority && (
                        <span className={cn('rounded px-1.5 text-[10px]', priorityColors[existant.priority])}>
                          {existant.priority}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">à évaluer</span>
                  )}
                  {/* L'oubli se dit ici, sur la ligne, pendant qu'on est encore devant
                      l'ouvrage. Le signaler au moment du rapport serait trop tard. */}
                  {oublisDUnReleve(existant).map((o) => (
                    <span
                      key={o.raison}
                      title={o.message}
                      className={cn('rounded px-1.5 text-[10px]',
                        o.gravite === 'importante'
                          ? 'bg-orange-100 text-orange-800'
                          : 'bg-muted text-muted-foreground')}
                    >
                      {o.raison === 'photo' ? 'sans photo' : 'sans quantité'}
                    </span>
                  ))}
                </span>
              )}
            </span>
            {!existant && <Plus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
          </button>
        )
      })}
    </div>
  )
}

interface ItemEditorProps {
  item: ApiDiagnosticItem
  /** L'article de la base, ou null quand elle ne le connaît pas. */
  catalog: OuvrageSaisi | null
  batiment: DonneesBatiment
  /** Étape du relevé, affichée sous le nom de l'ouvrage. */
  sousTitre?: string | null
  /** Groupe de surface de l'ouvrage, quand il en a un. */
  groupe?: GroupeSurface | null
  guideMode: GuideMode
  projectId?: string
  /** Année de construction : repli quand l'ouvrage n'a pas d'année de pose relevée. */
  yearBuilt?: number | null
  onUpdate: (data: Partial<ApiDiagnosticItem>) => void
  onDelete: () => void
  isMutating: boolean
  isDeleting: boolean
  mobile?: boolean
  onBack?: () => void
  /**
   * Vrai quand la colonne qui accueille l'éditeur porte déjà le cadre.
   * L'éditeur abandonne alors le sien, sinon on dessine une bordure dans une
   * bordure et le contenu se retrouve enfermé deux fois.
   */
  cadreExterne?: boolean
}

/** Sélecteur d'état guidé : chaque état avec sa description (Feuille 3). Fallback = boutons simples. */
/**
 * Choix de l'état constaté.
 *
 * Sur place, personne ne peut trancher entre « bon » et « moyen » devant quatre
 * boutons nus : ce sont des mots, pas des critères. Chaque état porte donc ce qui
 * permet de décider, dans l'ordre où on en a besoin :
 *
 *   le constat   à quoi ressemble un ouvrage dans cet état
 *   les travaux  ce que cet état engage, qui est souvent le vrai critère
 *   le prix      signalé seulement quand il manque, pour éviter la surprise d'un
 *                montant à zéro une fois l'état retenu
 *
 * Les textes viennent du catalogue du bureau, tels qu'il les a écrits.
 */
function StateGuide({ item, catalog, onApply, isMutating }: {
  item: ApiDiagnosticItem; catalog: OuvrageSaisi | null
  onApply: (s: ElementState) => void; isMutating: boolean
}) {
  const constatOf = (s: ElementState) =>
    s === 'TRES_BON' ? catalog?.descTbe : s === 'BON' ? catalog?.descBon : s === 'MOYEN' ? catalog?.descMoyen : catalog?.descMauvais
  const travauxOf = (s: ElementState) => {
    if (!catalog) return null
    const t = workForState(catalog, s)
    return t && t.trim() ? t.trim() : null
  }

  return (
    <div className="space-y-2">
      {STATES.map((state) => {
        const constat = constatOf(state)
        const travaux = travauxOf(state)
        const selected = item.state === state
        // Un état qui engage des travaux mais n'a pas de prix donnera un coût nul :
        // mieux vaut le dire avant qu'après. Un état sans travaux, lui, n'a aucune
        // raison d'avoir un prix : le signaler serait du bruit sur presque chaque ligne.
        const engageDesTravaux = !!travaux && travaux.toLowerCase() !== 'néant'
        const sansPrix = engageDesTravaux && !!catalog && priceToNumber(priceForState(catalog, state)) == null
        return (
          <button
            key={state}
            onClick={() => onApply(state)}
            disabled={isMutating}
            className={cn('w-full rounded-xl border-2 p-3 text-left transition-colors',
              selected ? `${stateColors[state]} border-transparent` : 'bg-background border-muted hover:border-primary/30')}
          >
            <div className="flex items-center gap-2">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', selected ? 'bg-white' : stateColors[state])} />
              <span className={cn('text-sm font-semibold', selected && 'text-white')}>{stateLabels[state]}</span>
              {sansPrix && (
                <span className={cn('ml-auto text-[10px] font-medium', selected ? 'text-white/80' : 'text-amber-600')}>
                  prix non renseigné
                </span>
              )}
            </div>

            {constat && (
              <p className={cn('mt-1 text-xs leading-snug', selected ? 'text-white/90' : 'text-muted-foreground')}>
                {constat}
              </p>
            )}

            {travaux && (
              <p className={cn('mt-1 text-xs leading-snug', selected ? 'text-white/90' : 'text-foreground/75')}>
                <span className={cn('font-medium', selected ? 'text-white' : 'text-foreground')}>Travaux : </span>
                {travaux}
              </p>
            )}

            {!constat && !travaux && (
              <p className={cn('mt-1 text-xs italic', selected ? 'text-white/80' : 'text-muted-foreground')}>
                Aucune description au catalogue pour cet état.
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Saisie guidée « ajout d'isolation d'épaisseur à définir » : épaisseur (cm) + prix au m² -> coût = surface × prix. */
function InsulationInputs({ value, quantity, onChange }: {
  value: string | null; quantity: number | undefined
  onChange: (work: string | null, cost: number | null) => void
}) {
  const ep = value?.match(/([\d.,]+)\s*cm/i)?.[1] ?? ''
  const prix = value?.match(/([\d.,]+)\s*CHF\s*\/\s*m/i)?.[1] ?? ''
  const surface = quantity ?? 0
  const n = (s: string) => { const v = Number(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN }
  const compose = (epv: string, prixv: string) => {
    const p = n(prixv)
    const c = Number.isFinite(p) && surface > 0 ? Math.round(p * surface) : null
    const text = `Ajout d'isolation${epv ? `, épaisseur ${epv} cm` : ''}${prixv ? `, à ${prixv} CHF/m²` : ''}`
    onChange(text, c)
  }
  const p = n(prix)
  const preview = Number.isFinite(p) && surface > 0 ? Math.round(p * surface) : null
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Épaisseur d'isolation (cm)</label>
          <Input type="number" step="0.5" defaultValue={ep} placeholder="ex. 16" onBlur={(e) => compose(e.target.value, prix)} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Prix (CHF/m²)</label>
          <Input type="number" defaultValue={prix} placeholder="ex. 120" onBlur={(e) => compose(ep, e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Surface {surface > 0 ? `${surface} m²` : 'à saisir sur l’élément'}{preview != null ? ` → coût estimé ${preview.toLocaleString('fr-CH')} CHF` : ''}
      </p>
    </div>
  )
}

/** Un bloc d'enveloppe (Amélioration ou Mise aux normes) : retenable, éditable, chiffré. */
function PerfBlock({ label, catalogWork, catalogPrice, unite, value, cost, quantity, onChange, isMutating }: {
  label: string; catalogWork: string | null; catalogPrice: PrixCatalogue; unite?: string
  value: string | null; cost: string | null; quantity: number | undefined
  onChange: (work: string | null, cost: number | null) => void; isMutating: boolean
}) {
  const has = !!catalogWork && catalogWork !== 'Néant'
  const retained = value != null
  if (!has && !retained) return null
  const costNum = cost != null ? Number(cost) : null
  const isInsulation = /isolation|isolant|épaisseur/i.test(`${catalogWork ?? ''} ${value ?? ''}`)
  const toggle = () => {
    if (retained) onChange(null, null)
    else onChange(has ? catalogWork! : '', computeCostFromPrice(catalogPrice, quantity) ?? null)
  }
  return (
    <div className={cn('rounded-lg border p-3', retained ? 'border-primary/30 bg-primary/[0.03]' : 'bg-muted/10')}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <button type="button" onClick={toggle} disabled={isMutating}
          className={cn('rounded-full px-3 py-1 text-xs font-semibold transition-colors',
            retained ? 'bg-primary/10 text-primary hover:bg-primary/15' : 'bg-muted text-muted-foreground hover:bg-muted/70')}>
          {retained ? 'Retenu · retirer' : 'Ajouter'}
        </button>
      </div>
      {!retained && has && (
        <p className="mt-1 text-xs text-muted-foreground">
          {catalogWork}
          {/* Un prix nu se lit mal : « 310 » n'apprend rien, « 310 CHF/m² » dit
              ce qu'il faudra multiplier. */}
          {catalogPrice != null && catalogPrice !== '' && ` · ${catalogPrice} CHF${unite ? '/' + unite : ''}`}
        </p>
      )}
      {retained && (isInsulation
        ? <InsulationInputs value={value} quantity={quantity} onChange={onChange} />
        : (
          <div className="mt-2 space-y-2">
            <Textarea key={`w-${label}-${value === '' ? 'e' : 'f'}`} defaultValue={value ?? ''} rows={2} placeholder="Travaux à réaliser…"
              onBlur={(e) => { if ((e.target.value || '') !== (value ?? '')) onChange(e.target.value || '', costNum) }} />
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">Coût (CHF)</span>
              <Input type="number" className="w-36" key={`c-${label}-${cost}`} defaultValue={cost ?? ''}
                onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : null; if (v !== costNum) onChange(value ?? '', v) }} />
            </div>
          </div>
        ))}
    </div>
  )
}

/** Enveloppes distinctes Amélioration + Mise aux normes (dimension « performance » du diag). */
function PerformanceEnvelopes({ item, catalog, quantity, onUpdate, isMutating }: {
  item: ApiDiagnosticItem; catalog: OuvrageSaisi | null; quantity: number | undefined
  onUpdate: (data: Partial<ApiDiagnosticItem>) => void; isMutating: boolean
}) {
  const anyImp = (!!catalog?.workImprovement && catalog.workImprovement !== 'Néant') || item.improvement != null
  const anyNorms = (!!catalog?.workNorms && catalog.workNorms !== 'Néant') || item.norms != null
  if (!anyImp && !anyNorms) return null
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-medium">Amélioration &amp; remise aux normes</p>
      <PerfBlock key={`imp-${item.id}`} label="Amélioration" catalogWork={catalog?.workImprovement ?? null} catalogPrice={catalog?.priceImprovement ?? null} unite={catalog?.uniteRemplacement}
        value={item.improvement} cost={item.improvementCost} quantity={quantity} isMutating={isMutating}
        onChange={(w, c) => onUpdate({ improvement: w, improvementCost: (c as unknown as string | null) })} />
      <PerfBlock key={`norm-${item.id}`} label="Mise aux normes" catalogWork={catalog?.workNorms ?? null} catalogPrice={catalog?.priceNorms ?? null} unite={catalog?.uniteRemplacement}
        value={item.norms} cost={item.normsCost} quantity={quantity} isMutating={isMutating}
        onChange={(w, c) => onUpdate({ norms: w, normsCost: (c as unknown as string | null) })} />
    </div>
  )
}

/**
 * Répartition d'une surface entre les types qui la couvrent.
 *
 * Une façade en bardage sur 60 % et en crépi sur 40 % donne deux ouvrages qui se
 * partagent la même surface. Sans cette répartition, chacun recevait la façade
 * entière et le devis la chiffrait deux fois.
 *
 * Le bloc montre tout le groupe, pas seulement l'ouvrage ouvert : on ne répartit
 * pas une surface en regardant une seule part, et le total faux doit se voir au
 * moment où on le saisit, pas à l'édition du rapport.
 */
function PartDeSurface({ groupe, item, quantiteDuGroupe, unite, onPart }: {
  groupe: GroupeSurface
  item: ApiDiagnosticItem
  quantiteDuGroupe: number | undefined
  unite: string
  onPart: (v: number | null) => void
}) {
  const part = partEffective(item, groupe.membres.length)
  return (
    <div className={cn('rounded-xl border p-3', groupe.complet ? 'bg-muted/40' : 'border-amber-300 bg-amber-50')}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium">
          {groupe.nom}
          {quantiteDuGroupe != null && (
            <span className="font-normal text-muted-foreground"> · {quantiteDuGroupe} {unite} au total</span>
          )}
        </p>
        <p className={cn('text-[11px]', groupe.complet ? 'text-muted-foreground' : 'text-amber-800')}>
          {phraseDuGroupe(groupe)}
        </p>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <div className="w-28">
          <p className="mb-1 text-xs font-medium">Part (%)</p>
          <Input
            type="number" min="0" max="100" step="1"
            key={`part-${item.id}-${part}`}
            defaultValue={part ?? ''}
            placeholder="à répartir"
            onBlur={(e) => {
              const brut = e.target.value.trim()
              const v = brut ? Number(brut) : null
              if (v != null && (!isFinite(v) || v < 0 || v > 100)) { e.target.value = String(part ?? ''); return }
              if (v !== part) onPart(v)
            }}
          />
        </div>
        <ul className="min-w-0 flex-1 space-y-0.5 text-[11px] text-muted-foreground">
          {groupe.membres.map((m) => {
            const p = partEffective(m, groupe.membres.length)
            return (
              <li key={m.id} className={cn('flex justify-between gap-3', m.id === item.id && 'font-medium text-foreground')}>
                <span className="truncate">{m.cfcLabel}</span>
                <span className="shrink-0 tabular-nums">{p == null ? '·' : `${p} %`}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function ItemEditor({ item, catalog, batiment, sousTitre, groupe, guideMode, projectId, yearBuilt, onUpdate, onDelete, isMutating, isDeleting, mobile, onBack, cadreExterne }: ItemEditorProps) {
  const [notes, setNotes] = useState(item.notes ?? '')
  const [showManual, setShowManual] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false) // options expertes repliées (mobile)
  const [viewer, setViewer] = useState<string | null>(null) // photo affichée en grand

  // Si on change d'item, reset l'état local
  useEffect(() => { setNotes(item.notes ?? ''); setShowManual(false); setShowAdvanced(false) }, [item.id, item.notes])

  // Applique une note suggérée par le guide (ajoute à la suite si une note existe déjà).
  const applyGuideNote = (n: string) => {
    const merged = notes.trim() ? `${notes.trim()}\n${n}` : n
    setNotes(merged)
    onUpdate({ notes: merged })
  }

  const suggestedPrice = catalog && item.state ? priceForState(catalog, item.state) : null
  const appliedPrice = appliedUnitPrice(suggestedPrice)
  // Quantité dérivée du dossier + d'où elle vient (pour l'expliquer et la justifier).
  const qtyResolution = useMemo(
    () => (catalog ? resolutionDeQuantite(catalog, batiment) : { quantity: undefined, origin: 'manuelle' as const, basis: null }),
    [catalog, batiment],
  )
  /**
   * Part de la surface du groupe qui revient à cet ouvrage.
   *
   * Sans groupe, l'ouvrage prend sa quantité entière : c'est le cas de la
   * plupart des articles. Avec un groupe d'un seul type, aussi. Dès qu'il y a
   * deux types, la part se saisit, et tant qu'elle manque la quantité n'est pas
   * calculée : une façade chiffrée en entier alors qu'elle n'en couvre que la
   * moitié passerait au devis sans rien signaler.
   */
  const partDuGroupe = groupe ? partEffective(item, groupe.membres.length) : 100
  const autoQty = groupe
    ? quantiteDuType(qtyResolution.quantity, partDuGroupe)
    : qtyResolution.quantity
  /** Unité affichée à côté d'une quantité (« CHF/m² fenêtres » -> « m² fenêtres »). */
  const qtyUnit = catalog?.unit?.replace(/^CHF\s*\/?\s*/i, '') ?? ''
  const [qtyError, setQtyError] = useState<string | null>(null)
  /** Un prix au mètre courant appelle une longueur, pas une « quantité ». */
  const estLongueur = /ml$|metre|mètre/i.test(catalog?.unit ?? '')
  /**
   * Pourquoi un coût reste vide. Le tableau de référence ne chiffre que les états qui
   * appellent des travaux : 81 items sur 102 n'ont aucun prix en « Bon », et la quasi
   * totalité n'en a pas en « Très bon ». Un écran vide laissait croire à une panne.
   */
  const raisonCoutVide = !item.state
    ? 'Choisissez un état'
    : !catalog
      ? 'Élément hors catalogue : coût à saisir'
      : !suggestedPrice
        ? `Aucun travail chiffré pour l'état « ${stateLabels[item.state]} »`
        : priceToNumber(suggestedPrice) == null
          ? `Prix au catalogue non numérique (${suggestedPrice})`
          : item.area == null
            ? 'Quantité à saisir'
            : ''


  /** Pose la part, et recalcule la quantité et le coût qui en découlent. */
  const appliquerPart = (valeur: number | null) => {
    const patch: Partial<ApiDiagnosticItem> = { sharePct: valeur }
    if (!item.quantityManual) {
      const q = quantiteDuType(qtyResolution.quantity, valeur)
      patch.area = q ?? null
      if (!item.costManual && item.state) {
        patch.estimatedCost = (computeCost(catalog, item.state, q) ?? null) as unknown as string | null
        patch.costIndex = getMarketCoeff()
      }
    }
    onUpdate(patch)
  }

  // Synchronisation de la quantité automatique. Corriger le périmètre, les étages ou le
  // type de toiture du dossier doit se répercuter sur les éléments qui en dépendent.
  // Une quantité reprise à la main est verrouillée et n'est jamais touchée ici.
  useEffect(() => {
    if (!catalog || item.quantityManual) return
    if (autoQty == null || autoQty === item.area) return
    const patch: Partial<ApiDiagnosticItem> = { area: autoQty }
    if (!item.costManual && item.state) {
      patch.estimatedCost = (computeCost(catalog, item.state, autoQty) ?? 0) as unknown as string
      patch.costIndex = getMarketCoeff()
    }
    onUpdate(patch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, autoQty, item.quantityManual])

  /**
   * Ce qu'il y a à faire, tel qu'il partira au devis.
   *
   * On affiche d'abord ce qui a été retenu sur le poste. S'il est vide, on retombe
   * sur le texte du catalogue pour l'état constaté : un ouvrage dont le catalogue
   * ne portait pas de texte au moment du choix laissait sinon le bloc muet, et la
   * personne sur place ne voyait plus ce qu'elle venait de décider.
   */
  const travauxRetenus = item.works.filter((w) => w && w.trim() && w.trim().toLowerCase() !== 'néant')
  const travauxCatalogue = (item.state && catalog ? workForState(catalog, item.state) : null)?.trim() || null
  const aFaire = travauxRetenus.length > 0
    ? travauxRetenus.join(' · ')
    : (travauxCatalogue && travauxCatalogue.toLowerCase() !== 'néant' ? travauxCatalogue : null)

  /**
   * Deux silences a ne pas confondre.
   *
   * « Neant » est une reponse : l'ouvrage est dans un etat qui n'appelle aucun travail.
   * Une case vide n'en est pas une : le catalogue ne dit pas quoi faire, et l'ecrire
   * « aucun travail a prevoir » serait un mensonge, surtout en face d'un cout de
   * plusieurs dizaines de milliers de francs.
   */
  const silenceDesTravaux: 'neant' | 'catalogue-muet' | null =
    aFaire || !item.state ? null : travauxCatalogue?.toLowerCase() === 'néant' ? 'neant' : 'catalogue-muet'

  // Changer l'état recalcule automatiquement travaux, priorité et coût.
  const applyState = (state: ElementState) => {
    // L'app se tient d'une main, souvent sans quitter le bâtiment des yeux : une
    // vibration courte confirme l'état retenu sans qu'on ait à regarder l'écran.
    vibrer('leger')
    const quantity = item.area ?? autoQty ?? undefined
    const patch: Partial<ApiDiagnosticItem> = { state, priority: STATE_PRIORITY[state] }
    if (quantity != null && item.area == null) patch.area = quantity
    if (catalog) {
      const work = workForState(catalog, state)
      patch.works = work && work !== 'Néant' ? [work as string] : []
      // Coût = prix de l'état × quantité (indépendant du texte de travail ; états sans prix -> coût 0).
      // Un coût repris à la main n'est jamais écrasé.
      if (!item.costManual) {
        const cost = computeCost(catalog, state, quantity)
        patch.estimatedCost = (cost ?? 0) as unknown as string
        patch.costIndex = getMarketCoeff()
      }
    }
    onUpdate(patch)
  }

  // Changer la quantité recalcule le coût, et verrouille la quantité : le dossier peut
  // ensuite évoluer (périmètre, étages…) sans écraser ce que le terrain a relevé.
  const applyQuantity = (v: number | undefined, manual = true) => {
    const patch: Partial<ApiDiagnosticItem> = { area: v ?? null, quantityManual: manual }
    if (!item.costManual) {
      const cost = item.state ? computeCost(catalog, item.state, v) : undefined
      patch.estimatedCost = (cost ?? null) as unknown as string | null
      patch.costIndex = getMarketCoeff()
    }
    onUpdate(patch)
  }

  /** Rend la quantité au calcul automatique (et le coût avec, s'il n'est pas forcé). */
  const restoreAutoQuantity = () => {
    const cost = item.state ? computeCost(catalog, item.state, autoQty) : undefined
    onUpdate({
      area: autoQty ?? null,
      quantityManual: false,
      costManual: false,
      estimatedCost: (cost ?? null) as unknown as string | null,
      costIndex: getMarketCoeff(),
    })
  }

  /** Coût repris à la main : verrouillé jusqu'à ce qu'on le rende au calcul. */
  // Coût forcé à la main : pas d'indice, il ne sera pas réindexé.
  const applyCost = (v: number | undefined) => onUpdate({
    estimatedCost: (v ?? null) as unknown as string | null,
    costManual: v != null,
    costIndex: v != null ? null : getMarketCoeff(),
  })

  // Part (%) d'une surface partagée : commande ponctuelle appliquée à la quantité
  // automatique. Rien n'est stocké, et la valeur n'est jamais recalculée depuis la
  // quantité (c'est ce qui affichait « 288 % » après une correction du périmètre).
  const applyPercent = (pct: number | undefined) => {
    if (autoQty == null || pct == null || pct <= 0) return
    const area = Math.round((autoQty * pct) / 100)
    applyQuantity(area > 0 ? area : undefined)
  }

  const addPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const urls = await Promise.all(Array.from(files).map(f => downscaleImage(f)))
    onUpdate({ photos: [...item.photos, ...urls] })
  }
  const removePhoto = (i: number) => onUpdate({ photos: item.photos.filter((_, idx) => idx !== i) })

  // Panneau du guide IA (rendu identique mobile / desktop), masqué si mode "off".
  const guide = guideMode !== 'off'
    ? (
      <DiagnosticGuide
        photos={item.photos}
        item={{ cfcCode: item.cfcCode, cfcLabel: item.cfcLabel, state: item.state }}
        projectId={projectId}
        mode={guideMode}
        onApplyState={applyState}
        onApplyNote={applyGuideNote}
      />
    )
    : null

  // ----- Rendu mobile : flux terrain ultra simple (photo -> état -> suivant) -----
  if (mobile) {
    const anyImp = (!!catalog?.workImprovement && catalog.workImprovement !== 'Néant') || item.improvement != null
    const anyNorms = (!!catalog?.workNorms && catalog.workNorms !== 'Néant') || item.norms != null
    return (
      <div className="flex flex-col h-full relative">
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="h-5 w-5" />Retour
          </button>
          <div className="flex-1 min-w-0 text-center">
            {/* Le nom porte la distinction entre deux ouvrages voisins : « ... panneau plein
                (2 vantaux) » et « ... vitrée (1 vantail) » ne different que par leur fin. */}
            <p className="text-sm font-semibold leading-tight text-balance">
              {item.cfcLabel}
              {sousTitre && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  · {sousTitre}
                </span>
              )}
            </p>
            {catalog?.category && <p className="text-[11px] text-muted-foreground truncate">{catalog.category}</p>}
          </div>
          <button onClick={onDelete} disabled={isDeleting} title="Retirer cet élément" className="shrink-0 rounded-lg p-2 text-red-600 hover:bg-red-50">
            {isDeleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-6 pb-28 px-0.5">
          {/* Étape 1 — photo */}
          <section className="space-y-3">
            <StepHeader n={1} label="Prendre une photo" />
            <CameraCapture onCapture={(url) => onUpdate({ photos: [...item.photos, url] })} />
            {item.photos.length > 0 && (
              <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
                {item.photos.map((src, i) => (
                  <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border shrink-0">
                    <button type="button" onClick={() => setViewer(src)} className="block h-full w-full">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                    <button onClick={() => removePhoto(i)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5 z-10">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Aide IA (facultative) */}
          {guide}

          {/* Étape 2 — état : le seul vrai choix */}
          <section className="space-y-3">
            <StepHeader n={2} label="Évaluer l'état" />
            <StateGuide item={item} catalog={catalog} onApply={applyState} isMutating={isMutating} />
          </section>

          <section className="space-y-3">
            <StepHeader n={3} label="Année de pose" />
            <AnneeDePose item={item} yearBuilt={yearBuilt} onUpdate={onUpdate} isMutating={isMutating} />
          </section>

          {/* Étape 3 — métré, seulement quand il ne se déduit pas du bâtiment.
              Sans ce champ, un élément facturé au mètre (garde-corps, modénature) ou à
              la pièce restait sans quantité, donc sans coût, et rien sur l'écran mobile
              ne permettait de le saisir. */}
          {qtyResolution.origin === 'manuelle' && (
            <section className="space-y-3">
              <StepHeader n={4} label={estLongueur ? 'Mesurer la longueur' : 'Saisir la quantité'} />
              <div className="flex items-center gap-2">
                <Input
                  type="number" inputMode="decimal" min="1" className="w-32 text-lg"
                  key={`mq-${item.id}-${item.area}`}
                  defaultValue={item.area ?? ''}
                  placeholder={estLongueur ? 'ex. 24' : 'ex. 4'}
                  onBlur={(e) => {
                    const raw = e.target.value.trim()
                    const v = raw ? Number(raw) : undefined
                    if (raw && (!isFinite(v!) || v! <= 0)) { setQtyError('Valeur minimale : 1'); e.target.value = String(item.area ?? ''); return }
                    setQtyError(null)
                    if (v !== (item.area ?? undefined)) applyQuantity(v)
                  }}
                />
                <span className="text-sm font-medium text-muted-foreground">{qtyUnit || 'unités'}</span>
              </div>
              {qtyError
                ? <p className="text-xs text-red-600">{qtyError}</p>
                : <p className="text-xs text-muted-foreground">{qtyResolution.reason ?? 'Ne se déduit pas des dimensions du bâtiment.'}</p>}
            </section>
          )}

          {/* Résultat automatique (priorité + coût) */}
          {/* Le libellé des travaux était coupé à mi-phrase : c'est justement ce qui est
              retenu pour le devis, il doit se lire en entier. La pastille de priorité et
              le montant gardent leur ligne, le texte passe dessous et retourne à la ligne. */}
          <div className="rounded-xl border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Priorité · coût (auto)</p>
                <div className="mt-1">
                  {item.priority
                    ? <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold', priorityColors[item.priority])}>P{item.priority}</span>
                    : <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Non évalué</span>}
                </div>
              </div>
              <p className="text-lg font-bold text-primary shrink-0">{item.estimatedCost ? formatCHF(toNum(item.estimatedCost)) : '·'}</p>
            </div>
            {aFaire && (
              <p className="mt-2 text-xs leading-snug text-foreground/80">
                <span className="font-medium text-foreground">À faire : </span>{aFaire}
              </p>
            )}
            {silenceDesTravaux === 'neant' && (
              <p className="mt-2 text-xs italic leading-snug text-muted-foreground">Aucun travail à prévoir pour cet état.</p>
            )}
            {silenceDesTravaux === 'catalogue-muet' && (
              <p className="mt-2 text-xs leading-snug text-amber-700">
                Le catalogue ne précise pas les travaux pour cet état. À décrire dans les options avancées.
              </p>
            )}
          </div>

          {/* Options avancées repliées : l'écran reste simple par défaut */}
          <div className="border-t pt-3">
            <button type="button" onClick={() => setShowAdvanced(v => !v)} className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground">
              <span>Options avancées{(anyImp || anyNorms) ? ' · amélioration, normes, notes' : ' · notes'}</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', showAdvanced && 'rotate-180')} />
            </button>
            {showAdvanced && (
              <div className="mt-4 space-y-5">
                <PerformanceEnvelopes item={item} catalog={catalog} quantity={item.area ?? autoQty ?? undefined} onUpdate={onUpdate} isMutating={isMutating} />
                <div>
                  <p className="text-sm font-medium mb-2">Notes</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => { if (notes !== (item.notes ?? '')) onUpdate({ notes: notes || null }) }}
                    placeholder="Observations terrain…"
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bouton posé au ras du bas : les 96 px d'écart d'avant servaient à dégager la
            barre de navigation, qui n'est plus affichée dans l'éditeur. Il ne reste que
            la marge de sécurité du bord d'écran (barre d'accueil iOS). */}
        <button
          type="button"
          onClick={onBack}
          className="absolute bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg active:scale-95 transition-transform z-10"
        >
          Suivant <ArrowRight className="h-5 w-5" />
        </button>

        {viewer && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
            <img src={viewer} alt="" className="max-h-full max-w-full object-contain rounded-lg" />
            <button
              type="button"
              onClick={() => setViewer(null)}
              aria-label="Fermer"
              className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={cadreExterne ? "rounded-none border-0 bg-transparent shadow-none" : undefined}>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-lg text-muted-foreground">{item.cfcCode}</span>
            <CardTitle>
              {item.cfcLabel}
              {sousTitre && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {sousTitre}
                </span>
              )}
            </CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isDeleting}
            title="Retirer cet élément du diagnostic"
            className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            {isDeleting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Trash2 className="mr-1.5 h-4 w-4" />}
            Retirer
          </Button>
        </div>
        {catalog?.category && (
          <Badge variant="outline" className="w-fit mt-1">{catalog.category}</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. État — le seul vrai choix du diagnostiqueur */}
        <div>
          <p className="text-sm font-medium mb-3">État constaté</p>
          <StateGuide item={item} catalog={catalog} onApply={applyState} isMutating={isMutating} />
        </div>

        {/* 2. Année de pose — elle porte la durée de vie résiduelle du rapport */}
        <AnneeDePose item={item} yearBuilt={yearBuilt} onUpdate={onUpdate} isMutating={isMutating} />

        {/* 3. Photos */}
        <div>
          <p className="text-sm font-medium mb-2">Photos</p>
          {/* L'avertissement est ici, contre le bouton qui le résout, et pas en haut
              de l'écran : une alerte qu'il faut aller chercher ne sert à rien. */}
          {oublisDUnReleve(item)
            .filter((o) => o.raison === 'photo' && o.gravite === 'importante')
            .map((o) => (
              <p key={o.raison} className="mb-2 flex items-start gap-2 rounded-lg bg-orange-50 px-3 py-2 text-xs text-orange-900">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {o.message}
              </p>
            ))}
          <div className="flex flex-wrap gap-2">
            {item.photos.map((src, i) => (
              <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border group">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="h-20 w-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary/40 text-muted-foreground">
              <ImagePlus className="h-5 w-5" />
              <span className="text-[10px]">Ajouter</span>
              <input type="file" accept="image/*" capture="environment" multiple className="hidden"
                onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }} />
            </label>
          </div>
        </div>

        {/* Guide IA */}
        {guide}

        {/* 3. Résultat automatique (travaux, priorité, coût) */}
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">
                {item.quantityManual || item.costManual ? 'Repris à la main' : 'Calculé automatiquement'}
              </p>
              {item.quantityManual && <Badge variant="outline" className="text-[10px]">Quantité saisie</Badge>}
              {item.costManual && <Badge variant="outline" className="text-[10px]">Coût forcé</Badge>}
            </div>
            <div className="flex items-center gap-3">
              {(item.quantityManual || item.costManual) && (
                <button
                  onClick={() => { setQtyError(null); restoreAutoQuantity() }}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  Rétablir le calcul
                </button>
              )}
              <button onClick={() => setShowManual(v => !v)} className="text-xs text-primary hover:underline">
                {showManual ? 'Masquer' : 'Modifier'}
              </button>
            </div>
          </div>
          {/* La part de surface n'est pas une option experte : c'est elle qui
              donne la quantité, donc elle se lit avant elle, et sans déplier. */}
          {groupe && groupe.membres.length > 1 && (
            <PartDeSurface
              groupe={groupe}
              item={item}
              quantiteDuGroupe={qtyResolution.quantity}
              unite={qtyUnit}
              onPart={appliquerPart}
            />
          )}

          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Priorité</p>
              {item.priority
                ? <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold mt-0.5', priorityColors[item.priority])}>{item.priority}</span>
                : <span className="mt-0.5 inline-block text-xs font-medium text-muted-foreground">·</span>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Quantité</p>
              {item.area != null ? (
                <p className="font-semibold mt-0.5">{item.area} {catalog?.unit?.replace(/^CHF\s*\/?\s*/i, '') ?? ''}</p>
              ) : (
                <p className="font-medium text-amber-600 mt-0.5 text-xs">à saisir</p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coût estimé</p>
              {item.estimatedCost && toNum(item.estimatedCost) > 0 ? (
                <p className="font-semibold text-primary mt-0.5">{formatCHF(toNum(item.estimatedCost))}</p>
              ) : (
                /* Un coût vide n'est pas une panne : le catalogue ne chiffre pas tous les
                   états, et certaines quantités ne se déduisent pas. On dit lequel des deux. */
                <p className="font-medium text-amber-700 mt-0.5 text-xs">{raisonCoutVide}</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Travaux</p>
            <p className={cn('text-sm mt-0.5 leading-snug', silenceDesTravaux === 'catalogue-muet' && 'text-amber-700')}>
              {aFaire
                ?? (silenceDesTravaux === 'neant' ? 'Aucun travail à prévoir pour cet état.'
                  : silenceDesTravaux === 'catalogue-muet' ? 'Le catalogue ne précise pas les travaux pour cet état.'
                    : '·')}
            </p>
          </div>

          {/* Réglages manuels (repliés par défaut) */}
          {showManual && (
            <div className="pt-3 border-t space-y-4">
              <div>
                <p className="text-xs font-medium mb-2">Forcer la priorité</p>
                <div className="flex gap-2">
                  {PRIORITIES.map(p => (
                    <button
                      key={p}
                      onClick={() => onUpdate({ priority: p })}
                      disabled={isMutating}
                      className={cn(
                        'px-4 py-2 rounded-lg text-sm font-bold border-2 transition-colors',
                        item.priority === p ? `${priorityColors[p]} border-transparent` : 'bg-background border-muted hover:border-primary/30',
                      )}
                    >Priorité {p}</button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{item.priority ? priorityDescriptions[item.priority] : 'Non évalué'}</p>
              </div>

              {/* Part d'une surface partagée : commande ponctuelle, rien n'est mémorisé ici. */}
              {autoQty != null && (
                <div>
                  <p className="text-xs font-medium mb-1">
                    Appliquer une part de {qtyResolution.basis ?? 'la quantité calculée'} · {autoQty} {qtyUnit} au total
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min="1" max="100" className="w-24" placeholder="100"
                      onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v != null) { applyPercent(v); e.target.value = '' } }}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                    <span className="text-xs text-muted-foreground">
                      → utile si plusieurs éléments se partagent cette surface (bois / métal / synthétique…)
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs font-medium mb-1">Quantité {qtyUnit && <span className="font-normal text-muted-foreground">({qtyUnit})</span>}</p>
                  <Input type="number" min="1" key={`qty-${item.id}-${item.area}`} defaultValue={item.area ?? ''}
                    onBlur={(e) => {
                      const raw = e.target.value.trim()
                      const v = raw ? Number(raw) : undefined
                      if (raw && (!isFinite(v!) || v! <= 0)) { setQtyError('Quantité minimale : 1'); e.target.value = String(item.area ?? ''); return }
                      setQtyError(null)
                      if (v !== (item.area ?? undefined)) applyQuantity(v)
                    }} />
                  {qtyError && <p className="text-[11px] text-red-600 mt-1">{qtyError}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Année d'intervention</p>
                  <Input type="number" key={`iy-${item.id}-${item.interventionYear}`} defaultValue={item.interventionYear ?? ''}
                    placeholder={String(deriveInterventionYearClient(item.priority))}
                    onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v !== (item.interventionYear ?? undefined)) onUpdate({ interventionYear: v ?? null }) }} />
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Coût estimé (CHF)</p>
                  <Input type="number" min="0" key={`cost-${item.id}-${item.estimatedCost}`} defaultValue={item.estimatedCost ?? ''}
                    onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : undefined; if (v !== (item.estimatedCost ? Number(item.estimatedCost) : undefined)) applyCost(v) }} />
                </div>
              </div>
              {catalog && (
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>
                    Catalogue : {catalog.quantityFormula ?? 'aucune formule'}
                    {qtyResolution.basis && qtyResolution.origin !== 'manuelle' && <> · quantité prise sur {qtyResolution.basis}</>}
                    {qtyResolution.origin === 'manuelle' && qtyResolution.reason && <> · à saisir ({qtyResolution.reason})</>}
                  </p>
                  {suggestedPrice && (
                    <p>
                      Prix : {suggestedPrice} {catalog.unit ?? ''}
                      {appliedPrice != null && <> × indice {getMarketCoeff()} = <strong>{appliedPrice} {catalog.unit ?? ''}</strong></>}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Amélioration & remise aux normes */}
        <PerformanceEnvelopes item={item} catalog={catalog} quantity={item.area ?? autoQty ?? undefined} onUpdate={onUpdate} isMutating={isMutating} />

        {/* 4. Notes */}
        <div>
          <p className="text-sm font-medium mb-2">Notes</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => { if (notes !== (item.notes ?? '')) onUpdate({ notes: notes || null }) }}
            placeholder="Observations terrain, remarques…"
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------- Sélecteur du mode de guide ----------

function GuideModeToggle({ mode, onChange }: { mode: GuideMode; onChange: (m: GuideMode) => void }) {
  const opts: GuideMode[] = ['off', 'ask', 'always']
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <ScanSearch className="h-3.5 w-3.5 text-primary" />Guide IA
      </span>
      <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
        {opts.map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              mode === m ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {GUIDE_MODE_LABELS[m]}
          </button>
        ))}
      </div>
    </div>
  )
}
