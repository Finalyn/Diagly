/**
 * L'espace de travail des Métrés : un bâtiment, tout son jeu de plans.
 *
 * Trois zones, comme dans les logiciels de métré : à gauche le navigateur
 * des feuilles (toutes les pages de tous les plans du dossier, avec l'état
 * de leur échelle et de leur analyse), au centre la feuille choisie dans
 * l'éditeur de plan, à droite ce qu'il y a à valider sur cette feuille et le
 * récapitulatif des quantités validées du jeu entier. En haut, le bâtiment,
 * l'avancement de l'analyse et les deux boutons qui la pilotent.
 *
 * L'analyse tourne dans la file du dossier (components/metres/moteur.ts) :
 * on travaille sur une feuille prête pendant que les autres se traitent, et
 * l'on peut partir et revenir sans rien perdre.
 *
 * L'éditeur est celui du dossier, encastré : la page lui est imposée par le
 * navigateur, et ses panneaux de feuille passent dans la colonne de droite.
 *
 * Sur iPad debout, le navigateur se replie en tiroir pour laisser la place
 * au plan. Sur téléphone, l'écran n'est pas un outil de tracé : il montre le
 * récapitulatif et l'état des feuilles, et renvoie à l'iPad ou à
 * l'ordinateur pour corriger.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ChevronLeft, FolderOpen, Layers, Loader2, Plus, Square, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { ApiPlan, ChampCorrigeable, FeuillePlan, PlanAnnotation } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import { PlanEditor, type EncastrementEditeur, type SuiteAnalyse } from '@/components/PlanEditor'
import { MarqueDiagly } from '@/components/plans/AnalyseIA'
import { useOuvragesDuProjet } from '@/components/plans/ouvrages'
import { useMoteurMetres, type EtatFile, type MoteurMetres, type PoigneeEditeur } from '@/components/metres/moteur'
import { useNombreDePages } from '@/components/metres/pages'
import { NavigateurFeuilles, type GroupeDeFeuilles } from '@/components/metres/NavigateurFeuilles'
import { RecapitulatifMetres } from '@/components/metres/RecapitulatifMetres'
import {
  aValiderSurLaPage, estPdf, etatAnalyse, feuilleDe, libelleFeuille, lotDeLaPage, nombreDePages, ordonnerPlans,
  statutEchelle, type RefFeuille,
} from '@/lib/plans/feuilles'
import { recapitulatifDuJeu } from '@/lib/plans/recapitulatif'
import type { EchelleDePage } from '@/lib/plans/analyse-ia'

/** Sous cette largeur (iPad debout), le navigateur des feuilles passe en tiroir. */
const TIROIR = 'screen and (max-width: 1199px)'

function useTiroir() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(TIROIR)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(TIROIR).matches,
    () => false,
  )
}

/** Ce que l'éditeur ouvert tient de plus récent que le serveur. */
interface EtatEditeur { planId: string; annotations: PlanAnnotation[]; echelles: Record<string, number>; scale: number | null }

const FICHIERS_ADMIS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
const TAILLE_MAX = 30 * 1024 * 1024

