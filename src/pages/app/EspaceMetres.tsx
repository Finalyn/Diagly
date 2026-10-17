/**
 * L'espace de travail des Métrés : un bâtiment, tout son jeu de plans.
 *
 * Trois zones, comme dans les logiciels de métré : à gauche le navigateur
 * des feuilles (toutes les pages de tous les plans du dossier, avec l'état
 * de leur échelle et de leur analyse), au centre la feuille choisie dans
 * l'éditeur de plan, à droite le panneau des quantités du jeu entier, et ce
 * qui attend d'être validé sur la feuille ouverte. En haut, le bâtiment,
 * l'avancement de l'analyse, la revue, l'export et le report au dossier.
 *
 * Le panneau des quantités est relié au plan dans les deux sens : une ligne
 * ouvre sa feuille et cadre sa forme, une forme sélectionnée éclaire sa
 * ligne. On y masque une classification, on y choisit celle dans laquelle on
 * dessine, et la forme en cours de tracé y compte déjà.
 *
 * La revue parcourt tout ce qui attend d'être validé, toutes feuilles
 * confondues, du moins sûr au plus sûr : la vue se cadre sur chaque élément,
 * et l'on décide au clavier ou d'un gros bouton.
 *
 * Un symbole encadré sur une feuille se cherche sur toutes les feuilles
 * vectorielles du jeu ; ses occurrences, revues, deviennent des repères.
 *
 * L'analyse tourne dans la file du dossier (components/metres/moteur.ts) :
 * on travaille sur une feuille prête pendant que les autres se traitent, et
 * l'on peut partir et revenir sans rien perdre. Une échelle vérifiée se pose
 * d'elle-même à l'arrivée du résultat.
 *
 * L'éditeur est celui du dossier, encastré : la page lui est imposée par le
 * navigateur, et ses panneaux de feuille passent dans la colonne de droite.
 *
 * Sur iPad debout, le navigateur se replie en tiroir pour laisser la place
 * au plan. Sur téléphone, l'écran n'est pas un outil de tracé : il montre les
 * quantités et l'état des feuilles, et renvoie à l'iPad ou à l'ordinateur
 * pour corriger.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle, AlertTriangle, ChevronLeft, FileSpreadsheet, FolderOpen, Layers, ListChecks, Loader2, Plus, SendHorizontal, Square, X,
} from 'lucide-react'
import { api, saveBlob } from '@/lib/api'
import type { ApiPlan, ChampCorrigeable, FeuillePlan, PlanAnnotation } from '@/lib/api-types'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-mobile'
import {
  PlanEditor, type BrouillonEditeur, type ClassementActif, type EncastrementEditeur, type SuiteAnalyse,
} from '@/components/PlanEditor'
import { MarqueDiagly } from '@/components/plans/AnalyseIA'
import { reporterSurLOuvrage, useOuvragesDuProjet } from '@/components/plans/ouvrages'
import { useMoteurMetres, type EtatFile, type MoteurMetres, type PoigneeEditeur } from '@/components/metres/moteur'
import { useNombreDePages } from '@/components/metres/pages'
import { NavigateurFeuilles, type GroupeDeFeuilles } from '@/components/metres/NavigateurFeuilles'
import { PanneauQuantites, type ActionsPanneau } from '@/components/metres/PanneauQuantites'
import { CarteRevue } from '@/components/metres/RevueMetres'
import { CarteRechercheSymbole, type ResultatSymbole } from '@/components/metres/RechercheSymbole'
import { chercherDansLeJeu } from '@/components/metres/symboles'
import { ReportDossier } from '@/components/metres/ReportDossier'
import { useEnregistrerComptages } from '@/components/comptages/enregistrer'
import {
  aValiderSurLaPage, echellesAPoser, enAttente, estPdf, etatAnalyse, feuilleDe, libelleFeuille, lotDeLaPage, nombreDePages,
  ordonnerPlans, statutEchelle, type RefFeuille,
} from '@/lib/plans/feuilles'
import {
  CLASSIFICATION, CLASSIFICATIONS, classificationDe, entreesSia416, panneauDesQuantites, type CleClassification, type InstanceQ,
  type PanneauQuantites as Panneau, type PlanPourQuantites,
} from '@/lib/plans/quantites'
import { surfacesSia416 } from '@/lib/plans/sia416'
import { fileDeRevue, type ElementRevue } from '@/lib/plans/revue'
import { exportDuMetre, nomDuClasseur } from '@/lib/plans/export-metres'
import { resumeDuReport, type ResumeReport } from '@/lib/plans/report-metres'
import { comptagesDuDossier, type CategorieComptee } from '@/lib/base-cfc/comptages'
import { COULEURS_CATEGORIE } from '@/lib/plans/analyse-ia'
import type { Gabarit } from '@/lib/plans/symboles'
import type { EchelleDePage } from '@/lib/plans/analyse-ia'

/** Une recherche de symbole : où elle en est, ce qu'elle a trouvé, ce qui sera compté. */
interface RechercheSymbole {
  progres: { fait: number; total: number } | null
  resultats: (ResultatSymbole & { largeur: number; hauteur: number })[]
  coches: ReadonlySet<string>
  categorie: CategorieComptee
}

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

/**
 * Une valeur qui change à chaque mouvement du pointeur (la forme en cours de
 * tracé) : seul le panneau des quantités s'y abonne, pour que tout l'espace
 * de travail ne se redessine pas à chaque pixel.
 */
class Diffuseur<T> {
  private valeur: T
  private ecouteurs = new Set<() => void>()
  constructor(v: T) { this.valeur = v }
  lire = () => this.valeur
  abonner = (f: () => void) => { this.ecouteurs.add(f); return () => { this.ecouteurs.delete(f) } }
  ecrire = (v: T) => {
    if (v === this.valeur) return
    this.valeur = v
    for (const f of this.ecouteurs) f()
  }
}

/** La revue en cours : les éléments relevés au départ, où l'on en est, ce qui a été décidé. */
interface Revue {
  elements: ElementRevue[]
  index: number
  decisions: Record<string, 'validee' | 'rejetee'>
}

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

  // Ce que l'éditeur ouvert tient : le panneau et les pastilles le suivent sans attendre l'enregistrement.
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

  // Le jeu tel que le panneau, la revue, l'export et le report le lisent.
  const jeu: PlanPourQuantites[] = useMemo(
    () => plans.map((p) => ({ plan: planVu(p), feuilles: moteur.feuillesDe(p) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- etat.version suit les écritures de la file
    [plans, planVu, moteur, etat.version],
  )
  const projet = projetQ.data?.project
  const hauteurDuDossier = projet?.floorHeight ?? null
  const panneau = useMemo(() => panneauDesQuantites(jeu, { hauteurDuDossier }), [jeu, hauteurDuDossier])
  const aValiderJeu = useMemo(() => jeu.reduce((s, x) => s + (x.plan.annotations ?? []).filter(enAttente).length, 0), [jeu])
  const echellesEnAttente = useMemo(() => jeu.reduce((s, x) => s + Object.keys(echellesAPoser(x.plan, x.feuilles)).length, 0), [jeu])

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

  // ---- le lien entre le panneau et le plan
  const [diffuseur] = useState(() => new Diffuseur<BrouillonEditeur | null>(null))
  const [selectionPlan, setSelectionPlan] = useState<string | null>(null)
  const [cible, setCible] = useState<{ id: string; jeton: number; points?: { x: number; y: number }[] } | null>(null)
  const [masquees, setMasquees] = useState<ReadonlySet<CleClassification>>(() => new Set())
  const [classement, setClassement] = useState<{ cle: CleClassification; jeton: number } | null>(null)
  const [revue, setRevue] = useState<Revue | null>(null)

  /** Ouvre la feuille d'une forme et la cadre. */
  const montrer = useCallback((planId: string, page: number, id: string) => {
    choisir({ planId, page })
    setCible({ id, jeton: Date.now() })
  }, [choisir])

  const masquer = useCallback((cle: CleClassification, isoler: boolean) => setMasquees((s) => {
    if (isoler) {
      // Isoler une classification déjà isolée rend tout visible.
      const autres = CLASSIFICATIONS.map((c) => c.cle).filter((k) => k !== cle)
      const dejaIsolee = !s.has(cle) && autres.every((k) => s.has(k))
      return dejaIsolee ? new Set() : new Set(autres)
    }
    const n = new Set(s)
    if (n.has(cle)) n.delete(cle)
    else n.add(cle)
    return n
  }), [])
  // Pendant la revue, tout reste visible : l'élément à décider ne doit pas être caché.
  const masquee = useMemo(() => (masquees.size && !revue
    ? (a: PlanAnnotation) => { const c = classificationDe(a); return !!c && masquees.has(c) }
    : undefined), [masquees, revue])

  const classementEditeur: ClassementActif | null = useMemo(() => {
    if (!classement) return null
    const d = CLASSIFICATION[classement.cle]
    return { libelle: d.titre, couleur: d.couleur, outil: d.outil, typeZone: d.typeZone, jeton: classement.jeton }
  }, [classement])

  const actions: ActionsPanneau = {
    onChoisir: (i: InstanceQ) => montrer(i.planId, i.page, i.id),
    onMasquer: masquer,
    onToutAfficher: () => setMasquees(new Set()),
    onDessinerDans: (cle) => setClassement((c) => (c?.cle === cle ? null : { cle, jeton: Date.now() })),
    onHauteur: (e, h) => moteur.reglerFeuille(e.planId, e.page, { hauteurEtage: h }),
    onAffecter: (planId, id, categorie) => void moteur.modifierAnnotation(planId, id, { sia416: categorie ?? undefined }),
  }

  // ---- la recherche d'un symbole sur tout le jeu
  const [symbole, setSymbole] = useState<RechercheSymbole | null>(null)
  const arretSymbole = useRef<AbortController | null>(null)
  const chercherSymbole = useCallback(async ({ gabarit }: { gabarit: Gabarit }) => {
    arretSymbole.current?.abort()
    const arret = new AbortController()
    arretSymbole.current = arret
    const feuilles = groupes.flatMap((g) => g.feuilles.map((f) => ({ plan: g.plan, page: f.page })))
    setSymbole({ progres: { fait: 0, total: feuilles.length }, resultats: [], coches: new Set(), categorie: 'appareil_sanitaire' })
    const trouve = await chercherDansLeJeu(feuilles, gabarit, (fait, total) => {
      if (!arret.signal.aborted) setSymbole((s) => (s ? { ...s, progres: { fait, total } } : s))
    }, arret.signal)
    if (arret.signal.aborted) return
    const resultats = trouve.flatMap((f) => {
      const g = groupes.find((x) => x.plan.id === f.planId)
      const feuille = g ? libelleFeuille(feuilleDe(moteur.feuillesDe(g.plan), f.page), f.page, g.plan.name) : `Page ${f.page}`
      return f.occurrences.map((o, i) => ({ id: `${f.planId}#${f.page}#${i}`, planId: f.planId, page: f.page, feuille, x: o.x, y: o.y, largeur: o.largeur, hauteur: o.hauteur }))
    })
    setSymbole((s) => (s ? { ...s, progres: null, resultats, coches: new Set(resultats.map((r) => r.id)) } : s))
  }, [groupes, moteur])
  const fermerSymbole = () => { arretSymbole.current?.abort(); setSymbole(null) }
  /** Les occurrences cochées deviennent des repères validés, numérotés à la suite des autres de leur page. */
  const compterSymbole = async () => {
    if (!symbole) return
    const retenus = symbole.resultats.filter((r) => symbole.coches.has(r.id))
    const categorie = symbole.categorie
    let n = 0
    for (const planId of [...new Set(retenus.map((r) => r.planId))]) {
      const x = jeu.find((j) => j.plan.id === planId)
      if (!x) continue
      const pdf = estPdf(x.plan)
      const suivant = new Map<number, number>()
      const nouvelles: PlanAnnotation[] = retenus.filter((r) => r.planId === planId).map((r) => {
        const page = pdf ? r.page : 1
        if (!suivant.has(page)) {
          const deja = (x.plan.annotations ?? []).filter((a) => a.repere?.categorie === categorie && (!pdf || (a.page ?? 1) === page)).map((a) => a.repere!.numero)
          suivant.set(page, Math.max(0, ...deja) + 1)
        }
        const numero = suivant.get(page)!
        suivant.set(page, numero + 1)
        return {
          id: `s${Date.now().toString(36)}_${n++}`, type: 'repere', points: [{ x: r.x, y: r.y }], page: pdf ? r.page : undefined,
          color: COULEURS_CATEGORIE[categorie], repere: { categorie, numero }, origine: 'symbole',
        }
      })
      await moteur.ajouterAnnotations(planId, nouvelles)
    }
    setSymbole(null)
  }
  const marques = useMemo(() => (symbole && selection
    ? symbole.resultats.filter((r) => r.planId === selection.planId && r.page === selection.page)
      .map((r) => ({ id: r.id, x: r.x, y: r.y, largeur: r.largeur, hauteur: r.hauteur, actif: symbole.coches.has(r.id) }))
    : undefined), [symbole, selection])

  // ---- l'éditeur encastré
  const planCourant = plans.find((p) => p.id === selection?.planId) ?? null
  const planCourantId = planCourant?.id ?? null
  const [panneauFeuille, setPanneauFeuille] = useState<HTMLDivElement | null>(null)
  const poignee = useRef<PoigneeEditeur | null>(null)
  const [planDeLaPoignee, setPlanDeLaPoignee] = useState<string | null>(null)
  const definirPoignee = useCallback((p: PoigneeEditeur | null) => {
    poignee.current = p
    setPlanDeLaPoignee(p?.planId ?? null)
    moteur.definirPoignee(p)
  }, [moteur])
  const enregistrer = useCallback((corps: Parameters<MoteurMetres['ecrire']>[1]) => moteur.ecrire(planCourantId!, corps), [moteur, planCourantId])
  const versPage = useCallback((page: number) => { if (planCourantId) choisir({ planId: planCourantId, page }) }, [choisir, planCourantId])
  const finClassement = useCallback(() => setClassement(null), [])

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
      panneau: panneauFeuille,
      suite,
      echellesProposees: Object.values(f.pages).map((x) => x.echelle).filter((e): e is EchelleDePage => !!e),
      definirPoignee,
      onEtat: setLive,
      onBrouillon: diffuseur.ecrire,
      onSelection: setSelectionPlan,
      cible,
      masquee,
      classement: classementEditeur,
      onFinClassement: finClassement,
      revue: !!revue,
      onSymbole: chercherSymbole,
      marques,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- etat.version suit les écritures de la file
  }, [planCourant, selection, moteur, etat.version, versPage, enregistrer, panneauFeuille, definirPoignee, diffuseur, cible, masquee, classementEditeur, finClassement, revue, chercherSymbole, marques])

  const [onglet, setOnglet] = useState<'quantites' | 'feuille'>('quantites')
  const aValiderFeuille = toutes.find((f) => f.planId === selection?.planId && f.page === selection?.page)?.aValider ?? 0

  const corriger = useCallback((f: RefFeuille, patch: Partial<Pick<FeuillePlan, ChampCorrigeable>>) => moteur.corriger(f.planId, f.page, patch), [moteur])
  const analyser = useCallback((f: RefFeuille, relance: boolean) => {
    if (relance && !window.confirm('Relancer l’analyse de cette feuille ? Les propositions encore à valider y seront remplacées ; ce qui est validé reste.')) return
    void moteur.analyser([f])
  }, [moteur])

  // ---- la revue des éléments à valider, toutes feuilles confondues
  const demarrerRevue = () => {
    const elements = fileDeRevue(jeu)
    if (!elements.length) return
    setClassement(null)
    setRevue({ elements, index: 0, decisions: {} })
  }
  const courant = revue && revue.index < revue.elements.length ? revue.elements[revue.index] : null
  // Chaque élément ouvre sa feuille et s'y cadre.
  useEffect(() => {
    if (!courant) return
    montrer(courant.planId, courant.page, courant.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seul un nouvel élément déplace la vue
  }, [courant?.id])
  const pretPourDecider = !!courant && planDeLaPoignee === courant.planId && selection?.planId === courant.planId && selection.page === courant.page
  /** Le prochain élément sans décision, après celui-ci, puis depuis le début ; la fin sinon. */
  const prochain = (r: Revue, decisions: Revue['decisions']) => {
    const n = r.elements.length
    for (let k = 1; k <= n; k++) {
      const i = (r.index + k) % n
      if (!decisions[r.elements[i].id]) return i
    }
    return n
  }
  const decider = (d: 'validee' | 'rejetee') => {
    if (!revue || !courant || !pretPourDecider || revue.decisions[courant.id]) return
    if (d === 'validee') poignee.current?.valider?.([courant.id])
    else poignee.current?.rejeter?.([courant.id])
    const decisions = { ...revue.decisions, [courant.id]: d }
    setRevue({ ...revue, decisions, index: prochain(revue, decisions) })
  }
  const deplacer = (pas: number) => setRevue((r) => (r ? { ...r, index: Math.max(0, Math.min(r.elements.length - 1, r.index + pas)) } : r))
  const actionsRevue = useRef({ decider, deplacer, quitter: () => setRevue(null) })
  useEffect(() => { actionsRevue.current = { decider, deplacer, quitter: () => setRevue(null) } })
  const revueActive = !!revue
  useEffect(() => {
    if (!revueActive) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const a = actionsRevue.current
      if (e.key === 'Enter') { e.preventDefault(); a.decider('validee') }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); a.decider('rejetee') }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); a.deplacer(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); a.deplacer(-1) }
      else if (e.key === 'Escape') { e.preventDefault(); a.quitter() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revueActive])

  // ---- retirer un document du jeu : ses feuilles et tout ce qui y est tracé
  const supprimerPlan = async (plan: ApiPlan) => {
    if (!window.confirm(`Supprimer « ${plan.name} » ? Ses feuilles et tous les métrés tracés dessus seront perdus.`)) return
    try {
      await api.plans.delete(plan.id)
      await queryClient.invalidateQueries({ queryKey: ['plans', projectId] })
    } catch {
      setAvis(`« ${plan.name} » n’a pas pu être supprimé : réessayez.`)
    }
  }

  // ---- export Excel du métré
  const [exportEtat, setExportEtat] = useState<'repos' | 'en-cours' | 'erreur'>('repos')
  const exporter = async () => {
    setExportEtat('en-cours')
    try {
      const sia = surfacesSia416(entreesSia416(panneau))
      const parId = new Map(jeu.map((x) => [x.plan.id, x]))
      const m = exportDuMetre(panneau, sia, {
        batiment: projet?.name ?? 'Bâtiment',
        adresse: [projet?.address, [projet?.postalCode, projet?.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
        feuille: (planId, page) => {
          const x = parId.get(planId)
          return x ? libelleFeuille(feuilleDe(x.feuilles, page), page, x.plan.name) : `Page ${page}`
        },
        annotation: (planId, id) => parId.get(planId)?.plan.annotations.find((a) => a.id === id) ?? null,
      })
      const { blob } = await api.export.metres(projectId, m)
      saveBlob(blob, nomDuClasseur(projet?.name ?? 'batiment'))
      setExportEtat('repos')
    } catch {
      setExportEtat('erreur')
    }
  }

  // ---- report au dossier
  const enregistrerComptages = useEnregistrerComptages(projectId)
  const [report, setReport] = useState<{ resume: ResumeReport; etat: 'pret' | 'en-cours' | 'fait'; erreur: string | null } | null>(null)
  const ouvrirReport = () => {
    const resume = resumeDuReport(panneau, jeu, comptagesDuDossier(projet?.comptages),
      items.map((o) => ({ id: o.id, cfcCode: o.cfcCode ?? null, cfcLabel: o.cfcLabel, unit: o.unit ?? null, area: o.area ?? null })))
    setReport({ resume, etat: 'pret', erreur: null })
  }
  const confirmerReport = async () => {
    if (!report) return
    setReport({ ...report, etat: 'en-cours', erreur: null })
    try {
      const { comptages, ouvrages: lignes } = report.resume
      if (Object.keys(comptages).length) await enregistrerComptages.mutateAsync((actuels) => ({ ...actuels, ...comptages }))
      for (const l of lignes) {
        if (!l.verdict.ok) continue
        const it = items.find((o) => o.id === l.ouvrage.id)
        if (it) await reporterSurLOuvrage(it, l.verdict.quantite)
      }
      const diagnosticId = projetQ.data?.diagnostics[0]?.id
      if (diagnosticId) void queryClient.invalidateQueries({ queryKey: ['diagnostic-items', diagnosticId] })
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      setReport((r) => (r ? { ...r, etat: 'fait' } : r))
    } catch (e) {
      setReport((r) => (r ? { ...r, etat: 'pret', erreur: `Le report a échoué : ${(e as Error)?.message ?? 'erreur inconnue'}. Réessayez.` } : r))
    }
  }

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
      aValider={aValiderJeu}
      revueActive={revueActive}
      exportEtat={exportEtat}
      rienAExporter={panneau.classifications.length === 0}
      onTiroir={() => setTiroirOuvert(true)}
      onAnalyserTout={() => void moteur.analyserTout()}
      onArreter={() => void moteur.arreter()}
      onRevoir={demarrerRevue}
      onExporter={() => void exporter()}
      onReporter={ouvrirReport}
    />
  )

  const bandeauAvis = avis && (
    <div className="flex items-start justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <p>{avis}</p>
      <button onClick={() => setAvis(null)} className="shrink-0 rounded p-0.5 hover:bg-amber-100" title="Fermer"><X className="h-4 w-4" /></button>
    </div>
  )

  // ---- téléphone : les quantités et l'état des feuilles, sans outil de tracé
  if (telephone) {
    return (
      <div className="flex h-dvh flex-col overflow-hidden bg-muted/40">
        {compteursDePages}
        {barre}
        {bandeauAvis}
        <EcranTelephone groupes={groupes} panneau={panneau} chargement={plansQ.isLoading} />
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
          className="flex shrink-0 items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50 pointer-coarse:min-h-11"
          title="Ajouter des plans à ce dossier"
        >
          {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          {envoi ?? 'Ajouter'}
        </button>
        <input ref={champFichiers} type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => void ajouterPlans(e.target.files)} />
        {tiroir && (
          <button onClick={() => setTiroirOuvert(false)} className="rounded-lg p-1.5 hover:bg-muted pointer-coarse:p-3" title="Fermer"><X className="h-4 w-4" /></button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5 pb-[calc(var(--safe-bottom)+0.75rem)]">
        {plansQ.isLoading
          ? <p className="flex items-center gap-2 p-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</p>
          : plans.length === 0
            ? <p className="p-3 text-xs text-muted-foreground">Ce dossier n’a pas encore de plan. Ajoutez-en : l’analyse démarre d’elle-même.</p>
            : (
              <NavigateurFeuilles
                groupes={groupes} selection={selection} onChoisir={choisir} onAnalyser={analyser} onCorriger={corriger}
                echellesAPoser={echellesEnAttente} onPoserEchelles={() => void moteur.poserLesEchellesProposees()}
                onSupprimer={(plan) => void supprimerPlan(plan)}
              />
            )}
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
          {symbole && !revue && (
            <CarteRechercheSymbole
              progres={symbole.progres}
              resultats={symbole.resultats}
              coches={symbole.coches}
              categorie={symbole.categorie}
              onCocher={(id) => setSymbole((s) => {
                if (!s) return s
                const coches = new Set(s.coches)
                if (coches.has(id)) coches.delete(id)
                else coches.add(id)
                return { ...s, coches }
              })}
              onVoir={(r) => {
                choisir({ planId: r.planId, page: r.page })
                const o = symbole.resultats.find((x) => x.id === r.id)
                const l = (o?.largeur ?? 40) / 2, h = (o?.hauteur ?? 40) / 2
                setCible({ id: '', jeton: Date.now(), points: [{ x: r.x - l, y: r.y - h }, { x: r.x + l, y: r.y + h }] })
              }}
              onCategorie={(categorie) => setSymbole((s) => (s ? { ...s, categorie } : s))}
              onCompter={() => void compterSymbole()}
              onFermer={fermerSymbole}
            />
          )}
          {revue && (
            <CarteRevue
              element={courant}
              position={revue.index + 1}
              total={revue.elements.length}
              decision={courant ? revue.decisions[courant.id] ?? null : null}
              validees={Object.values(revue.decisions).filter((d) => d === 'validee').length}
              rejetees={Object.values(revue.decisions).filter((d) => d === 'rejetee').length}
              pret={pretPourDecider}
              onValider={() => decider('validee')}
              onRejeter={() => decider('rejetee')}
              onPrecedent={() => deplacer(-1)}
              onSuivant={() => deplacer(1)}
              onQuitter={() => setRevue(null)}
            />
          )}
        </main>

        {/* À droite : les quantités du jeu, et ce qui attend d'être validé sur la feuille. */}
        <aside className="flex w-80 shrink-0 flex-col border-l bg-muted/30 xl:w-[23rem]">
          <div className="flex shrink-0 gap-1 border-b p-2">
            <Onglet actif={onglet === 'quantites'} onClick={() => setOnglet('quantites')}>Quantités</Onglet>
            <Onglet actif={onglet === 'feuille'} onClick={() => setOnglet('feuille')}>
              Cette feuille{aValiderFeuille > 0 && <span className="ml-1 rounded-full bg-teal-100 px-1.5 text-[10px] text-teal-800">{aValiderFeuille}</span>}
            </Onglet>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-[calc(var(--safe-bottom)+0.75rem)]">
            {/* La colonne de la feuille reste montée : l'éditeur y pose ses panneaux. */}
            <div ref={setPanneauFeuille} className={cn(onglet !== 'feuille' && 'hidden')} />
            {onglet === 'quantites' && (
              <PanneauVivant
                panneau={panneau}
                jeu={jeu}
                hauteurDuDossier={hauteurDuDossier}
                diffuseur={diffuseur}
                selection={selectionPlan}
                masquees={masquees}
                classementActif={classement?.cle ?? null}
                actions={actions}
              />
            )}
          </div>
        </aside>
      </div>

      {report && (
        <ReportDossier
          dossier={[projet?.name, projet?.city].filter(Boolean).join(', ') || 'ce bâtiment'}
          resume={report.resume}
          etat={report.etat}
          erreur={report.erreur}
          onConfirmer={() => void confirmerReport()}
          onFermer={() => setReport(null)}
        />
      )}
    </div>
  )
}

/**
 * Le panneau des quantités, abonné à la forme en cours de tracé : il se
 * recalcule à chaque point visé, sans redessiner le reste de l'espace.
 */
function PanneauVivant({ panneau, jeu, hauteurDuDossier, diffuseur, selection, masquees, classementActif, actions }: {
  panneau: Panneau
  jeu: PlanPourQuantites[]
  hauteurDuDossier: number | null
  diffuseur: Diffuseur<BrouillonEditeur | null>
  selection: string | null
  masquees: ReadonlySet<CleClassification>
  classementActif: CleClassification | null
  actions: ActionsPanneau
}) {
  const brouillon = useSyncExternalStore(diffuseur.abonner, diffuseur.lire, diffuseur.lire)
  const vivant = useMemo(
    () => (brouillon ? panneauDesQuantites(jeu, { hauteurDuDossier, brouillon }) : panneau),
    [brouillon, jeu, hauteurDuDossier, panneau],
  )
  const sia = useMemo(() => surfacesSia416(entreesSia416(panneau)), [panneau])
  return (
    <PanneauQuantites
      panneau={vivant}
      sia={sia}
      selection={selection}
      masquees={masquees}
      classementActif={classementActif}
      {...actions}
    />
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
      className={cn('flex flex-1 items-center justify-center rounded-lg px-2 py-1.5 text-xs font-medium transition-colors pointer-coarse:min-h-11',
        actif ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5' : 'text-muted-foreground hover:text-foreground')}
    >
      {children}
    </button>
  )
}

function BarreDuHaut({
  nom, adresse, projectId, etat, compteurs, nombresConnus, telephone, tiroir, aValider, revueActive, exportEtat, rienAExporter,
  onTiroir, onAnalyserTout, onArreter, onRevoir, onExporter, onReporter,
}: {
  nom: string
  adresse: string
  projectId: string
  etat: EtatFile
  compteurs: { total: number; pretes: number; restantes: number; erreurs: number; aAnalyser: number }
  nombresConnus: boolean
  telephone: boolean
  tiroir: boolean
  /** Éléments à valider dans tout le jeu. */
  aValider: number
  revueActive: boolean
  exportEtat: 'repos' | 'en-cours' | 'erreur'
  rienAExporter: boolean
  onTiroir: () => void
  onAnalyserTout: () => void
  onArreter: () => void
  onRevoir: () => void
  onExporter: () => void
  onReporter: () => void
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
  // On revient d'où l'on vient : le dossier, la liste des métrés, l'accueil.
  // Ouvert directement (lien, onglet neuf), l'espace ramène à la liste des métrés.
  const navigate = useNavigate()
  const retour = () => {
    if ((window.history.state as { idx?: number } | null)?.idx) navigate(-1)
    else navigate('/app/metres')
  }
  const bouton = 'flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-40 pointer-coarse:min-h-11'

  return (
    <header className="safe-top safe-sides shrink-0 border-b bg-background">
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <button onClick={retour} className="flex shrink-0 items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:p-2.5" title="Retour">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <img src={telephone ? '/diagly-mark.svg' : '/diagly-logo.svg'} alt="Diagly" className={cn('shrink-0', telephone ? 'h-6 w-6' : 'h-6')} />
        <div className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{nom}</p>
          <p className="truncate text-xs text-muted-foreground">{adresse || 'Métrés'}</p>
        </div>

        {tiroir && (
          <button onClick={onTiroir} className={bouton}>
            <Layers className="h-4 w-4" />Feuilles
          </button>
        )}

        {/* L'avancement de l'analyse du jeu entier. */}
        <div className={cn('min-w-0 shrink-0', telephone ? 'order-last w-full' : 'w-48 xl:w-56')}>
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
                  : compteurs.aAnalyser ? `${compteurs.aAnalyser} feuille${compteurs.aAnalyser > 1 ? 's' : ''} non analysée${compteurs.aAnalyser > 1 ? 's' : ''}` : ' '}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {/* La revue : tout ce qui attend d'être validé, du moins sûr au plus sûr. */}
          {!telephone && aValider > 0 && (
            <button
              onClick={onRevoir}
              disabled={revueActive}
              className={cn(bouton, 'border-teal-300 bg-teal-50 text-teal-900 hover:bg-teal-100')}
              title="Revoir un à un tous les éléments à valider du jeu (Entrée valide, Suppr rejette)"
            >
              <ListChecks className="h-4 w-4" />Revoir ({aValider})
            </button>
          )}
          {!telephone && (
            <button onClick={onExporter} disabled={exportEtat === 'en-cours' || rienAExporter} className={bouton} title="Exporter le métré en Excel : récapitulatif, détail, SIA 416">
              {exportEtat === 'en-cours' ? <Loader2 className="h-4 w-4 animate-spin" /> : exportEtat === 'erreur' ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <FileSpreadsheet className="h-4 w-4" />}
              <span className="hidden xl:inline">Excel</span>
            </button>
          )}
          {!telephone && (
            <button onClick={onReporter} disabled={rienAExporter} className={bouton} title="Reporter au dossier : éléments comptés et quantités des ouvrages rattachés">
              <SendHorizontal className="h-4 w-4" /><span className="hidden xl:inline">Reporter au dossier</span>
            </button>
          )}
          {compteurs.restantes > 0 || etat.lot ? (
            <button onClick={onArreter} className={bouton}>
              <Square className="h-3.5 w-3.5" />Arrêter
            </button>
          ) : telephone && compteurs.aAnalyser === 0 ? null : (
            <button
              onClick={onAnalyserTout}
              disabled={compteurs.aAnalyser === 0 || !nombresConnus}
              className={cn('flex items-center gap-1.5 rounded-lg bg-foreground font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40 pointer-coarse:min-h-11',
                telephone ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-sm')}
              title={compteurs.aAnalyser ? `Analyser les ${compteurs.aAnalyser} feuilles qui ne l’ont pas été` : 'Toutes les feuilles sont analysées'}
            >
              <MarqueDiagly className="h-4 w-4 brightness-0 invert" />
              <span className={cn(!telephone && compteurs.aAnalyser === 0 && 'hidden xl:inline')}>Analyser tout</span>{compteurs.aAnalyser ? ` (${compteurs.aAnalyser})` : ''}
            </button>
          )}
          {!telephone && (
            <Link to={`/app/projects/${projectId}`} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:p-3" title="Ouvrir le dossier">
              <FolderOpen className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

/** Sur téléphone : les quantités et l'état des feuilles, et où aller pour corriger. */
function EcranTelephone({ groupes, panneau, chargement }: {
  groupes: GroupeDeFeuilles[]
  panneau: Panneau
  chargement: boolean
}) {
  const [onglet, setOnglet] = useState<'quantites' | 'feuilles'>('quantites')
  const sia = useMemo(() => surfacesSia416(entreesSia416(panneau)), [panneau])
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
            ? <PanneauQuantites panneau={panneau} sia={sia} selection={null} masquees={new Set()} classementActif={null} lectureSeule />
            : <NavigateurFeuilles groupes={groupes} selection={null} lectureSeule />}
      </div>
    </div>
  )
}