export function EspaceMetres() {
  const { projectId = '' } = useParams<{ projectId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const telephone = useIsMobile()
  const tiroir = useTiroir()
  const [params, setParams] = useSearchParams()

  const projetQ = useQuery({ queryKey: ['project', projectId], queryFn: () => api.projects.get(projectId), enabled: !!projectId })
  const plansQ = useQuery({ queryKey: ['plans', projectId], queryFn: () => api.plans.list(projectId), enabled: !!projectId })
  const { items } = useOuvragesDuProjet(projectId)
  const ouvrages = useMemo(
    () => items.map((o) => ({ id: o.id, cfcCode: o.cfcCode ?? null, libelle: o.cfcLabel, unite: o.unit ?? null })),
    [items],
  )
  const { moteur, etat } = useMoteurMetres(projectId, { queryClient, ouvrages, plansCharges: !!plansQ.data })

  // Ce que l'éditeur ouvert tient : le récapitulatif et les pastilles le suivent sans attendre l'enregistrement.
  const [live, setLive] = useState<EtatEditeur | null>(null)
  const planVu = useCallback((plan: ApiPlan): ApiPlan => {
    if (live?.planId !== plan.id) return plan
    const table: PlanAnnotation[] = Object.keys(live.echelles).length
      ? [{ id: 'pages', type: 'pages', points: [], pageScales: live.echelles }]
      : []
    return { ...plan, scalePxPerM: live.scale, annotations: [...live.annotations.filter((a) => a.type !== 'pages'), ...table] }
  }, [live])

  // Les plans, dans l'ordre du dépôt.
  const plans = useMemo(() => ordonnerPlans(plansQ.data?.plans ?? []), [plansQ.data])
  const groupes: GroupeDeFeuilles[] = useMemo(() => plans.map((plan) => {
    const vu = planVu(plan)
    const f = moteur.feuillesDe(plan)
    const nombre = nombreDePages(plan, f)
    const pdf = estPdf(plan)
    return {
      plan,
      nombre,
      feuilles: Array.from({ length: nombre ?? 0 }, (_, i) => {
        const page = i + 1
        const feuille = feuilleDe(f, page)
        return {
          planId: plan.id, page, feuille,
          etat: etatAnalyse(vu, f, page),
          echelle: statutEchelle(vu, feuille, page),
          aValider: aValiderSurLaPage(vu.annotations ?? [], page, pdf),
        }
      }),
    }
  }),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- etat.version suit les écritures de la file
  [plans, planVu, moteur, etat.version])
  const toutes = useMemo(() => groupes.flatMap((g) => g.feuilles), [groupes])
  const nombresConnus = groupes.every((g) => g.nombre != null)

  // ---- la feuille choisie, gardée dans l'adresse pour qu'un rechargement y ramène
  const brut = params.get('feuille')
  const selection: RefFeuille | null = useMemo(() => {
    const [planId, page] = (brut ?? '').split('~')
    const trouvee = toutes.find((f) => f.planId === planId && f.page === Number(page))
    return trouvee ? { planId: trouvee.planId, page: trouvee.page } : toutes[0] ? { planId: toutes[0].planId, page: toutes[0].page } : null
  }, [brut, toutes])
  const [tiroirOuvert, setTiroirOuvert] = useState(false)
  const choisir = useCallback((f: RefFeuille) => {
    setParams({ feuille: `${f.planId}~${f.page}` }, { replace: true })
    setTiroirOuvert(false)
  }, [setParams])

  // ---- analyse demandée au dépôt : dès que les documents sont comptés
  const etatArrivee = location.state as { analyserTout?: boolean; plansManquants?: number } | null
  const lancementDemande = useRef(!!etatArrivee?.analyserTout)
  const [avis, setAvis] = useState<string | null>(() => {
    const n = etatArrivee?.plansManquants ?? 0
    return n > 0 ? `${n} fichier${n > 1 ? 's' : ''} n’${n > 1 ? 'ont' : 'a'} pas pu être envoyé${n > 1 ? 's' : ''}.` : null
  })
  useEffect(() => {
    // L'état de l'arrivée ne doit pas relancer quoi que ce soit au rechargement de la page.
    if (etatArrivee) navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null })
  }, [etatArrivee, navigate, location.pathname, location.search])
  useEffect(() => {
    if (!lancementDemande.current || !plansQ.data || plans.length === 0 || !nombresConnus) return
    lancementDemande.current = false
    void moteur.analyserTout()
  }, [plansQ.data, plans.length, nombresConnus, moteur])

  // ---- ajouter des plans au dossier, sans quitter l'espace
  const champFichiers = useRef<HTMLInputElement>(null)
  const [envoi, setEnvoi] = useState<string | null>(null)
  const ajouterPlans = async (fichiers: FileList | null) => {
    if (!fichiers?.length) return
    const admis = Array.from(fichiers).filter((f) => FICHIERS_ADMIS.includes(f.type) && f.size <= TAILLE_MAX)
    let manquants = fichiers.length - admis.length
    let envoyes = 0
    for (const [i, f] of admis.entries()) {
      setEnvoi(`Envoi ${i + 1}/${admis.length}…`)
      try { await api.plans.upload(projectId, f); envoyes++ } catch { manquants++ }
    }
    setEnvoi(null)
    if (champFichiers.current) champFichiers.current.value = ''
    if (manquants) setAvis(`${manquants} fichier${manquants > 1 ? 's' : ''} refusé${manquants > 1 ? 's' : ''} (PDF ou image, 30 Mo au plus).`)
    await queryClient.invalidateQueries({ queryKey: ['plans', projectId] })
    void queryClient.invalidateQueries({ queryKey: ['metres'] })
    // Comme au dépôt depuis la page des métrés : les nouvelles feuilles partent à l'analyse.
    if (envoyes > 0) lancementDemande.current = true
  }

  // ---- l'éditeur encastré
  const planCourant = plans.find((p) => p.id === selection?.planId) ?? null
  const planCourantId = planCourant?.id ?? null
  const [panneau, setPanneau] = useState<HTMLDivElement | null>(null)
  const definirPoignee = useCallback((p: PoigneeEditeur | null) => moteur.definirPoignee(p), [moteur])
  const enregistrer = useCallback((corps: Parameters<MoteurMetres['ecrire']>[1]) => moteur.ecrire(planCourantId!, corps), [moteur, planCourantId])
  const versPage = useCallback((page: number) => { if (planCourantId) choisir({ planId: planCourantId, page }) }, [choisir, planCourantId])

  const encastre: EncastrementEditeur | null = useMemo(() => {
    if (!planCourant || !selection) return null
    const f = moteur.feuillesDe(planCourant)
    const feuille = feuilleDe(f, selection.page)
    const lot = lotDeLaPage(f, selection.page)
    const suite: SuiteAnalyse | null = feuille.analyse?.statut === 'prete' || lot
      ? {
        ecartees: feuille.ecartees ?? [],
        remarques: lot?.remarques ?? null,
        tronque: !!feuille.tronque,
        pagesSansGeometrie: feuille.sansGeometrie ? [selection.page] : [],
        comptages: lot?.comptages ?? [],
      }
      : null
    return {
      page: selection.page,
      onPage: versPage,
      titre: libelleFeuille(feuille, selection.page, planCourant.name),
      enregistrer,
      panneau,
      suite,
      echellesProposees: Object.values(f.pages).map((x) => x.echelle).filter((e): e is EchelleDePage => !!e),
      definirPoignee,
      onEtat: setLive,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- etat.version suit les écritures de la file
  }, [planCourant, selection, moteur, etat.version, versPage, enregistrer, panneau, definirPoignee])

  // ---- récapitulatif du jeu
  const recap = useMemo(
    () => recapitulatifDuJeu(plans.map((p) => ({ plan: planVu(p), feuilles: moteur.feuillesDe(p) }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- etat.version suit les écritures de la file
    [plans, planVu, moteur, etat.version],
  )
  const [onglet, setOnglet] = useState<'feuille' | 'quantites'>('feuille')

  const corriger = useCallback((f: RefFeuille, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => moteur.corriger(f.planId, f.page, patch), [moteur])
  const analyser = useCallback((f: RefFeuille, relance: boolean) => {
    if (relance && !window.confirm('Relancer l’analyse de cette feuille ? Les propositions encore à valider y seront remplacées ; ce qui est validé reste.')) return
    void moteur.analyser([f])
  }, [moteur])

  const projet = projetQ.data?.project
  const compteurs = useMemo(() => ({
    total: toutes.length,
    pretes: toutes.filter((f) => f.etat === 'prete').length,
    restantes: toutes.filter((f) => f.etat === 'en_file' || f.etat === 'en_cours').length,
    erreurs: toutes.filter((f) => f.etat === 'erreur').length,
    aAnalyser: toutes.filter((f) => f.etat === 'aucune' || f.etat === 'erreur').length,
  }), [toutes])

  const compteursDePages = plans.map((p) => <CompteurDePages key={p.id} plan={p} moteur={moteur} />)

  if (projetQ.isError || plansQ.isError) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-red-700">Ce dossier est introuvable, ou vous n’y avez pas accès.</p>
        <Link to="/app/metres" className="text-sm font-medium underline-offset-2 hover:underline">Retour aux métrés</Link>
      </div>
    )
  }

  const barre = (
    <BarreDuHaut
      nom={projet?.name ?? '…'}
      adresse={[projet?.address, projet?.city].filter(Boolean).join(', ')}
      projectId={projectId}
      etat={etat}
      compteurs={compteurs}
      nombresConnus={nombresConnus}
      telephone={telephone}
      tiroir={tiroir && !telephone}
      onTiroir={() => setTiroirOuvert(true)}
      onAnalyserTout={() => void moteur.analyserTout()}
      onArreter={() => void moteur.arreter()}
    />
  )

  const bandeauAvis = avis && (
    <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <p>{avis}</p>
      <button onClick={() => setAvis(null)} className="shrink-0 rounded p-0.5 hover:bg-amber-100" title="Fermer"><X className="h-4 w-4" /></button>
    </div>
  )

  // ---- téléphone : le récapitulatif et l'état des feuilles, sans outil de tracé
  if (telephone) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-muted/40">
        {compteursDePages}
        {barre}
        {bandeauAvis}
        <EcranTelephone groupes={groupes} recap={recap} chargement={plansQ.isLoading} />
      </div>
    )
  }

  const navigateur = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold">Feuilles</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {compteurs.total} feuille{compteurs.total > 1 ? 's' : ''} · {plans.length} document{plans.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => champFichiers.current?.click()}
          disabled={!!envoi}
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          title="Ajouter des plans à ce dossier"
        >
          {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {envoi ?? 'Ajouter'}
        </button>
        <input ref={champFichiers} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void ajouterPlans(e.target.files)} />
        {tiroir && (
          <button onClick={() => setTiroirOuvert(false)} className="rounded-lg p-1.5 hover:bg-muted" title="Fermer"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5 pb-[calc(var(--safe-bottom)+0.75rem)]">
        {plansQ.isLoading
          ? <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
          : plans.length === 0
            ? <p className="p-3 text-xs text-muted-foreground">Ce dossier n’a pas encore de plan. Ajoutez-en : l’analyse démarre d’elle-même.</p>
            : <NavigateurFeuilles groupes={groupes} selection={selection} onChoisir={choisir} onAnalyser={analyser} onCorriger={corriger} />}
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {compteursDePages}
      {barre}
      {bandeauAvis}
      <div className="safe-sides relative flex min-h-0 flex-1">
        {/* Navigateur : colonne fixe à l'horizontale, tiroir sur iPad debout. */}
        {!tiroir && <aside className="w-72 shrink-0 border-r bg-muted/30">{navigateur}</aside>}
        {tiroir && tiroirOuvert && (
          <div className="absolute inset-0 z-[55] flex" role="dialog" aria-label="Feuilles">
            <aside className="w-80 max-w-[85%] border-r bg-background shadow-2xl">{navigateur}</aside>
            <button className="flex-1 bg-black/30" onClick={() => setTiroirOuvert(false)} aria-label="Fermer les feuilles" />
          </div>
        )}

        <main className="relative min-w-0 flex-1">
          {planCourant && encastre ? (
            <PlanEditor key={planCourant.id} plan={planCourant} encastre={encastre} />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {plansQ.isLoading || !nombresConnus
                ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Préparation des feuilles…</span>
                : 'Choisissez une feuille à gauche.'}
            </div>
          )}
        </main>

        {/* À droite : la feuille (ce qui y attend d'être validé), et les quantités du jeu. */}
        <aside className="flex w-80 shrink-0 flex-col border-l bg-muted/30 xl:w-[22rem]">
          <div className="flex shrink-0 gap-1 border-b p-2">
            <Onglet actif={onglet === 'feuille'} onClick={() => setOnglet('feuille')}>Cette feuille</Onglet>
            <Onglet actif={onglet === 'quantites'} onClick={() => setOnglet('quantites')}>
              Quantités du jeu{recap.aValider > 0 && <span className="ml-1 rounded-full bg-teal-100 px-1.5 text-[10px] text-teal-800">{recap.aValider}</span>}
            </Onglet>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
            {/* La colonne de la feuille reste montée : l'éditeur y pose ses panneaux. */}
            <div ref={setPanneau} className={cn(onglet !== 'feuille' && 'hidden')} />
            {onglet === 'quantites' && (
              <RecapitulatifMetres
                recap={recap}
                onAllerA={(s) => { choisir({ planId: s.planId, page: s.page }); setOnglet('feuille') }}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Compte les pages d'un document et le dit à la file, sans rien afficher. */
function CompteurDePages({ plan, moteur }: { plan: ApiPlan; moteur: MoteurMetres }) {
  const n = useNombreDePages(plan)
  useEffect(() => { if (n && estPdf(plan)) moteur.definirNombre(plan.id, n) }, [n, plan, moteur])
  return null
}

function Onglet({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={cn('flex flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
        actif ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  )
}

function BarreDuHaut({
  nom, adresse, projectId, etat, compteurs, nombresConnus, telephone, tiroir, onTiroir, onAnalyserTout, onArreter,
}: {
  nom: string
  adresse: string
  projectId: string
  etat: EtatFile
  compteurs: { total: number; pretes: number; restantes: number; erreurs: number; aAnalyser: number }
  nombresConnus: boolean
  telephone: boolean
  tiroir: boolean
  onTiroir: () => void
  onAnalyserTout: () => void
  onArreter: () => void
}) {
  // Le temps du lot en cours se lit : une minute sans signe de vie inquiète.
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    if (!etat.lot) return
    const t = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(t)
  }, [etat.lot])
  const secondes = etat.lot ? Math.max(0, Math.round((maintenant - etat.lot.depuis) / 1000)) : 0
  const duree = secondes >= 60 ? `${Math.floor(secondes / 60)} min ${String(secondes % 60).padStart(2, '0')} s` : `${secondes} s`
  const part = compteurs.total ? compteurs.pretes / compteurs.total : 0

  return (
    <header className="safe-top safe-sides shrink-0 border-b bg-background">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <Link to="/app/metres" className="flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Tous les métrés">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <img src={telephone ? '/diagly-mark.svg' : '/diagly-logo.svg'} alt="Diagly" className={cn('shrink-0', telephone ? 'h-6 w-6' : 'h-6')} />
        <div className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nom}</p>
          <p className="truncate text-xs text-muted-foreground">{adresse || 'Métrés'}</p>
        </div>

        {tiroir && (
          <button onClick={onTiroir} className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium hover:bg-muted">
            <Layers className="h-4 w-4" />Feuilles
          </button>
        )}

        {/* L'avancement de l'analyse du jeu entier. */}
        <div className={cn('min-w-0 shrink-0', telephone ? 'order-last w-full' : 'w-56')}>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            {etat.lot ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <MarqueDiagly className="h-3.5 w-3.5" />}
            {etat.lot
              ? `${etat.lot.etape === 'preparation' ? 'Préparation' : 'Analyse'} de ${etat.lot.pages.length} page${etat.lot.pages.length > 1 ? 's' : ''} · ${duree}`
              : compteurs.total ? `${compteurs.pretes}/${compteurs.total} feuilles analysées` : 'Aucune feuille'}
          </p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-emerald-500 transition-[width]" style={{ width: `${Math.round(part * 100)}%` }} />
          </div>
          <p className={cn('mt-0.5 truncate text-[11px] text-muted-foreground', telephone && !etat.pause && !compteurs.restantes && !compteurs.erreurs && !compteurs.aAnalyser && 'hidden')}>
            {etat.pause
              ? <span className="text-amber-700">{etat.pause}</span>
              : compteurs.restantes
                ? `${compteurs.restantes} page${compteurs.restantes > 1 ? 's' : ''} restent à analyser`
                : compteurs.erreurs
                  ? <span className="text-red-700">{compteurs.erreurs} feuille{compteurs.erreurs > 1 ? 's' : ''} en erreur</span>
                  : compteurs.aAnalyser ? `${compteurs.aAnalyser} feuille${compteurs.aAnalyser > 1 ? 's' : ''} non analysée${compteurs.aAnalyser > 1 ? 's' : ''}` : ' '}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {compteurs.restantes > 0 || etat.lot ? (
            <button onClick={onArreter} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted">
              <Square className="h-3.5 w-3.5" />Arrêter
            </button>
          ) : telephone && compteurs.aAnalyser === 0 ? null : (
            <button
              onClick={onAnalyserTout}
              disabled={compteurs.aAnalyser === 0 || !nombresConnus}
              className={cn('flex items-center gap-1.5 rounded-lg bg-foreground font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40',
                telephone ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-sm')}
              title={compteurs.aAnalyser ? `Analyser les ${compteurs.aAnalyser} feuilles qui ne l’ont pas été` : 'Toutes les feuilles sont analysées'}
            >
              <MarqueDiagly className="h-4 w-4 brightness-0 invert" />
              Analyser tout{compteurs.aAnalyser ? ` (${compteurs.aAnalyser})` : ''}
            </button>
          )}
          {!telephone && (
            <Link to={`/app/projects/${projectId}`} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" title="Ouvrir le dossier">
              <FolderOpen className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

/** Sur téléphone : les quantités et l'état des feuilles, et où aller pour corriger. */
function EcranTelephone({ groupes, recap, chargement }: {
  groupes: GroupeDeFeuilles[]
  recap: ReturnType<typeof recapitulatifDuJeu>
  chargement: boolean
}) {
  const [onglet, setOnglet] = useState<'quantites' | 'feuilles'>('quantites')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-sky-700" />
        Pour corriger les métrés, ouvrez ce plan sur iPad ou ordinateur.
      </p>
      <div className="mx-3 mt-3 flex gap-1 rounded-xl bg-muted p-1">
        <Onglet actif={onglet === 'quantites'} onClick={() => setOnglet('quantites')}>Quantités</Onglet>
        <Onglet actif={onglet === 'feuilles'} onClick={() => setOnglet('feuilles')}>Feuilles</Onglet>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(var(--safe-bottom)+1rem)]">
        {chargement
          ? <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
          : onglet === 'quantites'
            ? <RecapitulatifMetres recap={recap} />
            : <NavigateurFeuilles groupes={groupes} selection={null} lectureSeule />}
      </div>
    </div>
  )
}
