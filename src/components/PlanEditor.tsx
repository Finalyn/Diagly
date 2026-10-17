import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { spring, projeterElan, suiviVitesse, mouvementReduit, RESSORTS, type SpringHandle } from '@/lib/motion'
import { useQueryClient } from '@tanstack/react-query'
import {
  X, Hand, MousePointer2, Crosshair, Ruler, ArrowUpRight, StickyNote, Hash, Pencil,
  ZoomIn, ZoomOut, Undo2, Redo2, Check, Trash2, Loader2, ChevronLeft, ChevronRight, Maximize, Download, Link2, Layers,
  AlertTriangle, PaintBucket, CircleDot, Tags, Scissors, ScanSearch,
} from 'lucide-react'
import { api, type CorpsMajPlan } from '@/lib/api'
import type { ApiPlan, PlanAnnotation, PlanAnnotationType, PlanPoint, TypeZoneIA } from '@/lib/api-types'
import type { PoigneeEditeur } from '@/components/metres/moteur'
import { remplacerPropositions } from '@/lib/plans/feuilles'
import { cn } from '@/lib/utils'
import { loadPdfjs } from '@/lib/pdf'
import { aireDeLaForme, airePolygone, echelleDansTable, longueurPolyligne, natureDe, natureDuTrace } from '@/lib/plan-quantites'
import { useQuery } from '@tanstack/react-query'
import { ChoixOuvrage } from '@/components/plans/ChoixOuvrage'
import { useApercusPages, useRenduPlan, type ApercuPage } from '@/components/plans/rendu'
import { useOuvragesDuProjet } from '@/components/plans/ouvrages'
import { useAnalyseIA, type ResultatAnalyse } from '@/components/plans/analyse'
import {
  AnalyseEnFond, ConfirmationEchelles, ElementsDeLAnalyse, FenetreAnalyse, ListePropositions, MarqueDiagly,
  type ReperesDeCategorie,
} from '@/components/plans/AnalyseIA'
import {
  COULEUR_PROPOSITION, COULEURS_CATEGORIE, COULEURS_PAR_TYPE, NOMS_CONFIANCE, NOMS_TYPES_ZONE, bilanDeFacade, ecartAuxCotes,
  mesureDeLaZone, nomDuRepere, validerProposition, validerRepere, type EchelleDePage,
} from '@/lib/plans/analyse-ia'
import { CATEGORIE, CLES_CATEGORIES, comptagesDuDossier, type CategorieComptee } from '@/lib/base-cfc/comptages'
import { IndexGeometrie, extraireSegments, type ListeOperateurs, type OpsPdf } from '@/lib/plans/geometrie-vectorielle'
import {
  RAISONS_REFUS, masqueDesPixels, masqueDesTraits, nomDansLaZone, remplirDepuis, textesEnCanevas,
  type ElementDeTexte, type Masque, type TexteDeLaPage,
} from '@/lib/plans/remplissage'
import { boiteDe, centreDeSurface, pointPourEtiquette } from '@/lib/plans/formes'
import { gabaritDansLeCadre, type Gabarit } from '@/lib/plans/symboles'
import { useEnregistrerComptages } from '@/components/comptages/enregistrer'
import { fr } from '@/lib/plans/echelle-exacte'

type Tool = 'pan' | 'select' | 'calibrate' | 'measure' | 'arrow' | 'note' | 'hatch' | 'draw' | 'reference' | 'fill' | 'count' | 'cut' | 'symbole'
const TARGET_W = 1600
const MIN_ZOOM = 0.05
const MAX_ZOOM = 20
const TAP_PX = 6
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#111827']
/* Fonds de scène : les gris de la charte, plus un blanc et un fond sombre pour
   les plans inversés. Le défaut n'est plus un anthracite isolé mais le gris que
   l'app emploie déjà pour ses bordures appuyées. */
const FONDS = ['#d1d1d6', '#f5f5f7', '#ffffff', '#1d1d1f']

/**
 * Arrondi des cotes, en metres.
 *
 * Une cote relevee au doigt sur un plan tombe sur 5.23 m la ou l'ouvrage mesure
 * 5.20 m : la precision affichee depasse celle du trace, et un plan rendu au
 * client ne doit pas annoncer un centimetre qu'on n'a pas mesure. Le pas arrondit
 * ce qui s'affiche ; les surfaces suivent le meme pas, en metres carres.
 */
const ARRONDIS = [
  { pas: 0, label: 'exact' },
  { pas: 0.01, label: '1 cm' },
  { pas: 0.05, label: '5 cm' },
  { pas: 0.1, label: '10 cm' },
] as const
type PasArrondi = (typeof ARRONDIS)[number]['pas']

/** Pas d'arrondi des surfaces, en mètres carrés. Imposé, voir `fmtArea`. */
const PAS_SURFACE = 0.5

/** Arrondit au pas demande. Un pas nul laisse la valeur intacte. */
function auPas(v: number, pas: number): number {
  return pas > 0 ? Math.round(v / pas) * pas : v
}

let _c = 0
const uid = () => `a${Date.now()}_${_c++}`
const dist = (a: PlanPoint, b: PlanPoint) => Math.hypot(b.x - a.x, b.y - a.y)
const mid = (a: PlanPoint, b: PlanPoint) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
/** Distance d'un point au segment [a,b] (pour sélectionner une annotation). */
function pointSegDist(p: PlanPoint, a: PlanPoint, b: PlanPoint) {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
function pointInPoly(p: PlanPoint, pts: PlanPoint[]) {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if (((pts[i].y > p.y) !== (pts[j].y > p.y)) && (p.x < ((pts[j].x - pts[i].x) * (p.y - pts[i].y)) / (pts[j].y - pts[i].y) + pts[i].x)) inside = !inside
  }
  return inside
}

/**
 * Les outils, avec leur touche. Une seule action par touche, comme le veulent
 * les métreurs habitués à Togal ou Bluebeam : V la sélection, A la surface,
 * L la longueur, C le comptage, F le remplissage d'une pièce, et Espace
 * maintenu pour déplacer le plan sans quitter l'outil en cours.
 */
const TOOLS: { key: Tool; icon: typeof Ruler; label: string; touche?: string }[] = [
  { key: 'pan', icon: Hand, label: 'Déplacer', touche: 'Espace' },
  { key: 'select', icon: MousePointer2, label: 'Sélection', touche: 'V' },
  { key: 'calibrate', icon: Crosshair, label: 'Étalonner' },
  { key: 'hatch', icon: Hash, label: 'Zone', touche: 'A' },
  { key: 'fill', icon: PaintBucket, label: 'Remplir', touche: 'F' },
  { key: 'measure', icon: Ruler, label: 'Mesurer', touche: 'L' },
  { key: 'count', icon: CircleDot, label: 'Compter', touche: 'C' },
  { key: 'cut', icon: Scissors, label: 'Découper', touche: 'X' },
  // Seulement dans les Métrés : la recherche parcourt tout le jeu de plans.
  { key: 'symbole', icon: ScanSearch, label: 'Symbole' },
  { key: 'draw', icon: Pencil, label: 'Dessiner' },
  { key: 'arrow', icon: ArrowUpRight, label: 'Flèche' },
  { key: 'note', icon: StickyNote, label: 'Note' },
  { key: 'reference', icon: Layers, label: 'Référence' },
]

/** Les touches des outils, en minuscules. */
const TOUCHES: Record<string, Tool> = { v: 'select', a: 'hatch', l: 'measure', c: 'count', f: 'fill', x: 'cut' }

/** Deux touchers plus rapprochés que cela, dans le temps et à l'écran, font un double toucher. */
const DOUBLE_TOUCHER_MS = 320
const DOUBLE_TOUCHER_PX = 24

/**
 * Le point visé, contraint à l'horizontale, à la verticale ou à 45° depuis
 * l'ancre quand Maj est enfoncée : un mur droit se trace droit, même au doigt.
 */
function contraindre(ancre: PlanPoint | null | undefined, p: PlanPoint, actif: boolean): PlanPoint {
  if (!actif || !ancre) return p
  const dx = p.x - ancre.x, dy = p.y - ancre.y
  if (!dx && !dy) return p
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const k = dx * Math.cos(angle) + dy * Math.sin(angle)
  return { x: ancre.x + k * Math.cos(angle), y: ancre.y + k * Math.sin(angle) }
}

/** Retire les points posés deux fois au même endroit : un double-clic pose deux sommets avant de terminer. */
function sansDoublons(pts: PlanPoint[], ecart: number): PlanPoint[] {
  return pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > ecart)
}

/** Le point à mi-longueur d'une polyligne : là où s'écrit sa mesure. */
function milieuDeLaLigne(pts: PlanPoint[]): PlanPoint {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
  const moitie = longueurPolyligne(pts) / 2
  let parcouru = 0
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i])
    if (parcouru + l >= moitie && l > 0) {
      const t = (moitie - parcouru) / l
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }
    }
    parcouru += l
  }
  return pts[pts.length - 1]
}

/** Teintes du calque de référence : claires, pour que les traits restent noirs. */
const TEINTES: { valeur: string | null; nom: string }[] = [
  { valeur: null, nom: 'Aucune' },
  { valeur: '#dbeafe', nom: 'Bleu' },
  { valeur: '#fee2e2', nom: 'Rouge' },
  { valeur: '#dcfce7', nom: 'Vert' },
]

const HINTS: Record<Tool, string> = {
  pan: 'Glisse pour déplacer le plan, molette/pincer pour zoomer.',
  select: 'Touche une forme pour la sélectionner : glisse-la ou ses poignées, tire le point milieu d’un côté pour ajouter un sommet, double-clic sur un sommet pour le retirer. Suppr efface.',
  calibrate: 'Trace un trait sur une distance connue (glisse), puis saisis sa longueur réelle.',
  measure: 'Glisse pour une cote, ou touche chaque point d’une longueur puis Entrée ou double-clic. Maj : 0, 45 ou 90°.',
  arrow: 'Glisse pour tracer une flèche.',
  note: 'Touche le plan pour poser une note.',
  hatch: 'Glisse pour un rectangle, ou touche chaque sommet puis Entrée ou double-clic. Maj : 0, 45 ou 90°.',
  fill: 'Touche l’intérieur d’une pièce fermée : la zone suit les traits du plan.',
  count: 'Touche chaque élément à compter : un repère par toucher, dans la catégorie choisie.',
  cut: 'Trace la découpe dans une zone (glisse pour un rectangle, ou touche chaque sommet) : sa surface est retirée.',
  symbole: 'Encadre un symbole (glisse) : il sera cherché sur toutes les feuilles vectorielles du jeu.',
  draw: 'Dessine à main levée en gardant le doigt / la souris appuyé.',
  reference: 'Pose un autre plan du dossier en transparence, puis glisse pour le recaler sur celui-ci.',
}

/** Nom lisible d'une annotation, pour l'entête du panneau de sélection. */
const NOMS: Record<PlanAnnotationType, string> = {
  measure: 'Cote', hatch: 'Zone', note: 'Note', arrow: 'Flèche', draw: 'Croquis',
  reference: 'Référence',
  repere: 'Repère',
  // Le calque et la table d'échelles ne sont pas des tracés : ces noms ne servent
  // qu'aux panneaux, jamais à un libellé posé sur le plan.
  pages: 'Échelles par page',
}

/**
 * L'evenement vient-il d'un element pose PAR-DESSUS la scene ?
 *
 * Le panneau de selection et le bouton « Fermer la zone » flottent a l'interieur
 * du conteneur qui porte les gestes : sans ce garde-fou, appuyer sur « Supprimer »
 * ou sur « Rattacher a un ouvrage » commencait par un appui sur le plan, qui ne
 * touchait aucune annotation et deselectionnait donc tout. Le panneau disparaissait
 * avant que le clic n'arrive sur son bouton.
 *
 * Le test ne gene pas un geste legitime : le conteneur capture le pointeur des
 * l'appui, et les evenements d'un pointeur capture sont adresses a l'element qui
 * capture, jamais a ce qui passe dessous.
 */
function surHabillage(e: React.PointerEvent): boolean {
  const cible = e.target as HTMLElement | null
  return !!cible?.closest?.('[data-habillage]')
}

/**
 * Une zone proposée qu'on déplace à la main quitte les traits du dessin : elle
 * n'est plus « aimantée », et sa mesure ne s'affiche plus au centième.
 */
function retouchee(a: PlanAnnotation): Partial<PlanAnnotation> {
  return a.proposition?.aimantee ? { proposition: { ...a.proposition, aimantee: false } } : {}
}

interface View { zoom: number; tx: number; ty: number }

/** Ce que la dernière analyse a dit de la page : écartées, remarques, totaux comptés. */
export type SuiteAnalyse = Pick<ResultatAnalyse, 'ecartees' | 'remarques' | 'tronque' | 'pagesSansGeometrie' | 'comptages'>

/**
 * L'éditeur encastré dans l'espace de travail des Métrés.
 *
 * Plein écran dans le dossier, l'éditeur se pose ici au centre, entre le
 * navigateur des feuilles et le panneau de droite : c'est le navigateur qui
 * choisit la page, l'analyse tourne dans la file du jeu entier et non depuis
 * l'éditeur, et les panneaux de la feuille (zones à valider, éléments
 * comptés, mesures) rejoignent la colonne de droite au lieu de flotter sur
 * le plan. Sans encastrement, rien ne change.
 */
export interface EncastrementEditeur {
  /** La page affichée, choisie dans le navigateur des feuilles. */
  page: number
  /** L'éditeur voudrait une autre page (« sur les autres pages ») : le navigateur décide. */
  onPage: (page: number) => void
  /** Le nom de la feuille, à la place du nom du fichier. */
  titre: string
  /** Enregistre le plan après les écritures de la file sur le même document. */
  enregistrer: (corps: CorpsMajPlan) => Promise<unknown>
  /** Où poser les panneaux de la feuille ; null tant que la colonne n'est pas montée. */
  panneau: HTMLElement | null
  /** Ce que la dernière analyse a dit de cette page. */
  suite: SuiteAnalyse | null
  /** Les échelles proposées par l'analyse pour les pages de ce plan, en attente de confirmation. */
  echellesProposees: EchelleDePage[]
  /** L'éditeur se déclare à la file d'analyse, qui lui remet les propositions de son plan. */
  definirPoignee: (p: PoigneeEditeur | null) => void
  /** Les annotations et échelles à jour, pour le récapitulatif du jeu. */
  onEtat?: (etat: { planId: string; annotations: PlanAnnotation[]; echelles: Record<string, number>; scale: number | null }) => void
  /** La forme en cours de tracé : le panneau des quantités la compte déjà. */
  onBrouillon?: (b: BrouillonEditeur | null) => void
  /** La forme sélectionnée sur le plan : le panneau éclaire sa ligne. */
  onSelection?: (id: string | null) => void
  /**
   * Une forme à montrer : l'éditeur la sélectionne et centre la vue dessus.
   * Le jeton change à chaque demande, même pour la même forme. Sans forme
   * (une occurrence de symbole), `points` dit seulement où cadrer.
   */
  cible?: { id: string; jeton: number; points?: PlanPoint[] } | null
  /** Les formes d'une classification masquée dans le panneau ne se dessinent pas. */
  masquee?: (a: PlanAnnotation) => boolean
  /**
   * « Dessiner dans » une classification du panneau : la prochaine forme en
   * prend le type et la couleur, avec l'outil qui lui convient.
   */
  classement?: ClassementActif | null
  /** Quitter le dessin dans une classification. */
  onFinClassement?: () => void
  /** La revue des éléments à valider tient le clavier et la carte de la forme. */
  revue?: boolean
  /** Un symbole encadré, à chercher sur tout le jeu ; sans ce rappel, l'outil n'est pas proposé. */
  onSymbole?: (s: { planId: string; page: number; gabarit: Gabarit }) => void
  /** Les occurrences d'un symbole sur cette page, encadrées sur le plan. */
  marques?: { id: string; x: number; y: number; largeur: number; hauteur: number; actif: boolean }[]
}

/** La classification dans laquelle on dessine, depuis le panneau des quantités. */
export interface ClassementActif {
  libelle: string
  couleur: string
  outil: 'surface' | 'longueur' | 'comptage'
  /** Le type que prend la forme ; null pour une mesure libre. */
  typeZone: TypeZoneIA | null
  /** Pour un comptage : la catégorie des repères posés. */
  categorie?: CategorieComptee
  jeton: number
}

/** La forme en cours de tracé, telle que le panneau des quantités la compte. */
export interface BrouillonEditeur {
  planId: string
  page: number
  nature: 'surface' | 'longueur'
  points: PlanPoint[]
  typeZone: TypeZoneIA | null
}

/** Ce que l'éditeur garde de la page affichée pour le remplissage d'un clic. */
interface PageDuPdf {
  numero: number
  page: {
    getOperatorList: () => Promise<ListeOperateurs>
    getTextContent: () => Promise<{ items: unknown[] }>
  }
  transform: number[]
}

export function PlanEditor({ plan, onClose, encastre }: { plan: ApiPlan; onClose?: () => void; encastre?: EncastrementEditeur }) {
  const queryClient = useQueryClient()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const railRef = useRef<HTMLElement>(null)

  const [stage, setStage] = useState({ w: 0, h: 0 })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [tool, setTool] = useState<Tool>('pan')
  const [color, setColor] = useState(COLORS[0])
  const [unit, setUnit] = useState<'m' | 'cm' | 'mm'>('m')
  const [view, setView] = useState<View>({ zoom: 1, tx: 0, ty: 0 })
  // Miroir synchrone de la vue : les gestes ont besoin de la valeur affichée à
  // l'instant même, pas de celle du rendu précédent.
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  // Un ressort par axe : un seul ressort sur la distance se désynchronise dès que
  // les deux axes n'ont pas la même vitesse.
  const elan = useRef<{ x: SpringHandle | null; y: SpringHandle | null }>({ x: null, y: null })
  const vitX = useRef(suiviVitesse())
  const vitY = useRef(suiviVitesse())
  const stopElan = () => { elan.current.x?.stop(); elan.current.y?.stop(); elan.current = { x: null, y: null } }
  useEffect(() => stopElan, [])
  const [scale, setScale] = useState<number | null>(plan.scalePxPerM)
  /** Échelles propres aux pages d'un PDF, quand les feuilles diffèrent de format. */
  const [echelles, setEchelles] = useState<Record<string, number>>(
    () => plan.annotations?.find((a) => a.type === 'pages')?.pageScales ?? {},
  )
  const isPdf = plan.mimeType === 'application/pdf'
  const [annotations, setAnnotations] = useState<PlanAnnotation[]>(
    () => (plan.annotations ?? []).filter((a) => a.type !== 'pages'),
  )
  const [pending, setPending] = useState<PlanPoint | null>(null)
  const [draft, setDraft] = useState<PlanPoint[]>([])
  const [cursor, setCursor] = useState<PlanPoint | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  // Encastré, la page vient du navigateur des feuilles ; seul, l'éditeur la tient.
  const [pageInterne, setPageInterne] = useState(1)
  const pageNum = encastre ? encastre.page : pageInterne
  const encastreRef = useRef(encastre)
  useEffect(() => { encastreRef.current = encastre })
  const allerPage = (n: number) => {
    if (encastreRef.current) encastreRef.current.onPage(n)
    else setPageInterne(n)
  }
  const [numPages, setNumPages] = useState(1)
  const [calibrateSeg, setCalibrateSeg] = useState<[PlanPoint, PlanPoint] | null>(null)
  const [calibrateVal, setCalibrateVal] = useState('')
  /**
   * Unité de la cote saisie à l'étalonnage.
   *
   * Un plan se cote en mètres, mais un détail se cote en centimètres et une
   * menuiserie en millimètres. Imposer le mètre obligeait à convertir de tête
   * — 1250 mm saisis en « 1.25 » — et une virgule oubliée fausse tout le plan.
   */
  const [calibrateUnite, setCalibrateUnite] = useState<'m' | 'cm' | 'mm'>('m')
  const [notePoint, setNotePoint] = useState<PlanPoint | null>(null)
  const [noteVal, setNoteVal] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [bgColor, setBgColor] = useState(FONDS[0])
  const [selectedAnn, setSelectedAnn] = useState<string | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [choixOuvrage, setChoixOuvrage] = useState(false)
  /** Fenêtre de l'analyse par l'IA, et ce que l'analyse a proposé d'échelles et dit en passant. */
  const [analyseOuverte, setAnalyseOuverte] = useState(false)
  const [echellesProposees, setEchellesProposees] = useState<EchelleDePage[] | null>(null)
  const [suiteAnalyse, setSuiteAnalyse] = useState<Pick<ResultatAnalyse, 'ecartees' | 'remarques' | 'tronque' | 'pagesSansGeometrie' | 'comptages'> | null>(null)
  /** Étalonnage mesuré, en attente du choix des pages auxquelles il s'applique. */
  const [echelleEnAttente, setEchelleEnAttente] = useState<number | null>(null)
  const [pagesRetenues, setPagesRetenues] = useState<number[]>([])
  const [arrondi, setArrondi] = useState<PasArrondi>(0)
  /**
   * Les deux piles de l'historique : ce que Ctrl+Z ramène, ce que Ctrl+Maj+Z rejoue.
   *
   * On retient l'état entier des annotations avant chaque modification, plutôt
   * que de simplement retirer le dernier tracé : recolorer une zone, la
   * déplacer ou la rattacher à un ouvrage sont des gestes qu'on veut pouvoir
   * reprendre, pas seulement la création.
   */
  const [passe, setPasse] = useState<PlanAnnotation[][]>([])
  const [futur, setFutur] = useState<PlanAnnotation[][]>([])

  /** La catégorie des repères que pose l'outil Compter. */
  const [categorieComptage, setCategorieComptage] = useState<CategorieComptee>('porte_interieure')
  /** Nom et quantité écrits au centre de chaque zone validée. */
  const [etiquettes, setEtiquettes] = useState(true)
  /** Un message bref posé sur la scène : un remplissage refusé, par exemple. */
  const [avisScene, setAvisScene] = useState<string | null>(null)
  const avisMinuterie = useRef<ReturnType<typeof setTimeout> | null>(null)
  const montrerAvis = (texte: string) => {
    setAvisScene(texte)
    if (avisMinuterie.current) clearTimeout(avisMinuterie.current)
    avisMinuterie.current = setTimeout(() => setAvisScene(null), 4500)
  }
  useEffect(() => () => { if (avisMinuterie.current) clearTimeout(avisMinuterie.current) }, [])
  const [remplissageEnCours, setRemplissageEnCours] = useState(false)
  /** Espace maintenu : le plan se déplace, quel que soit l'outil. */
  const [espace, setEspace] = useState(false)
  const espaceRef = useRef(false)
  /** Maj maintenue : les tracés suivent 0, 45 ou 90°. */
  const [maj, setMaj] = useState(false)
  /** La page du PDF affichée, pour en lire les traits et les textes au premier remplissage. */
  const pageDuPdf = useRef<PageDuPdf | null>(null)
  const geometrieRemplissage = useRef<{ numero: number; masque: Masque; index: IndexGeometrie | null; textes: TexteDeLaPage[] } | null>(null)
  /** Le dernier toucher, pour reconnaître un double toucher sur iPad. */
  const dernierToucher = useRef<{ t: number; x: number; y: number } | null>(null)

  /**
   * Calque de référence : un autre plan du dossier, posé par-dessus celui-ci.
   *
   * Comparer un état existant et un projet demandait jusqu'ici d'ouvrir deux
   * onglets et de faire l'aller-retour de mémoire. Le calque se range avec les
   * annotations : on le retrouve recalé en rouvrant le plan.
   */
  const reference = annotations.find((a) => a.type === 'reference') ?? null
  const plansDuDossier = useQuery({
    queryKey: ['plans', plan.projectId],
    queryFn: () => api.plans.list(plan.projectId),
  })
  const autresPlans = (plansDuDossier.data?.plans ?? []).filter((x) => x.id !== plan.id)
  const planReference = autresPlans.find((x) => x.id === reference?.planId) ?? null
  const renduReference = useRenduPlan(planReference, 1600, reference?.planPage ?? 1)
  /** Pages du document posé en référence, pour pouvoir choisir laquelle comparer. */
  const apercusReference = useApercusPages(planReference, tool === 'reference')
  // Les vignettes servent à naviguer dans un document de plusieurs feuilles, et
  // à choisir à quelles pages s'applique un étalonnage.
  const apercus = useApercusPages(plan, isPdf && numPages > 1)

  const poserReference = (planId: string) => {
    retenir()
    setAnnotations((l) => {
      const sansAncien = l.filter((a) => a.type !== 'reference')
      return [...sansAncien, {
        id: uid(), type: 'reference', planId,
        points: [{ x: 0, y: 0 }], planPage: 1, opacity: 0.5, scale: 1, tint: null,
      }]
    })
    setDirty(true)
  }
  const majReference = (patch: Partial<PlanAnnotation>) => {
    if (!reference) return
    retenir()
    setAnnotations((l) => l.map((a) => (a.id === reference.id ? { ...a, ...patch } : a)))
    setDirty(true)
  }
  const retirerReference = () => {
    retenir()
    setAnnotations((l) => l.filter((a) => a.type !== 'reference'))
    setDirty(true)
  }


  // ---- Chargement (image ou PDF -> canvas) ----
  useEffect(() => {
    let cancelled = false
    setLoading(true); setLoadError(null)
    const url = api.plans.fileUrl(plan)
    ;(async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      if (isPdf) {
        const buf = await (await fetch(url)).arrayBuffer()
        if (cancelled) return
        const pdfjsLib = await loadPdfjs()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        if (cancelled) return
        setNumPages(pdf.numPages)
        const page = await pdf.getPage(pageNum)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: TARGET_W / base.width })
        canvas.width = viewport.width; canvas.height = viewport.height
        await page.render({ canvasContext: ctx, viewport }).promise
        if (cancelled) return
        // Les traits et les textes de la page ne se lisent qu'au premier remplissage.
        pageDuPdf.current = { numero: pageNum, page: page as unknown as PageDuPdf['page'], transform: viewport.transform }
        geometrieRemplissage.current = null
        setStage({ w: viewport.width, h: viewport.height })
      } else {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('img')); img.src = url })
        if (cancelled) return
        const s = Math.min(1, TARGET_W / img.width)
        const w = Math.round(img.width * s), h = Math.round(img.height * s)
        canvas.width = w; canvas.height = h
        ctx.drawImage(img, 0, 0, w, h)
        pageDuPdf.current = null
        geometrieRemplissage.current = null
        setStage({ w, h })
      }
      setLoading(false)
    })().catch((e) => { if (!cancelled) { setLoadError(e?.message ?? 'Erreur de rendu'); setLoading(false) } })
    return () => { cancelled = true }
    // Le rendu ne dépend que du plan affiché et de la page : l'URL signée du fichier
    // est renouvelée à chaque rafraîchissement de la liste, sans que le contenu change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, isPdf, pageNum])

  // ---- Ajuster le plan à l'écran ----
  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || !stage.w) return
    const r = el.getBoundingClientRect()
    const z = Math.min(r.width / stage.w, r.height / stage.h) * 0.95
    setView({ zoom: z, tx: (r.width - stage.w * z) / 2, ty: (r.height - stage.h * z) / 2 })
  }, [stage.w, stage.h])

  useEffect(() => { fitView() }, [fitView])

  // ---- Conversions écran <-> plan ----
  const toStage = useCallback((clientX: number, clientY: number): PlanPoint => {
    const r = containerRef.current!.getBoundingClientRect()
    return { x: (clientX - r.left - view.tx) / view.zoom, y: (clientY - r.top - view.ty) / view.zoom }
  }, [view])

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const z = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM)
      const k = z / v.zoom
      return { zoom: z, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k }
    })
  }, [])

  const zoomButton = (factor: number) => {
    const el = containerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    zoomAt(factor, r.width / 2, r.height / 2)
  }

  // ---- Gestion des pointeurs (pan / pinch / dessin) ----
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map())
  const gesture = useRef<{ mode: 'none' | 'pan' | 'pinch' | 'segment' | 'draw' | 'hatch' | 'dragAnn' | 'dragPoint'; startX: number; startY: number; moved: boolean; lastDist: number; lastMidX: number; lastMidY: number }>(
    { mode: 'none', startX: 0, startY: 0, moved: false, lastDist: 0, lastMidX: 0, lastMidY: 0 },
  )
  const dragRef = useRef<{ id: string; lastX: number; lastY: number; pointIndex?: number } | null>(null)
  /**
   * L'état d'avant le déplacement en cours : un glissement n'entre dans
   * l'historique qu'au relâchement, et pas à chaque pixel parcouru.
   */
  const avantGeste = useRef<PlanAnnotation[] | null>(null)

  /** À appeler juste avant de toucher aux annotations. */
  const retenir = useCallback((etat: PlanAnnotation[] = annotations) => {
    setPasse((l) => [...l.slice(-49), etat])
    setFutur([])
  }, [annotations])

  const addAnn = (a: Omit<PlanAnnotation, 'id'>) => {
    retenir()
    const id = uid()
    setAnnotations((l) => [...l, { id, page: isPdf ? pageNum : undefined, ...a }])
    setDirty(true)
    return id
  }

  /** Le type d'une forme dessinée « dans » une classification du panneau des quantités. */
  const classementDuTrace = (): Partial<PlanAnnotation> => {
    const c = encastreRef.current?.classement
    return c?.typeZone ? { typeZone: c.typeZone, origine: 'main' } : {}
  }
  const classementActif = encastre?.classement ?? null
  const couleurDuTrace = classementActif && classementActif.outil !== 'comptage' ? classementActif.couleur : color

  /**
   * Une zone tout juste fermée demande aussitôt à quel ouvrage elle se rapporte.
   *
   * Une zone qui ne se rapporte à rien ne fait que décorer le plan. La question
   * se pose quand on vient de la tracer, pas plus tard, quand on ne sait plus
   * laquelle mesurait quoi. Dans les Métrés, on enchaîne les pièces d'une
   * feuille : la question attendrait à chaque zone, et le rattachement se fait
   * depuis la sélection.
   */
  const poserZone = (points: PlanPoint[]) => {
    const id = addAnn({ type: 'hatch', points, color: couleurDuTrace, ...classementDuTrace() })
    setSelectedAnn(id)
    if (!encastre) setChoixOuvrage(true)
  }
  /**
   * Une découpe : le contour tracé se retire de la zone qui le contient, la
   * sélectionnée si elle le contient, sinon la plus petite de la page. Une
   * trémie dans une dalle, un poteau dans une pièce : la surface nette suit.
   */
  const decouper = (points: PlanPoint[]) => {
    const c = centreDeSurface(points)
    const dans = annotationsVisibles
      .filter((a) => a.type === 'hatch' && !a.proposition && pointInPoly(c, a.points) && !(a.trous ?? []).some((t) => pointInPoly(c, t)))
      .sort((x, y) => airePolygone(x.points) - airePolygone(y.points))
    const zone = dans.find((a) => a.id === selectedAnn) ?? dans[0]
    if (!zone) { montrerAvis('Tracez la découpe à l’intérieur d’une zone validée.'); return }
    retenir()
    // Découpée à la main, la surface n'est plus seulement celle du dessin.
    setAnnotations((l) => l.map((a) => (a.id === zone.id ? { ...a, trous: [...(a.trous ?? []), points], mesureExacte: false } : a)))
    setDirty(true)
    setSelectedAnn(zone.id)
  }
  /** Le cadre tracé autour d'un symbole : ses traits deviennent le gabarit cherché sur tout le jeu. */
  const encadrerSymbole = async (a: PlanPoint, b: PlanPoint) => {
    const g = await geometriePourRemplir()
    if (!g?.index) { montrerAvis('La recherche de symbole demande un PDF vectoriel : cette feuille n’a pas de traits lisibles.'); return }
    const cadre = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), largeur: Math.abs(b.x - a.x), hauteur: Math.abs(b.y - a.y) }
    const gabarit = gabaritDansLeCadre(g.index.geo, cadre)
    if (!gabarit) { montrerAvis('Encadrez un seul symbole : ses traits doivent tenir entièrement dans le cadre.'); return }
    encastreRef.current?.onSymbole?.({ planId: plan.id, page: pageNum, gabarit })
  }

  /** Un contour fermé : une zone, ou une découpe avec l'outil Découper. */
  const fermerContour = (points: PlanPoint[]) => {
    if (tool === 'cut') decouper(points)
    else poserZone(points)
  }

  /** Une longueur tracée point par point : un mur, une plinthe, un linéaire de façade. */
  const poserLongueur = (points: PlanPoint[]) => {
    addAnn({ type: 'measure', points, color: couleurDuTrace, ...classementDuTrace() })
  }

  /** Un repère de comptage, numéroté à la suite des autres de sa catégorie sur la page. */
  const poserRepere = (sp: PlanPoint) => {
    const categorie = (classementActif?.outil === 'comptage' ? classementActif.categorie : null) ?? categorieComptage
    const numeros = annotationsPage.filter((a) => a.repere?.categorie === categorie).map((a) => a.repere!.numero)
    addAnn({
      type: 'repere', points: [sp], color: COULEURS_CATEGORIE[categorie],
      repere: { categorie, numero: Math.max(0, ...numeros) + 1 }, origine: 'main',
    })
  }

  /**
   * Les traits de la page pour le remplissage, lus une fois par page : la
   * géométrie vectorielle avec ses courbes aplaties (l'arc d'une porte ferme
   * la pièce) et ses textes, qui nomment la pièce remplie. Un scan ou une
   * image n'ont pas de traits : ce sont alors leurs pixels sombres.
   */
  const geometriePourRemplir = async () => {
    const deja = geometrieRemplissage.current
    if (deja && deja.numero === pageNum) return deja
    let r: typeof deja = null
    const p = pageDuPdf.current
    if (isPdf && p && p.numero === pageNum) {
      try {
        const pdfjsLib = await loadPdfjs()
        const liste = await p.page.getOperatorList()
        const geo = extraireSegments(liste, pdfjsLib.OPS as unknown as OpsPdf, p.transform, undefined, { courbes: true })
        if (geo.nombre > 0) {
          let textes: TexteDeLaPage[] = []
          try { textes = textesEnCanevas((await p.page.getTextContent()).items as ElementDeTexte[], p.transform) } catch { textes = [] }
          r = { numero: pageNum, masque: masqueDesTraits(geo.segments, geo.nombre, stage.w, stage.h), index: new IndexGeometrie(geo), textes }
        }
      } catch {
        r = null
      }
    }
    if (!r) {
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return null
      try {
        const img = ctx.getImageData(0, 0, c.width, c.height)
        r = { numero: pageNum, masque: masqueDesPixels(img.data, c.width, c.height), index: null, textes: [] }
      } catch {
        return null
      }
    }
    geometrieRemplissage.current = r
    return r
  }

  /** Remplir d'un clic la pièce autour du point touché. */
  const remplir = async (sp: PlanPoint) => {
    if (remplissageEnCours) return
    setRemplissageEnCours(true)
    try {
      const g = await geometriePourRemplir()
      if (!g) { montrerAvis('Le remplissage n’est pas possible sur ce document.'); return }
      const r = remplirDepuis(g.masque, sp, g.index)
      if (!r.ok) { montrerAvis(RAISONS_REFUS[r.raison]); return }
      const nom = nomDansLaZone(g.textes, r.points)
      const c = encastreRef.current?.classement
      const type = c && c.outil !== 'comptage' && c.typeZone ? { typeZone: c.typeZone } : {}
      const avant = annotationsActuelles.current
      retenir(avant)
      const id = uid()
      setAnnotations((l) => [...l, {
        id, type: 'hatch', points: r.points, page: isPdf ? pageNum : undefined,
        color: c && c.outil !== 'comptage' ? c.couleur : color, origine: 'remplissage', ...type,
        ...(nom ? { text: nom } : {}),
        // Accrochée aux traits du dessin, sa surface est celle du plan : au centième.
        ...(r.aimantee ? { mesureExacte: true } : {}),
      }])
      setDirty(true)
      setSelectedAnn(id)
    } finally {
      setRemplissageEnCours(false)
    }
  }

  /** Termine le tracé en cours, au clavier (Entrée) ou au double-clic. Rend vrai s'il y en avait un. */
  const terminerTrace = (): boolean => {
    const pts = sansDoublons(draft, 3 / viewRef.current.zoom)
    if ((tool === 'hatch' || tool === 'cut') && pts.length >= 3) { fermerContour(pts); setDraft([]); return true }
    if (tool === 'measure' && pts.length >= 2) { poserLongueur(pts); setDraft([]); return true }
    return false
  }

  /** Retire un sommet de la forme sélectionnée, s'il en reste assez pour qu'elle mesure encore. */
  const retirerSommet = (sp: PlanPoint, tol: number): boolean => {
    const a = annotations.find((x) => x.id === selectedAnn)
    if (!a || (a.type !== 'hatch' && a.type !== 'measure')) return false
    const idx = a.points.findIndex((p) => dist(sp, p) < tol)
    if (idx < 0 || a.points.length <= (a.type === 'hatch' ? 3 : 2)) return false
    retenir()
    setAnnotations((l) => l.map((x) => (x.id === a.id
      ? { ...x, points: x.points.filter((_, i) => i !== idx), ...retouchee(x), ...(x.mesureExacte ? { mesureExacte: false } : {}) }
      : x)))
    setDirty(true)
    return true
  }

  /** Double-clic : termine un tracé, ou retire le sommet visé de la forme sélectionnée. */
  const surDoubleClic = (sp: PlanPoint, tol: number) => {
    if (tool === 'hatch' || tool === 'cut' || tool === 'measure') { terminerTrace(); return }
    if (tool === 'select') retirerSommet(sp, tol)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (calibrateSeg || notePoint || surHabillage(e)) return
    // Le plan est peut-être encore en train de glisser : on le rattrape là où il est
    // affiché, sans attendre la fin de sa course. C'est ce qui distingue un mouvement
    // qu'on peut reprendre d'une animation qu'on subit.
    stopElan()
    vitX.current.reset()
    vitY.current.reset()
    const el = containerRef.current!
    el.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (e.shiftKey !== maj) setMaj(e.shiftKey)

    // Bouton du milieu (molette) maintenu = déplacer, quel que soit l'outil.
    if (e.button === 1) {
      e.preventDefault()
      gesture.current = { mode: 'pan', startX: e.clientX, startY: e.clientY, moved: false, lastDist: 0, lastMidX: 0, lastMidY: 0 }
      return
    }

    const n = ptrs.current.size

    if (n === 2) {
      const [a, b] = [...ptrs.current.values()]
      gesture.current.mode = 'pinch'
      gesture.current.lastDist = Math.hypot(a.x - b.x, a.y - b.y)
      gesture.current.lastMidX = (a.x + b.x) / 2
      gesture.current.lastMidY = (a.y + b.y) / 2
      setPending(null)
      return
    }
    if (n !== 1) return

    gesture.current.startX = e.clientX
    gesture.current.startY = e.clientY
    gesture.current.moved = false
    const sp = toStage(e.clientX, e.clientY)
    // Au doigt, on vise moins juste qu'à la souris : les poignées se prennent de plus loin.
    const tol = (e.pointerType === 'touch' ? 22 : 12) / view.zoom

    if (tool === 'pan' || espaceRef.current) { gesture.current.mode = 'pan' }
    else if (tool === 'select') {
      // 1. Poignée de l'annotation déjà sélectionnée -> déplace ce point seul.
      if (selectedAnn) {
        const a = annotations.find((x) => x.id === selectedAnn)
        const idx = a ? a.points.findIndex((p) => dist(sp, p) < tol) : -1
        if (a && idx >= 0) { avantGeste.current = annotations; dragRef.current = { id: a.id, lastX: sp.x, lastY: sp.y, pointIndex: idx }; gesture.current.mode = 'dragPoint'; return }
        // 1 bis. Point milieu d'un côté -> un nouveau sommet, qu'on tire aussitôt.
        if (a && (a.type === 'hatch' || a.type === 'measure')) {
          const nb = a.points.length
          const cotes = a.type === 'hatch' ? nb : nb - 1
          for (let i = 0; i < cotes; i++) {
            const m = mid(a.points[i], a.points[(i + 1) % nb])
            if (dist(sp, m) >= tol * 0.8) continue
            retenir(annotations)
            setAnnotations((l) => l.map((x) => (x.id === a.id
              ? { ...x, points: [...x.points.slice(0, i + 1), m, ...x.points.slice(i + 1)], ...retouchee(x), ...(x.mesureExacte ? { mesureExacte: false } : {}) }
              : x)))
            setDirty(true)
            // L'historique a déjà retenu l'état d'avant l'ajout : le glissement qui suit en fait partie.
            avantGeste.current = null
            dragRef.current = { id: a.id, lastX: sp.x, lastY: sp.y, pointIndex: i + 1 }
            gesture.current.mode = 'dragPoint'
            return
          }
        }
      }
      // 2. Sinon, sélectionne l'annotation touchée -> déplace l'ensemble ; si rien, on déplace le plan.
      let hitId: string | null = null
      for (let i = annotationsVisibles.length - 1; i >= 0 && !hitId; i--) {
        const a = annotationsVisibles[i]
        if (a.type === 'note' || a.type === 'repere') { if (dist(sp, a.points[0]) < tol * 2) hitId = a.id }
        else if (a.type === 'arrow') { if (pointSegDist(sp, a.points[0], a.points[1]) < tol) hitId = a.id }
        else if (a.type === 'measure' || a.type === 'draw') { for (let j = 0; j < a.points.length - 1 && !hitId; j++) if (pointSegDist(sp, a.points[j], a.points[j + 1]) < tol) hitId = a.id }
        else if (a.type === 'hatch') { if (pointInPoly(sp, a.points) && !(a.trous ?? []).some((t) => pointInPoly(sp, t))) hitId = a.id; else for (let j = 0; j < a.points.length && !hitId; j++) if (pointSegDist(sp, a.points[j], a.points[(j + 1) % a.points.length]) < tol) hitId = a.id }
      }
      if (hitId) { setSelectedAnn(hitId); avantGeste.current = annotations; dragRef.current = { id: hitId, lastX: sp.x, lastY: sp.y }; gesture.current.mode = 'dragAnn' }
      else { setSelectedAnn(null); gesture.current.mode = 'pan' }
    }
    else if (tool === 'reference') {
      // Le calque se déplace comme une annotation : il n'a qu'un point, son coin.
      if (reference) { avantGeste.current = annotations; dragRef.current = { id: reference.id, lastX: sp.x, lastY: sp.y }; gesture.current.mode = 'dragAnn' }
      else gesture.current.mode = 'pan'
    }
    else if (tool === 'draw') { gesture.current.mode = 'draw'; setDraft([sp]) }
    else if (tool === 'measure' || tool === 'arrow' || tool === 'calibrate') { gesture.current.mode = 'segment'; setPending(sp); setCursor(sp) }
    else if (tool === 'hatch' || tool === 'cut' || tool === 'symbole') { gesture.current.mode = 'hatch'; setPending(sp); setCursor(sp) }
    // Remplir et compter se font d'un toucher, au relâchement ; glisser déplace le plan.
    else if (tool === 'fill' || tool === 'count') { gesture.current.mode = 'pan' }
    else { gesture.current.mode = 'none' } // note : géré au relâchement (tap)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (e.shiftKey !== maj) setMaj(e.shiftKey)
    if (!ptrs.current.has(e.pointerId)) {
      if (ptrs.current.size === 0 && tool !== 'pan') setCursor(toStage(e.clientX, e.clientY))
      return
    }
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) > TAP_PX) g.moved = true

    if (g.mode === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
      const r = containerRef.current!.getBoundingClientRect()
      if (g.lastDist > 0) zoomAt(d / g.lastDist, mx - r.left, my - r.top)
      setView((v) => ({ ...v, tx: v.tx + (mx - g.lastMidX), ty: v.ty + (my - g.lastMidY) }))
      g.lastDist = d; g.lastMidX = mx; g.lastMidY = my
      return
    }
    if (g.mode === 'pan') {
      const suivante = { ...viewRef.current, tx: viewRef.current.tx + e.movementX, ty: viewRef.current.ty + e.movementY }
      viewRef.current = suivante
      setView(suivante)
      vitX.current.ajouter(suivante.tx)
      vitY.current.ajouter(suivante.ty)
      return
    }
    if (g.mode === 'draw') { setDraft((d) => [...d, toStage(e.clientX, e.clientY)]); return }
    if (g.mode === 'segment' || g.mode === 'hatch') { setCursor(toStage(e.clientX, e.clientY)); return }
    if (g.mode === 'dragAnn' && dragRef.current) {
      const sp = toStage(e.clientX, e.clientY)
      const d = dragRef.current
      const dx = sp.x - d.lastX, dy = sp.y - d.lastY
      setAnnotations((list) => list.map((a) => (a.id === d.id ? {
        ...a, points: a.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })), ...retouchee(a),
        ...(a.trous ? { trous: a.trous.map((t) => t.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))) } : {}),
      } : a)))
      d.lastX = sp.x; d.lastY = sp.y
      setDirty(true)
      return
    }
    if (g.mode === 'dragPoint' && dragRef.current && dragRef.current.pointIndex != null) {
      const sp = toStage(e.clientX, e.clientY)
      const d = dragRef.current
      // Un point déplacé change la surface : elle n'est plus celle du dessin.
      setAnnotations((list) => list.map((a) => (a.id === d.id ? { ...a, points: a.points.map((pt, i) => (i === d.pointIndex ? sp : pt)), ...retouchee(a), ...(a.mesureExacte ? { mesureExacte: false } : {}) } : a)))
      setDirty(true)
      return
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (surHabillage(e)) return
    const g = gesture.current
    const wasTap = !g.moved

    // Un lancer doit continuer après que le doigt s'est levé : on vise le point où le
    // geste allait, et on y va en partant de la vitesse de relâchement. Sans ça, le
    // plan s'arrête net sous le doigt, ce qu'aucun objet réel ne fait.
    if (g.mode === 'pan' && g.moved && !mouvementReduit()) {
      const vx = vitX.current.vitesse()
      const vy = vitY.current.vitesse()
      // Sous ce seuil, le doigt s'est posé plutôt que lancé : glisser serait un défaut.
      if (Math.abs(vx) > 60 || Math.abs(vy) > 60) {
        const departX = viewRef.current.tx
        const departY = viewRef.current.ty
        elan.current.x = spring({
          from: departX, to: departX + projeterElan(vx), velocity: vx, ...RESSORTS.glisse,
          onUpdate: (val) => { viewRef.current = { ...viewRef.current, tx: val }; setView((v) => ({ ...v, tx: val })) },
        })
        elan.current.y = spring({
          from: departY, to: departY + projeterElan(vy), velocity: vy, ...RESSORTS.glisse,
          onUpdate: (val) => { viewRef.current = { ...viewRef.current, ty: val }; setView((v) => ({ ...v, ty: val })) },
        })
      }
    }
    vitX.current.reset()
    vitY.current.reset()
    const sp = toStage(e.clientX, e.clientY)
    const premierRelache = ptrs.current.size === 1
    ptrs.current.delete(e.pointerId)
    const contraint = e.shiftKey

    // Un double toucher, sur iPad : le navigateur n'y voit pas de double-clic
    // sur une scène qui garde ses gestes pour elle.
    let doubleToucher = false
    if (e.pointerType === 'touch' && wasTap && premierRelache && g.mode !== 'pinch') {
      const avant = dernierToucher.current
      const t = performance.now()
      doubleToucher = !!avant && t - avant.t < DOUBLE_TOUCHER_MS && Math.hypot(e.clientX - avant.x, e.clientY - avant.y) < DOUBLE_TOUCHER_PX
      dernierToucher.current = doubleToucher ? null : { t, x: e.clientX, y: e.clientY }
    }

    if (g.mode === 'segment' && pending) {
      if (tool === 'measure' && (draft.length > 0 || wasTap)) {
        // Une longueur point par point : chaque toucher pose un sommet.
        setDraft((d) => (d.length ? [...d, contraindre(d[d.length - 1], sp, contraint)] : [sp]))
      } else {
        const fin = contraindre(pending, sp, contraint)
        if (dist(pending, fin) > 4) {
          if (tool === 'calibrate') { setCalibrateSeg([pending, fin]); setCalibrateVal('') }
          else if (tool === 'measure') poserLongueur([pending, fin])
          else if (tool === 'arrow') addAnn({ type: 'arrow', points: [pending, fin], color })
        }
      }
      setPending(null)
    } else if (g.mode === 'draw') {
      if (draft.length >= 2) addAnn({ type: 'draw', points: draft, color })
      setDraft([])
    } else if (g.mode === 'hatch' && pending) {
      if (tool === 'symbole') {
        // Le symbole s'encadre d'un glissement : un toucher n'encadre rien.
        if (g.moved && dist(pending, sp) > 4) void encadrerSymbole(pending, sp)
      } else if (g.moved && dist(pending, sp) > 4 && draft.length === 0) {
        // glisser = zone rectangulaire
        fermerContour([pending, { x: sp.x, y: pending.y }, sp, { x: pending.x, y: sp.y }])
        setDraft([])
      } else {
        // tap = sommet (zone point par point)
        setDraft((d) => [...d, contraindre(d[d.length - 1], sp, contraint)])
      }
      setPending(null)
    } else if (g.mode === 'dragAnn' || g.mode === 'dragPoint') {
      // Un clic qui sélectionne sans rien bouger n'a rien à inscrire.
      if (g.moved && avantGeste.current) retenir(avantGeste.current)
      avantGeste.current = null
      dragRef.current = null
    } else if (wasTap && ptrs.current.size === 0) {
      if (tool === 'note' && !espaceRef.current) { setNotePoint(sp); setNoteVal('') }
      if (tool === 'fill' && !espaceRef.current) void remplir(sp)
      if (tool === 'count' && !espaceRef.current) poserRepere(sp)
    }

    if (doubleToucher) surDoubleClic(sp, 22 / view.zoom)

    if (ptrs.current.size === 0) gesture.current.mode = 'none'
    else if (ptrs.current.size === 1) {
      // repasse en pan avec le doigt restant
      const [only] = [...ptrs.current.values()]
      gesture.current = { mode: tool === 'pan' ? 'pan' : 'none', startX: only.x, startY: only.y, moved: true, lastDist: 0, lastMidX: 0, lastMidY: 0 }
    }
  }

  const closeHatch = () => { terminerTrace() }
  const annuler = useCallback(() => {
    if (passe.length === 0) return
    setFutur((l) => [...l, annotations])
    setAnnotations(passe[passe.length - 1])
    setPasse((l) => l.slice(0, -1))
    setSelectedAnn(null)
    setDirty(true)
  }, [annotations, passe])

  const refaire = useCallback(() => {
    if (futur.length === 0) return
    setPasse((l) => [...l, annotations])
    setAnnotations(futur[futur.length - 1])
    setFutur((l) => l.slice(0, -1))
    setSelectedAnn(null)
    setDirty(true)
  }, [annotations, futur])

  /**
   * Applique une échelle mesurée sur la page courante aux pages choisies.
   *
   * Toutes les pages sont rendues à la même largeur : une feuille A3 couvre donc
   * deux fois plus de mètres qu'une A4 pour le même nombre de pixels. On reporte
   * l'échelle au prorata des formats plutôt que telle quelle, sinon une coupe sur
   * A3 serait mesurée au double de sa taille sans que rien ne le signale.
   */
  const appliquerEchelle = (pxParM: number, pages: number[]) => {
    const largeur = (n: number) => apercus.pages.find((x) => x.numero === n)?.largeurBase ?? null
    const source = largeur(pageNum)
    const pourPage = (n: number) => {
      const l = largeur(n)
      return source && l ? pxParM * (source / l) : pxParM
    }
    if (isPdf) {
      setEchelles((t) => {
        const suite = { ...t }
        for (const n of pages) suite[String(n)] = pourPage(n)
        return suite
      })
      // La page 1 porte aussi l'échelle du plan : c'est elle que lit tout ce qui
      // ne connaît pas les pages, à commencer par la liste des plans.
      if (pages.includes(1)) setScale(pourPage(1))
    } else {
      setScale(pxParM)
    }
    setDirty(true)
  }

  const confirmCalibrate = () => {
    if (!calibrateSeg) return
    const saisi = parseFloat(calibrateVal.replace(',', '.'))
    const m = saisi / { m: 1, cm: 100, mm: 1000 }[calibrateUnite]
    const px = dist(calibrateSeg[0], calibrateSeg[1])
    setCalibrateSeg(null); setCalibrateVal('')
    if (!(m > 0 && px > 0)) return
    const pxParM = px / m
    if (isPdf && numPages > 1) {
      // Document de plusieurs feuilles : on demande lesquelles sont au même
      // tirage plutôt que de décider à la place du diagnostiqueur.
      setPagesRetenues(Array.from({ length: numPages }, (_, i) => i + 1))
      setEchelleEnAttente(pxParM)
    } else {
      appliquerEchelle(pxParM, [1])
    }
  }
  const confirmNote = () => {
    const text = noteVal.trim()
    if (editingNoteId) {
      if (text) { retenir(); setAnnotations((l) => l.map((a) => (a.id === editingNoteId ? { ...a, text } : a))); setDirty(true) }
    } else if (notePoint && text) {
      addAnn({ type: 'note', points: [notePoint], text, color })
    }
    setNotePoint(null); setNoteVal(''); setEditingNoteId(null)
  }

  // Modifier l'annotation sélectionnée : couleur, texte (note).
  const recolorSelected = (c: string) => {
    if (!selectedAnn) return
    retenir()
    setAnnotations((l) => l.map((a) => (a.id === selectedAnn ? { ...a, color: c } : a))); setDirty(true)
  }
  const editSelectedNote = () => {
    const a = annotations.find((x) => x.id === selectedAnn)
    if (a?.type === 'note') { setEditingNoteId(a.id); setNoteVal(a.text ?? ''); setNotePoint(a.points[0]) }
  }
  const selAnn = annotations.find((a) => a.id === selectedAnn) ?? null

  // Ouvrages du relevé : ils servent à nommer les zones rattachées, directement
  // sur le plan. Une zone qui n'affiche que « 142 m² » ne dit pas ce qu'elle
  // mesure, et c'est justement ce qu'on vient chercher en rouvrant le plan.
  const { items: ouvrages, project: projet } = useOuvragesDuProjet(plan.projectId)
  const libelleLie = useCallback((a: PlanAnnotation): string | null => {
    if (!a.itemId) return null
    const it = ouvrages.find((o) => o.id === a.itemId)
    return it ? `${it.cfcCode} · ${it.cfcLabel}` : null
  }, [ouvrages])

  /**
   * Outils accessibles tant que la page n'est pas étalonnée.
   *
   * Relever une surface sur un plan sans échelle produit des pixels, et un
   * nombre de pixels n'a aucun sens dans un devis. On laisse donc regarder et
   * étalonner, rien d'autre, jusqu'à ce qu'un mètre soit défini. Compter ne
   * mesure rien : un repère se pose sans échelle.
   */
  const outilAutorise = (k: Tool) => etalonne || k === 'pan' || k === 'calibrate' || k === 'count'

  /** Choisir un outil abandonne ce qui était en cours de tracé. */
  const choisirOutil = (k: Tool) => {
    if (!outilAutorise(k)) return
    if (k !== tool) setDraft([])
    setTool(k)
    setPending(null)
    setSelectedAnn(null)
    // Compter pendant qu'on dessine des murs, c'est quitter les murs : la
    // classification active ne doit pas rester affichée sur un autre outil.
    const nature = k === 'hatch' || k === 'fill' ? 'surface' : k === 'measure' ? 'longueur' : k === 'count' ? 'comptage' : null
    const c = encastreRef.current?.classement
    if (c && nature && nature !== c.outil) encastreRef.current?.onFinClassement?.()
  }

  const lierSelection = (itemId: string | null) => {
    if (!selectedAnn) return
    retenir()
    setAnnotations((l) => l.map((a) => (a.id === selectedAnn ? { ...a, itemId } : a)))
    setDirty(true)
    setChoixOuvrage(false)
  }

  // ---- Analyse par l'IA ----
  /**
   * Les annotations au moment où l'analyse rend sa réponse, et non au moment
   * où elle a été lancée : entre les deux, une ou deux minutes ont pu passer
   * à tracer, et l'historique doit retenir l'état d'avant l'arrivée des zones.
   */
  const annotationsActuelles = useRef(annotations)
  useEffect(() => { annotationsActuelles.current = annotations }, [annotations])

  const analyse = useAnalyseIA(plan, ouvrages)
  const analyseEnCours = analyse.etat.etape === 'preparation' || analyse.etat.etape === 'analyse'
  // Une erreur survenue fenêtre fermée doit se voir : la fenêtre se rouvre pour la dire.
  useEffect(() => {
    if (analyse.etat.etape === 'erreur' || analyse.etat.etape === 'non-configuree') setAnalyseOuverte(true)
  }, [analyse.etat.etape])

  const lancerAnalyse = async (pages: number[]) => {
    const r = await analyse.lancer(pages, uid)
    if (!r) return
    setAnalyseOuverte(false)
    if (r.annotations.length > 0) {
      retenir(annotationsActuelles.current)
      setAnnotations((l) => [...l, ...r.annotations])
      setDirty(true)
    }
    setSuiteAnalyse({ ecartees: r.ecartees, remarques: r.remarques, tronque: r.tronque, pagesSansGeometrie: r.pagesSansGeometrie, comptages: r.comptages })
    // L'échelle se confirme avant tout : sans elle, les zones n'ont pas de mesure.
    if (r.echelles.some((e) => e.statut !== 'aucune')) setEchellesProposees(r.echelles)
  }

  /**
   * Pose les échelles confirmées, page par page.
   *
   * Contrairement à l'étalonnage tracé, chaque page arrive avec sa propre
   * échelle, calculée sur sa propre feuille : rien à reporter au prorata. Un
   * plan étalonné d'un bloc, sans table par page, voit d'abord son échelle
   * recopiée sur chaque page, sans quoi les pages non concernées la perdraient
   * au moment où la table apparaît.
   */
  const poserEchelles = (choix: Record<number, number>) => {
    const pages = Object.keys(choix).map(Number)
    if (pages.length === 0) return
    if (isPdf) {
      setEchelles((t) => {
        const suite: Record<string, number> = Object.keys(t).length === 0 && scale
          ? Object.fromEntries(Array.from({ length: numPages }, (_, i) => [String(i + 1), scale]))
          : { ...t }
        for (const n of pages) suite[String(n)] = choix[n]
        return suite
      })
      if (choix[1] != null) setScale(choix[1])
    } else {
      setScale(choix[pages[0]])
    }
    setDirty(true)
  }

  /** Valider des zones proposées : elles deviennent des annotations ordinaires, qui comptent au métré. */
  const validerZones = (ids: string[]) => {
    if (ids.length === 0) return
    retenir()
    setAnnotations((l) => l.map((a) => (ids.includes(a.id) ? validerProposition(a) : a)))
    setDirty(true)
  }
  /** Valider des repères d'éléments comptés : ils restent sur le plan, en trait plein. */
  const validerReperes = (ids: string[]) => {
    if (ids.length === 0) return
    retenir()
    setAnnotations((l) => l.map((a) => (ids.includes(a.id) ? validerRepere(a) : a)))
    setDirty(true)
  }
  /** Les totaux comptés par l'IA, reportés au dossier : ils y remplacent la règle de quantité. */
  const enregistrerComptages = useEnregistrerComptages(plan.projectId)
  const reporterComptages = async (nouveaux: ReturnType<typeof comptagesDuDossier>) => {
    await enregistrerComptages.mutateAsync((actuels) => ({ ...actuels, ...nouveaux }))
  }
  const retirerZones = (ids: string[]) => {
    if (ids.length === 0) return
    retenir()
    setAnnotations((l) => l.filter((a) => !ids.includes(a.id)))
    if (selectedAnn && ids.includes(selectedAnn)) setSelectedAnn(null)
    setDirty(true)
  }

  /**
   * Encastré, l'éditeur reçoit les propositions que la file d'analyse range
   * pour son plan pendant qu'il est ouvert : il tient les annotations, c'est
   * à lui de les poser (et à son enregistrement de les garder).
   */
  const recevoir = useRef<PoigneeEditeur['recevoir']>(() => undefined)
  useEffect(() => {
    recevoir.current = (pages, nouvelles) => {
      retenir(annotationsActuelles.current)
      setAnnotations((l) => remplacerPropositions(l, pages, nouvelles))
      setDirty(true)
    }
  })
  /**
   * Ce que l'espace de travail demande à l'éditeur ouvert, toujours avec l'état
   * du dernier rendu : poser les échelles vérifiées à leur arrivée, valider ou
   * rejeter depuis la revue, modifier une forme depuis le panneau.
   */
  const ordres = useRef<Omit<PoigneeEditeur, 'planId' | 'recevoir'>>({})
  useEffect(() => {
    ordres.current = {
      poserEchelles: (choix) => {
        // Une échelle déjà posée, à la main ou non, ne se remplace jamais d'ici.
        const libres = Object.fromEntries(Object.entries(choix).filter(([n]) => echelleDansTable(echelles, scale, Number(n)) == null))
        if (!Object.keys(libres).length) return
        poserEchelles(Object.fromEntries(Object.entries(libres).map(([n, v]) => [Number(n), v])))
        if (libres[String(pageNum)] != null && tool === 'calibrate') setTool('select')
      },
      valider: (ids) => {
        const cibles = annotationsActuelles.current.filter((a) => ids.includes(a.id))
        validerZones(cibles.filter((a) => a.proposition).map((a) => a.id))
        validerReperes(cibles.filter((a) => a.repere?.aValider).map((a) => a.id))
      },
      rejeter: (ids) => retirerZones(ids),
      modifier: (id, patch) => {
        if (!annotationsActuelles.current.some((a) => a.id === id)) return
        retenir(annotationsActuelles.current)
        setAnnotations((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)))
        setDirty(true)
      },
      ajouter: (nouvelles) => {
        retenir(annotationsActuelles.current)
        setAnnotations((l) => [...l, ...nouvelles])
        setDirty(true)
      },
    }
  })
  const definirPoignee = encastre?.definirPoignee
  useEffect(() => {
    if (!definirPoignee) return
    definirPoignee({
      planId: plan.id,
      recevoir: (pages, nouvelles) => recevoir.current(pages, nouvelles),
      poserEchelles: (choix) => ordres.current.poserEchelles?.(choix),
      valider: (ids) => ordres.current.valider?.(ids),
      rejeter: (ids) => ordres.current.rejeter?.(ids),
      modifier: (id, patch) => ordres.current.modifier?.(id, patch),
      ajouter: (nouvelles) => ordres.current.ajouter?.(nouvelles),
    })
    return () => definirPoignee(null)
  }, [definirPoignee, plan.id])

  // Le panneau des quantités suit la sélection du plan, et la ligne s'éclaire.
  useEffect(() => { encastreRef.current?.onSelection?.(selectedAnn) }, [selectedAnn])

  // Le récapitulatif du jeu suit ce qu'on valide ici, sans attendre l'enregistrement.
  useEffect(() => {
    encastreRef.current?.onEtat?.({ planId: plan.id, annotations, echelles, scale })
  }, [plan.id, annotations, echelles, scale])

  // Encastré, la page change depuis le navigateur : ce qui était sélectionné ou
  // en cours de tracé appartenait à la page d'avant.
  const pagePrecedente = useRef(pageNum)
  useEffect(() => {
    if (!encastreRef.current || pagePrecedente.current === pageNum) return
    pagePrecedente.current = pageNum
    setSelectedAnn(null)
    setPending(null)
    setDraft([])
  }, [pageNum])

  // La table d'échelles voyage avec les annotations : un seul bloc JSON,
  // relu d'une pièce, sans colonne supplémentaire en base.
  const corpsASauver = (): CorpsMajPlan => {
    const sansTable = annotations.filter((a) => a.type !== 'pages')
    const aEnvoyer = Object.keys(echelles).length
      ? [...sansTable, { id: 'pages', type: 'pages' as const, points: [], pageScales: echelles }]
      : sansTable
    return { scalePxPerM: scale, annotations: aEnvoyer }
  }

  const onSave = async () => {
    setSaving(true)
    try {
      const corps = corpsASauver()
      // Encastré, l'écriture passe après celles de la file sur ce plan.
      await (encastre ? encastre.enregistrer(corps) : api.plans.update(plan.id, corps))
      queryClient.invalidateQueries({ queryKey: ['plans', plan.projectId] })
      setDirty(false)
    } finally { setSaving(false) }
  }

  /**
   * Encastré, on passe d'un document à l'autre d'un clic dans le navigateur :
   * l'éditeur se démonte avant que l'enregistrement différé n'ait eu lieu. Ce
   * qui n'était pas encore parti part au démontage.
   */
  const enAttenteDeSauvegarde = useRef<{ dirty: boolean; corps: CorpsMajPlan } | null>(null)
  useEffect(() => { enAttenteDeSauvegarde.current = { dirty, corps: corpsASauver() } })
  useEffect(() => () => {
    const e = encastreRef.current
    const derniere = enAttenteDeSauvegarde.current
    if (e && derniere?.dirty) void e.enregistrer(derniere.corps).catch(() => undefined)
  }, [])

  // Auto-save : enregistre automatiquement 1s après la dernière modification.
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => { onSave() }, 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, annotations, scale, echelles])

  // Format de sortie = format d'entrée (PDF -> PDF, JPG -> JPG, sinon PNG).
  const outExt = plan.mimeType === 'application/pdf' ? 'PDF' : plan.mimeType === 'image/jpeg' ? 'JPG' : 'PNG'

  // « Plan seul » : télécharge le fichier original tel quel.
  const downloadOriginal = async () => {
    const res = await fetch(api.plans.fileUrl(plan))
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = plan.name
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  // « Plan + annotations » : composé, exporté dans le format d'entrée.
  const exportAnnotated = async () => {
    const base = canvasRef.current
    if (!base) return
    const out = document.createElement('canvas')
    out.width = base.width; out.height = base.height
    const ctx = out.getContext('2d')!
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, out.width, out.height)
    ctx.drawImage(base, 0, 0)

    // Le calque de référence fait partie de ce qu'on regarde : un export qui
    // l'oublierait ne montrerait pas la comparaison qu'on vient de faire.
    if (reference && renduReference.rendu) {
      const r = renduReference.rendu
      const k = reference.scale ?? 1
      const calque = document.createElement('canvas')
      calque.width = Math.max(1, Math.round(r.largeur * k))
      calque.height = Math.max(1, Math.round(r.hauteur * k))
      const cctx = calque.getContext('2d')!
      await new Promise<void>((res) => {
        const img = new Image()
        img.onload = () => {
          if (reference.tint) {
            cctx.fillStyle = reference.tint
            cctx.fillRect(0, 0, calque.width, calque.height)
            cctx.globalCompositeOperation = 'multiply'
          }
          cctx.drawImage(img, 0, 0, calque.width, calque.height)
          res()
        }
        img.onerror = () => res()
        img.src = r.url
      })
      ctx.globalAlpha = reference.opacity ?? 0.5
      ctx.drawImage(calque, reference.points[0].x, reference.points[0].y)
      ctx.globalAlpha = 1
    }
    if (svgRef.current) {
      // Les zones proposées par l'IA ne sont pas encore validées : elles ne
      // partent pas dans un plan qu'on transmet.
      const copie = svgRef.current.cloneNode(true) as SVGSVGElement
      copie.querySelectorAll('[data-proposition]').forEach((n) => n.remove())
      const svgStr = new XMLSerializer().serializeToString(copie)
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
      await new Promise<void>((res) => {
        const img = new Image()
        img.onload = () => { ctx.drawImage(img, 0, 0, out.width, out.height); res() }
        img.onerror = () => res()
        img.src = url
      })
    }
    const baseName = plan.name.replace(/\.[^.]+$/, '')
    if (plan.mimeType === 'application/pdf') {
      const { jsPDF } = await import('jspdf')
      const w = out.width, h = out.height
      const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] })
      pdf.addImage(out.toDataURL('image/png'), 'PNG', 0, 0, w, h)
      pdf.save(`${baseName}-annote.pdf`)
    } else {
      const jpg = plan.mimeType === 'image/jpeg'
      const a = document.createElement('a')
      a.href = out.toDataURL(jpg ? 'image/jpeg' : 'image/png', 0.92)
      a.download = `${baseName}-annote.${jpg ? 'jpg' : 'png'}`
      a.click()
    }
  }

  // Zoom molette (listener natif non-passif pour pouvoir empêcher le scroll).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const UNIT_F = { m: 1, cm: 100, mm: 1000 } as const
  const LEN_DEC = { m: 2, cm: 1, mm: 0 } as const
  const fmtLen = (px: number) => {
    if (!echelleCourante) return `${Math.round(px)} px`
    // L'arrondi se fait en mètres, puis la valeur est convertie : arrondir après
    // conversion donnerait un pas de 5 cm différent selon qu'on affiche des
    // mètres ou des millimètres.
    const m = auPas(px / echelleCourante, arrondi)
    return `${fr(m * UNIT_F[unit], LEN_DEC[unit])} ${unit}`
  }
  /**
   * Surface d'une zone, arrondie au demi-mètre carré.
   *
   * Une zone est tracée au doigt sur un plan : annoncer « 24.75 m² » donne une
   * précision que le tracé n'a pas, et personne ne commande une façade au
   * centième de mètre carré. Le pas n'est pas réglable, contrairement aux cotes :
   * une surface lue dans un rapport doit être ronde.
   *
   * Exception : une zone dont la surface vient de la géométrie du plan
   * (`mesureExacte`, aimantée puis validée) s'affiche au centième. Arrondie,
   * une fenêtre de 1,68 m² devenait « 1.5 m² ».
   */
  const fmtArea = (px2: number, exacte = false) => {
    if (!echelleCourante) return `${Math.round(px2)} px²`
    if (exacte) return `${fr(px2 / (echelleCourante * echelleCourante) * UNIT_F[unit] ** 2, 2)} ${unit}²`
    const m2 = auPas(px2 / (echelleCourante * echelleCourante), PAS_SURFACE)
    const v = m2 * UNIT_F[unit] ** 2
    // Pas de « 25.0 » : la décimale ne paraît que lorsqu'elle dit quelque chose.
    return `${fr(v, Number.isInteger(v) ? 0 : 1)} ${unit}²`
  }
  /**
   * Ce qui est posé sur la page affichée.
   *
   * Un PDF de coupes porte des annotations par feuille. Elles étaient toutes
   * dessinées sur toutes les pages : la cote de la coupe AA se retrouvait au
   * milieu de la coupe BB, sans rapport avec ce qu'on voyait.
   */
  const surLaPage = useCallback(
    (a: PlanAnnotation) => !isPdf || (a.page ?? 1) === pageNum,
    [isPdf, pageNum],
  )
  const annotationsPage = annotations.filter(surLaPage)
  /** Ce qui se dessine et se touche : la page, moins les classifications masquées dans le panneau. */
  const masquee = encastre?.masquee
  const annotationsVisibles = masquee ? annotationsPage.filter((a) => !masquee(a)) : annotationsPage

  /** Échelle de la page affichée, selon la même règle que le calcul des quantités. */
  const echelleCourante = echelleDansTable(echelles, scale, pageNum)
  /** Tant qu'on ne sait pas combien vaut un mètre, on ne peut rien relever ici. */
  const etalonne = echelleCourante != null

  /**
   * Une page sans échelle ouvre sur l'étalonnage, pas sur la main.
   *
   * Griser les autres outils ne suffisait pas : on arrivait sur « Déplacer », on
   * promenait le plan, et on découvrait l'avertissement après coup. L'outil qui
   * sert se présente donc de lui-même, à l'ouverture comme au changement de page.
   */
  useEffect(() => {
    if (loading || etalonne) return
    setTool('calibrate')
    setPending(null)
    setSelectedAnn(null)
    setDraft([])
  }, [loading, etalonne, pageNum])

  /**
   * Le clavier, une seule action par touche : V, A, L, C et F choisissent
   * l'outil ; Espace maintenu déplace le plan ; Entrée termine un tracé ; Maj
   * le contraint à 0, 45 ou 90° ; Échap abandonne le geste en cours ;
   * Ctrl+Z et Ctrl+Maj+Z parcourent l'historique ; Suppr efface la sélection.
   *
   * Les gestionnaires lisent l'état du dernier rendu par une référence : la
   * souscription ne change pas à chaque point posé.
   */
  const clavier = useRef({ terminerTrace, choisirOutil, annuler, refaire, retenir, selectedAnn, etalonne })
  useEffect(() => { clavier.current = { terminerTrace, choisirOutil, annuler, refaire, retenir, selectedAnn, etalonne } })
  useEffect(() => {
    const relacherEspace = () => {
      if (espaceRef.current) { espaceRef.current = false; setEspace(false) }
      setMaj(false)
    }
    const onKey = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement | null
      const tag = cible?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || cible?.isContentEditable) return
      const k = clavier.current

      if (e.key === 'Shift') setMaj(true)
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        // Un bouton qui a le focus se cliquerait au relâchement de la barre d'espace.
        if (tag === 'BUTTON') (cible as HTMLButtonElement).blur()
        if (!espaceRef.current) { espaceRef.current = true; setEspace(true) }
        return
      }
      // La revue des éléments à valider tient Entrée, Suppr, les flèches et Échap.
      if (encastreRef.current?.revue) return

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) k.refaire()
        else k.annuler()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        k.refaire()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const outil = TOUCHES[e.key.toLowerCase()]
      if (outil) { e.preventDefault(); k.choisirOutil(outil); return }

      if (e.key === 'Enter') {
        if (k.terminerTrace()) e.preventDefault()
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && k.selectedAnn) {
        const id = k.selectedAnn
        k.retenir(); setAnnotations((a) => a.filter((x) => x.id !== id)); setSelectedAnn(null); setDirty(true)
        return
      }

      if (e.key === 'Escape') {
        // Échap abandonne le geste en cours : il ne défait rien de ce qui est
        // posé, c'est le travail de Ctrl+Z. Il repose l'outil sur la
        // sélection, pour qu'un tracé interrompu ne reparte pas au clic suivant.
        setPending(null)
        setDraft([])
        setSelectedAnn(null)
        if (k.etalonne) setTool('select')
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setMaj(false)
      if (e.key === ' ' || e.code === 'Space') relacherEspace()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', relacherEspace)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', relacherEspace)
    }
  }, [])

  /**
   * La forme en cours de tracé, telle que le panneau des quantités la compte :
   * les sommets posés, plus le point visé.
   */
  const curseurContraint = cursor ? contraindre(draft.length ? draft[draft.length - 1] : pending, cursor, maj) : null
  const brouillon: BrouillonEditeur | null = (() => {
    if (!curseurContraint) return null
    const typeZone = classementActif?.outil !== 'comptage' ? classementActif?.typeZone ?? null : null
    if (tool === 'hatch') {
      if (draft.length >= 2) return { planId: plan.id, page: pageNum, nature: 'surface', points: [...draft, curseurContraint], typeZone }
      if (pending && dist(pending, cursor!) > 5 / view.zoom) {
        return { planId: plan.id, page: pageNum, nature: 'surface', typeZone, points: [pending, { x: cursor!.x, y: pending.y }, cursor!, { x: pending.x, y: cursor!.y }] }
      }
    }
    if (tool === 'measure') {
      if (draft.length >= 1) return { planId: plan.id, page: pageNum, nature: 'longueur', points: [...draft, curseurContraint], typeZone }
      if (pending && dist(pending, cursor!) > 4) return { planId: plan.id, page: pageNum, nature: 'longueur', points: [pending, curseurContraint], typeZone }
    }
    return null
  })()
  const cleBrouillon = brouillon ? `${brouillon.nature}:${brouillon.points.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(';')}` : ''
  useEffect(() => {
    encastreRef.current?.onBrouillon?.(brouillon)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- la clé résume la forme : un nouvel objet à chaque rendu ne doit rien relancer
  }, [cleBrouillon])
  useEffect(() => () => encastreRef.current?.onBrouillon?.(null), [])

  /**
   * Centre la vue sur une forme, assez près pour la lire, sans perdre ce qui
   * l'entoure : sa boîte occupe environ la moitié de la scène.
   */
  const cadrer = useCallback((pts: PlanPoint[]) => {
    const el = containerRef.current
    if (!el || !pts.length) return
    const r = el.getBoundingClientRect()
    const b = boiteDe(pts)
    // Un repère n'a pas de taille : on garde autour de lui de quoi le situer.
    const l = Math.max(b.largeur, 160), h = Math.max(b.hauteur, 160)
    const z = clamp(Math.min(r.width / (l * 2.2), r.height / (h * 2.2)), MIN_ZOOM, 4)
    stopElan()
    const suivante = { zoom: z, tx: r.width / 2 - (b.x + b.largeur / 2) * z, ty: r.height / 2 - (b.y + b.hauteur / 2) * z }
    viewRef.current = suivante
    setView(suivante)
  }, [])

  // Une forme désignée depuis le panneau ou la revue : sélectionnée et cadrée,
  // une fois la page chargée.
  const cible = encastre?.cible ?? null
  useEffect(() => {
    if (!cible || loading || !stage.w) return
    const a = annotationsActuelles.current.find((x) => x.id === cible.id)
    if (!a && cible.points?.length) { cadrer(cible.points); return }
    if (!a || (isPdf && (a.page ?? 1) !== pageNum)) return
    setTool('select')
    setPending(null)
    setDraft([])
    setSelectedAnn(a.id)
    cadrer(a.points)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le jeton dit qu'une nouvelle demande est arrivée
  }, [cible?.jeton, loading, stage.w, pageNum])

  // « Dessiner dans » une classification : l'outil qui lui convient, aussitôt.
  useEffect(() => {
    if (!classementActif) return
    const outil: Tool = classementActif.outil === 'longueur' ? 'measure' : classementActif.outil === 'comptage' ? 'count' : 'hatch'
    if (classementActif.categorie) setCategorieComptage(classementActif.categorie)
    if (!(etalonne || outil === 'count')) return
    setTool(outil)
    setPending(null)
    setDraft([])
    setSelectedAnn(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- le jeton dit qu'une nouvelle classification a été choisie
  }, [classementActif?.jeton])


  /** Mesure lisible d'une annotation, ou null si elle ne mesure rien. */
  const quantiteDe = (a: PlanAnnotation): string | null => {
    const nature = natureDuTrace(a)
    if (nature === 'surface') return fmtArea(aireDeLaForme(a), a.mesureExacte)
    if (nature === 'longueur') return fmtLen(longueurPolyligne(a.points))
    return null
  }
  /**
   * Hauteur, dans la scène, à laquelle ouvrir le panneau d'un outil.
   *
   * Un réglage qui apparaît loin du bouton qu'on vient de presser se cherche :
   * on le pose donc en face de lui. La mesure est prise sur le rail, qui ne
   * bouge pas, et retombe en haut si elle n'est pas encore possible.
   */
  const [hautDuPanneau, setHautDuPanneau] = useState(12)
  useLayoutEffect(() => {
    const placer = () => {
      const bouton = railRef.current?.querySelector(`[data-outil="${tool}"]`)
      const scene = containerRef.current
      if (!bouton || !scene) return
      setHautDuPanneau(Math.max(8, bouton.getBoundingClientRect().top - scene.getBoundingClientRect().top))
    }
    const t = requestAnimationFrame(placer)
    return () => cancelAnimationFrame(t)
  }, [tool])

  /** Ce qui, sur cette page, porte une mesure : les zones et les cotes. */
  const zonesDeLaPage = annotationsPage.filter((a) => natureDe(a) !== 'aucune')

  /** Les repères des éléments comptés sur cette page, par catégorie : la légende de leurs couleurs. */
  const reperesPage = annotationsPage.filter((a) => a.type === 'repere' && a.repere)
  const reperesParCategorie: ReperesDeCategorie[] = CLES_CATEGORIES.flatMap((categorie) => {
    const siens = reperesPage.filter((a) => a.repere!.categorie === categorie)
    return siens.length ? [{ categorie, total: siens.length, aValider: siens.filter((a) => a.repere!.aValider).length }] : []
  })
  // Encastré, ce que l'analyse a dit vient des feuilles du jeu, pas d'une analyse lancée ici.
  const suite = encastre ? encastre.suite : suiteAnalyse
  const montrerElements = reperesPage.length > 0 || (suite?.comptages.length ?? 0) > 0

  /** Les zones proposées par l'analyse, en attente de validation, ici et sur les autres pages. */
  const propositionsPage = annotationsPage.filter((a) => a.proposition)
  const propositionsAutres = (() => {
    if (!isPdf) return []
    const parPage = new Map<number, number>()
    for (const a of annotations) {
      if (!a.proposition || (a.page ?? 1) === pageNum) continue
      parPage.set(a.page ?? 1, (parPage.get(a.page ?? 1) ?? 0) + 1)
    }
    return [...parPage].sort((x, y) => x[0] - y[0]).map(([page, nombre]) => ({ page, nombre }))
  })()
  /**
   * Mesure d'une zone proposée, au centième quand elle est aimantée sur le
   * dessin vectoriel (elle a alors la précision du dessin), approchée sinon.
   */
  const mesureProposee = (a: PlanAnnotation): string | null => {
    const m = mesureDeLaZone(a, echelleCourante)
    if (m == null) return null
    const u = a.type === 'hatch' ? 'm²' : 'm'
    return a.proposition?.aimantee ? `${fr(m, 2)} ${u}` : `≈ ${fr(m, 1)} ${u}`
  }

  /**
   * Les panneaux de la feuille : zones à valider, éléments comptés, mesures.
   * Seul, l'éditeur les fait flotter à droite du plan ; encastré dans les
   * Métrés, ils rejoignent la colonne de droite de l'espace de travail.
   */
  const panneauxDeLaFeuille = (
    <>
      {(propositionsPage.length > 0 || propositionsAutres.length > 0) && (
        <ListePropositions
          zones={propositionsPage}
          selection={selectedAnn}
          mesure={mesureProposee}
          ecartCotes={(a) => ecartAuxCotes(a, echelleCourante)}
          lie={libelleLie}
          bilan={bilanDeFacade(propositionsPage, echelleCourante)}
          autresPages={propositionsAutres}
          ecartees={(suite?.ecartees ?? []).filter((e) => !isPdf || e.page == null || e.page === pageNum)}
          remarques={suite?.remarques ?? null}
          tronque={suite?.tronque ?? false}
          sansGeometrie={!!suite?.pagesSansGeometrie.includes(pageNum)}
          etalonne={etalonne}
          masqueeSurMobile={!!selAnn}
          onChoisir={(id) => { setTool('select'); setSelectedAnn(id) }}
          onValider={(id) => validerZones([id])}
          onValiderTout={() => validerZones(propositionsPage.map((a) => a.id))}
          onSupprimer={(id) => retirerZones([id])}
          onSupprimerTout={() => retirerZones(propositionsPage.map((a) => a.id))}
          onOuvrage={(id) => { setTool('select'); setSelectedAnn(id); setChoixOuvrage(true) }}
          onAllerPage={(n) => { setSelectedAnn(null); allerPage(n) }}
        />
      )}
      {montrerElements && (
        <ElementsDeLAnalyse
          // Une nouvelle analyse repart de ses propres totaux.
          key={suite?.comptages.map((c) => `${c.categorie}${c.nombre}`).join('-') ?? 'aucune'}
          reperes={reperesParCategorie}
          comptages={suite?.comptages ?? []}
          existants={comptagesDuDossier(projet?.comptages)}
          nomDuPlan={plan.name}
          enCours={enregistrerComptages.isPending}
          masqueeSurMobile={!!selAnn}
          onValiderReperes={() => validerReperes(reperesPage.filter((a) => a.repere!.aValider).map((a) => a.id))}
          onRetirerReperes={() => retirerZones(reperesPage.filter((a) => a.repere!.aValider).map((a) => a.id))}
          onReporter={reporterComptages}
        />
      )}
      {zonesDeLaPage.length > 0 && (
        <ListeDesZones
          zones={zonesDeLaPage}
          selection={selectedAnn}
          mesure={quantiteDe}
          lie={libelleLie}
          onChoisir={(id) => { setTool('select'); setSelectedAnn(id); setChoixOuvrage(true) }}
        />
      )}
    </>
  )

  /** Encastré : l'échelle que l'analyse propose pour cette page, et celles du plan qui attendent. */
  const echellesAVerifier = (encastre?.echellesProposees ?? [])
    .filter((e) => e.statut !== 'aucune' && echelleDansTable(echelles, scale, e.page) == null)
  const echelleDeLaPage = echellesAVerifier.find((e) => e.page === pageNum) ?? null

  // Les pastilles de couleur agissent sur la selection quand il y en a une,
  // sinon sur le prochain trace : elles doivent montrer celle qui s'applique.
  const couleurActive = selAnn ? (selAnn.color ?? COLORS[0]) : color

  const font = 13 / view.zoom // labels lisibles quel que soit le zoom
  const strokeW = 2 / view.zoom

  /** Le nom qu'une étiquette écrit sur une forme validée : son libellé, sinon son type. */
  const nomAffiche = (a: PlanAnnotation): string | null => {
    if (a.proposition || a.type === 'repere') return null
    const t = a.text?.trim()
    if (t) return t
    return a.typeZone && a.typeZone !== 'autre' ? NOMS_TYPES_ZONE[a.typeZone] : null
  }
  /** Où ajouter un sommet : le milieu de chaque côté de la forme sélectionnée. */
  const formeSelectionnee = selectedAnn ? annotations.find((x) => x.id === selectedAnn) ?? null : null
  const milieux = formeSelectionnee && tool === 'select' && (formeSelectionnee.type === 'hatch' || formeSelectionnee.type === 'measure')
    ? formeSelectionnee.points
      .slice(0, formeSelectionnee.type === 'hatch' ? undefined : -1)
      .map((p, i, pts) => mid(p, formeSelectionnee.points[(i + 1) % formeSelectionnee.points.length] ?? pts[i]))
    : []
  const outilsProposes = TOOLS.filter((t) => t.key !== 'symbole' || !!encastre?.onSymbole)
  const couleurBrouillon = tool === 'cut' ? '#dc2626' : tool === 'symbole' ? '#d97706' : couleurDuTrace

  return (
    /* L'éditeur reprend la mise en page de l'app : barres claires, texte presque
       noir, coins arrondis. Il était jusqu'ici en gris anthracite avec ses propres
       gris, si bien qu'on changeait d'application en ouvrant un plan, et l'outil
       actif, posé en `bg-primary` sur un fond déjà sombre, ne se voyait pas. Seule
       la scène garde un fond neutre réglable : c'est lui qui détache la feuille. */
    <div className={cn('flex select-none flex-col bg-background', encastre ? 'relative h-full min-h-0 w-full' : 'fixed inset-0 z-50')}>
      {/* Dans l'app iPhone et iPad, la page passe sous la barre d'état (heure,
          réseau, batterie) : sans marge, la croix et le nom du plan se
          retrouvaient dessous. La marge est dans la barre elle-même, et non
          autour de l'éditeur, pour que son fond monte jusqu'en haut de l'écran
          sans bande vide. Sur ordinateur, ces marges valent zéro. */}
      <header className={cn('shrink-0 border-b', !encastre && 'safe-top safe-sides')}>
        <div className={cn('flex items-center gap-2 px-2 sm:px-3', encastre ? 'h-12' : 'h-14')}>
          {/* Encastré, la barre de l'espace de travail porte le logo et le retour. */}
          {!encastre && (
            <>
              <button onClick={onClose} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Fermer">
                <X className="h-5 w-5" />
              </button>
              <img src="/diagly-logo.svg" alt="Diagly" className="hidden h-7 shrink-0 sm:block" />
              <div className="hidden h-6 w-px shrink-0 bg-border sm:block" aria-hidden />
            </>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{encastre ? encastre.titre : plan.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {saving
                ? <><Loader2 className="h-3 w-3 animate-spin" />Enregistrement…</>
                : dirty
                  ? 'Modifications en cours…'
                  : <><Check className="h-3 w-3 text-emerald-600" />Enregistré</>}
              <span aria-hidden>·</span>
              {encastre
                ? (etalonne ? <span>échelle posée</span> : <span className="text-amber-600">pas d’échelle</span>)
                : scale ? <span>échelle définie</span> : <span className="text-amber-600">pas d’échelle</span>}
            </p>
          </div>

          {/* L'analyse par l'IA, signalée par le logo de Diagly : elle propose
              l'échelle et les zones à métrer, que l'on valide ensuite. Encastré,
              c'est la file du jeu entier qui analyse, depuis le navigateur. */}
          {!encastre && (
            <button
              onClick={() => setAnalyseOuverte(true)}
              data-visite="plan-analyse"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              title="Analyser avec l’IA : échelle et zones à métrer"
            >
              {analyseEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <MarqueDiagly className="h-4 w-4" />}
              <span className="hidden md:inline">{analyseEnCours ? 'Analyse en cours…' : 'Analyser avec l’IA'}</span>
            </button>
          )}

          <div className="flex shrink-0 items-center gap-0.5">
            <button onClick={() => zoomButton(1 / 1.25)} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Dézoomer"><ZoomOut className="h-4 w-4" /></button>
            <span className="hidden w-12 text-center text-xs tabular-nums text-muted-foreground sm:block">{Math.round(view.zoom * 100)}%</span>
            <button onClick={() => zoomButton(1.25)} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Zoomer"><ZoomIn className="h-4 w-4" /></button>
            <button onClick={fitView} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Ajuster"><Maximize className="h-4 w-4" /></button>
            <button onClick={annuler} disabled={passe.length === 0} className="rounded-lg p-2 transition-colors hover:bg-muted disabled:opacity-40" title="Annuler (Ctrl+Z)"><Undo2 className="h-4 w-4" /></button>
            <button onClick={refaire} disabled={futur.length === 0} className="rounded-lg p-2 transition-colors hover:bg-muted disabled:opacity-40" title="Rétablir (Ctrl+Maj+Z)"><Redo2 className="h-4 w-4" /></button>
            <div className="relative">
              <button onClick={() => setExportOpen((o) => !o)} className="rounded-lg p-2 transition-colors hover:bg-muted" title="Exporter"><Download className="h-4 w-4" /></button>
              {exportOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                  <div className="absolute right-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-xl border bg-popover py-1 shadow-lg">
                    <button onClick={() => { setExportOpen(false); downloadOriginal() }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">Plan seul ({outExt} original)</button>
                    <button onClick={() => { setExportOpen(false); exportAnnotated() }} className="w-full px-3 py-2 text-left text-sm hover:bg-muted">Plan + annotations ({outExt})</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mêmes marges sur les côtés : en paysage, l'iPhone a son encoche à
          gauche ou à droite, et le rail d'outils comme la scène doivent rester
          hors de sa portée. */}
      <div className={cn('flex min-h-0 flex-1', !encastre && 'safe-sides')}>
        {/* Rail d'outils : vertical sur grand écran, il repasse en bande sous la
            scène sur mobile, à portée de pouce. Il descend jusqu'au bas de
            l'écran : ses dernières pastilles s'arrêtent au-dessus de la barre
            d'accueil de l'iPad, qui se superpose à la page dans l'app. */}
        <nav ref={railRef} className="hidden w-20 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2 pb-[calc(var(--safe-bottom)+0.5rem)] sm:flex" aria-label="Outils">
          {outilsProposes.map((t) => (
            <BoutonOutil key={t.key} outil={t} actif={tool === t.key} bloque={!outilAutorise(t.key)} onChoisir={choisirOutil} />
          ))}
          <div className="mt-3 border-t pt-3">
            <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Couleur</p>
            <div className="flex flex-col items-center gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => (selectedAnn ? recolorSelected(c) : setColor(c))}
                  className={cn('h-5 w-5 rounded-full ring-offset-2 transition-shadow', couleurActive === c && 'ring-2 ring-foreground')}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </nav>

        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={containerRef}
            style={{ background: bgColor }}
            className={cn('relative min-h-0 flex-1 touch-none overflow-hidden',
              tool === 'pan' || espace ? 'cursor-grab active:cursor-grabbing' : tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={(e) => {
              if ((e.target as HTMLElement | null)?.closest?.('[data-habillage]')) return
              surDoubleClic(toStage(e.clientX, e.clientY), 12 / view.zoom)
            }}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />Chargement du plan…
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
                Impossible de charger le plan ({loadError}).
              </div>
            )}

          <div
            style={{ width: stage.w, height: stage.h, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.zoom})`, transformOrigin: '0 0' }}
            className={cn('absolute left-0 top-0 bg-white shadow-xl ring-1 ring-black/5', loading && 'hidden')}
          >
              <canvas ref={canvasRef} className="block pointer-events-none" />

              {/* Le calque se glisse entre le plan et les annotations : on compare
                  deux documents, et ce qu'on a tracé reste lisible par-dessus. */}
              {reference && renduReference.rendu && (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: reference.points[0].x,
                    top: reference.points[0].y,
                    width: renduReference.rendu.largeur * (reference.scale ?? 1),
                    height: renduReference.rendu.hauteur * (reference.scale ?? 1),
                    opacity: reference.opacity ?? 0.5,
                    background: reference.tint ?? undefined,
                  }}
                >
                  <img
                    src={renduReference.rendu.url}
                    alt=""
                    className="h-full w-full"
                    // Multiplier plutôt que superposer : le blanc du plan prend la
                    // teinte, ses traits restent noirs et donc lisibles.
                    style={{ mixBlendMode: reference.tint ? 'multiply' : undefined }}
                  />
                </div>
              )}
            <svg ref={svgRef} viewBox={`0 0 ${stage.w} ${stage.h}`} width={stage.w} height={stage.h} className="absolute inset-0 pointer-events-none">
              {annotationsVisibles.map((a) => (
                <Shape key={a.id} a={a} fmtLen={fmtLen} fmtArea={fmtArea} font={font} strokeW={strokeW} lie={libelleLie(a)}
                  etiquette={a.proposition ? mesureProposee(a) : null} etiquettes={etiquettes} nom={nomAffiche(a)} />
              ))}

              {(encastre?.marques ?? []).map((m) => (
                <rect
                  key={m.id}
                  x={m.x - m.largeur / 2 - 3 * strokeW} y={m.y - m.hauteur / 2 - 3 * strokeW}
                  width={m.largeur + 6 * strokeW} height={m.hauteur + 6 * strokeW} rx={3 * strokeW}
                  fill={m.actif ? '#f59e0b' : 'none'} fillOpacity={0.12}
                  stroke={m.actif ? '#d97706' : '#9ca3af'} strokeWidth={1.5 * strokeW} strokeDasharray={`${4 * strokeW} ${3 * strokeW}`}
                />
              ))}

              {/* Poignées de l'annotation sélectionnée, et le point milieu de
                  chaque côté, d'où l'on tire un nouveau sommet. */}
              {formeSelectionnee && (
                <g>
                  {milieux.map((m, i) => (
                    <circle key={`m${i}`} cx={m.x} cy={m.y} r={4 / view.zoom} fill="#fff" fillOpacity={0.85} stroke="#2563eb" strokeOpacity={0.7} strokeWidth={1.5 / view.zoom} />
                  ))}
                  {formeSelectionnee.points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6 / view.zoom} fill="#fff" stroke="#2563eb" strokeWidth={2.5 / view.zoom} />)}
                </g>
              )}

              {pending && cursor && draft.length === 0 && (
                <line x1={pending.x} y1={pending.y} x2={curseurContraint!.x} y2={curseurContraint!.y} stroke={couleurBrouillon} strokeWidth={strokeW} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`} />
              )}
              {tool === 'draw' && draft.length > 0 && (
                <polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
              )}
              {(tool === 'hatch' || tool === 'cut' || tool === 'symbole') && pending && cursor && draft.length === 0 && dist(pending, cursor) > 5 / view.zoom && (
                <rect
                  x={Math.min(pending.x, cursor.x)} y={Math.min(pending.y, cursor.y)}
                  width={Math.abs(cursor.x - pending.x)} height={Math.abs(cursor.y - pending.y)}
                  fill={couleurBrouillon} fillOpacity={0.15} stroke={couleurBrouillon} strokeWidth={strokeW} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`}
                />
              )}
              {(tool === 'hatch' || tool === 'cut' || tool === 'measure') && draft.length > 0 && (
                <>
                  {(tool === 'hatch' || tool === 'cut') && draft.length >= 2 && curseurContraint && (
                    <polygon points={[...draft, curseurContraint].map((p) => `${p.x},${p.y}`).join(' ')} fill={couleurBrouillon} fillOpacity={0.12} stroke="none" />
                  )}
                  <polyline points={draft.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={couleurBrouillon} strokeWidth={strokeW} />
                  {curseurContraint && <line x1={draft[draft.length - 1].x} y1={draft[draft.length - 1].y} x2={curseurContraint.x} y2={curseurContraint.y} stroke={couleurBrouillon} strokeWidth={strokeW} strokeDasharray={`${6 / view.zoom} ${4 / view.zoom}`} />}
                  {draft.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5 / view.zoom} fill={couleurBrouillon} />)}
                </>
              )}
            </svg>
          </div>

            {/* L'aide tient sur une ligne, posée sur la scène : elle suit l'outil
                choisi sans prendre une barre entière à l'écran. */}
            {!loading && (
              <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
                <p className="max-w-full truncate rounded-full border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
                  {HINTS[tool]}
                </p>
              </div>
            )}

            {(((tool === 'hatch' || tool === 'cut') && draft.length >= 3) || (tool === 'measure' && draft.length >= 2)) && (
              <button
                onClick={closeHatch}
                data-habillage
                className="absolute left-1/2 top-14 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-lg pointer-coarse:min-h-11 pointer-coarse:px-5"
                title="Entrée ou double-clic"
              >
                {tool === 'hatch' ? 'Fermer la zone' : tool === 'cut' ? 'Découper' : 'Terminer la longueur'}
              </button>
            )}

            {/* Le dessin dans une classification du panneau : on voit dans
                quoi tombera la prochaine forme, et on en sort d'un geste. */}
            {classementActif && !loading && (
              <div data-habillage className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-full border bg-background/95 py-1 pl-3 pr-1 text-xs shadow-sm backdrop-blur">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: classementActif.outil === 'comptage' ? COULEURS_CATEGORIE[categorieComptage] : classementActif.couleur }} aria-hidden />
                <span>Dessin dans <span className="font-semibold">{classementActif.outil === 'comptage' ? CATEGORIE[categorieComptage].libelle : classementActif.libelle}</span></span>
                {encastre?.onFinClassement && (
                  <button onClick={encastre.onFinClassement} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted pointer-coarse:h-9 pointer-coarse:w-9" title="Ne plus dessiner dans cette classification">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Compter : la catégorie des repères posés à chaque toucher. */}
            {tool === 'count' && !loading && !(classementActif?.outil === 'comptage' && classementActif.categorie) && (
              <ChoixCategorie haut={hautDuPanneau} choisie={categorieComptage} onChoisir={setCategorieComptage} />
            )}

            {(avisScene || remplissageEnCours) && (
              <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center px-3">
                <p className="max-w-md rounded-xl border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
                  {remplissageEnCours ? <span className="flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />Lecture des traits de la page…</span> : avisScene}
                </p>
              </div>
            )}

            {/* Tant que la page n'a pas d'échelle, rien de ce qu'on relèverait
                n'aurait de sens : on le dit, et on n'ouvre que l'étalonnage. */}
            {!loading && !etalonne && echelleDeLaPage && (
              <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-3">
                <div
                  data-habillage
                  className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 shadow-sm"
                >
                  <MarqueDiagly className="h-4 w-4" />
                  <p className="min-w-0 text-xs text-sky-950">
                    <span className="font-medium">Échelle proposée :</span> {echelleDeLaPage.resume}.
                  </p>
                  <button
                    onClick={() => setEchellesProposees(echellesAVerifier)}
                    className="shrink-0 rounded-lg bg-sky-700 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Vérifier et poser
                  </button>
                </div>
              </div>
            )}
            {!loading && !etalonne && !echelleDeLaPage && (
              <div className="pointer-events-none absolute inset-x-0 top-14 flex justify-center px-3">
                <div
                  data-habillage
                  className="pointer-events-auto flex max-w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 shadow-sm"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-900">
                    {isPdf && numPages > 1 ? `Page ${pageNum} non étalonnée.` : 'Plan non étalonné.'}{' '}
                    Tracez un trait sur une cote connue pour définir l’échelle.
                  </p>
                  <button
                    onClick={() => choisirOutil('calibrate')}
                    className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                  >
                    Étalonner
                  </button>
                </div>
              </div>
            )}

            {tool === 'reference' && (
              <PanneauReference
                haut={hautDuPanneau}
                reference={reference}
                plans={autresPlans}
                nomReference={planReference?.name ?? null}
                pagesReference={apercusReference.pages}
                chargement={plansDuDossier.isLoading || (!!reference && !renduReference.rendu && !renduReference.erreur)}
                erreur={renduReference.erreur}
                onPoser={poserReference}
                onMaj={majReference}
                onRetirer={retirerReference}
              />
            )}

            {/* À droite : les zones proposées par l'IA, à valider, puis les
                mesures de la page, où l'on relit ce qui a été mesuré et ce qui
                attend encore un ouvrage, sans ouvrir chaque forme. */}
            {!encastre && (zonesDeLaPage.length > 0 || propositionsPage.length > 0 || propositionsAutres.length > 0 || montrerElements) && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10 flex max-h-[45vh] flex-col items-end gap-2 sm:inset-x-auto sm:bottom-auto sm:right-3 sm:top-3 sm:max-h-[calc(100%-1.5rem)]">
                {panneauxDeLaFeuille}
              </div>
            )}

            {analyseEnCours && !analyseOuverte && !encastre && (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 sm:bottom-auto sm:top-14">
                <AnalyseEnFond onOuvrir={() => setAnalyseOuverte(true)} />
              </div>
            )}

            {selAnn && !encastre?.revue && (
              <PanneauSelection
                key={selAnn.id}
                haut={hautDuPanneau}
                annotation={selAnn}
                lie={libelleLie(selAnn)}
                etalonne={!!scale}
                quantite={selAnn.proposition ? mesureProposee(selAnn) : quantiteDe(selAnn)}
                onLier={() => setChoixOuvrage(true)}
                onEditerNote={editSelectedNote}
                onValider={selAnn.proposition ? () => validerZones([selAnn.id])
                  : selAnn.repere?.aValider ? () => validerReperes([selAnn.id]) : undefined}
                onSupprimer={() => { retenir(); setAnnotations((a) => a.filter((x) => x.id !== selectedAnn)); setSelectedAnn(null); setDirty(true) }}
                onModifier={(patch) => { retenir(); setAnnotations((l) => l.map((a) => (a.id === selAnn.id ? { ...a, ...patch } : a))); setDirty(true) }}
              />
            )}
          </div>

          {/* Bande du bas : les outils sur mobile, puis les réglages de la scène.
              Elle garde la marge de la barre d'accueil de l'iPhone et de l'iPad :
              sans elle, unité, arrondi et fond tombaient sous ce trait, là où un
              glissement du doigt renvoie à l'écran d'accueil. */}
          <div className="shrink-0 border-t pb-[var(--safe-bottom)]">
            <div className="flex gap-1 overflow-x-auto p-2 sm:hidden">
              {outilsProposes.map((t) => (
                <BoutonOutil key={t.key} outil={t} actif={tool === t.key} bloque={!outilAutorise(t.key)} onChoisir={choisirOutil} compact />
              ))}
            </div>
            <div className="flex items-center gap-3 overflow-x-auto px-3 py-2 text-xs text-muted-foreground sm:px-4">
              <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => (selectedAnn ? recolorSelected(c) : setColor(c))}
                    className={cn('h-5 w-5 rounded-full ring-offset-2', couleurActive === c && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>

              {/* Nom et quantité au centre de chaque zone validée : on relit le
                  métré sur le plan, sans ouvrir chaque forme. */}
              <button
                onClick={() => setEtiquettes((v) => !v)}
                aria-pressed={etiquettes}
                className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 font-medium transition-colors pointer-coarse:min-h-11',
                  etiquettes ? 'bg-foreground text-background' : 'bg-muted hover:text-foreground')}
                title="Écrire le nom et la quantité sur chaque zone"
              >
                <Tags className="h-3.5 w-3.5" />Étiquettes
              </button>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden sm:inline">Unité</span>
                <div className="flex rounded-lg bg-muted p-0.5">
                  {(['m', 'cm', 'mm'] as const).map((u) => (
                    <button key={u} onClick={() => setUnit(u)}
                      className={cn('rounded-md px-2 py-1 font-medium transition-colors', unit === u ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground')}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden sm:inline">Arrondi des cotes</span>
                <div className="flex rounded-lg bg-muted p-0.5">
                  {ARRONDIS.map((a) => (
                    <button key={a.label} onClick={() => setArrondi(a.pas)}
                      className={cn('rounded-md px-2 py-1 font-medium transition-colors', arrondi === a.pas ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground')}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden sm:inline">Fond</span>
                {FONDS.map((c) => (
                  <button key={c} onClick={() => setBgColor(c)}
                    className={cn('h-5 w-5 rounded-full border ring-offset-2', bgColor === c && 'ring-2 ring-foreground')}
                    style={{ backgroundColor: c }} />
                ))}
                <label className="relative h-5 w-5 cursor-pointer overflow-hidden rounded-full border" title="Autre couleur">
                  <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
                  <span className="absolute inset-0" style={{ background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }} />
                </label>
              </div>

              {isPdf && numPages > 1 && !encastre && (
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  <button onClick={() => allerPage(Math.max(1, pageNum - 1))} disabled={pageNum <= 1} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="tabular-nums">Page {pageNum} / {numPages}</span>
                  <button onClick={() => allerPage(Math.min(numPages, pageNum + 1))} disabled={pageNum >= numPages} className="rounded-lg p-1.5 hover:bg-muted disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>

            {/* Bande de pages : un document de coupes se parcourt à vue, pas en
                avançant d'une feuille à l'aveugle. L'étalonnage de chacune s'y lit. */}
            {isPdf && numPages > 1 && !encastre && (
              <div className="flex gap-2 overflow-x-auto border-t px-3 py-2">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
                  const vignette = apercus.pages.find((x) => x.numero === n)
                  const sansEchelle = echelleDansTable(echelles, scale, n) == null
                  return (
                    <button
                      key={n}
                      onClick={() => allerPage(n)}
                      title={`Page ${n}${sansEchelle ? ' (non étalonnée)' : ''}`}
                      className={cn('relative w-16 shrink-0 overflow-hidden rounded-lg border bg-white transition-colors',
                        n === pageNum ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40')}
                    >
                      {vignette
                        ? <img src={vignette.url} alt="" className="h-20 w-full object-contain" />
                        : <span className="flex h-20 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></span>}
                      <span className="block border-t py-0.5 text-[10px] tabular-nums">
                        {n}{sansEchelle && <span className="ml-0.5 text-amber-600">•</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Encastré : les panneaux de la feuille dans la colonne de droite des Métrés. */}
      {encastre?.panneau && createPortal(
        <div className="flex flex-col gap-3 [&>*]:w-full">
          {panneauxDeLaFeuille}
          {zonesDeLaPage.length === 0 && propositionsPage.length === 0 && propositionsAutres.length === 0 && !montrerElements && (
            <p className="rounded-xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
              Rien à valider sur cette feuille. Ce que l’IA y propose, et ce que vous y mesurez, s’affiche ici.
            </p>
          )}
        </div>,
        encastre.panneau,
      )}

      {/* Rattachement de la zone sélectionnée à un ouvrage du relevé */}
      {choixOuvrage && selAnn && (
        <ChoixOuvrage
          projectId={plan.projectId}
          nature={natureDuTrace(selAnn)}
          choisi={selAnn.itemId ?? null}
          onChoisir={lierSelection}
          onFermer={() => setChoixOuvrage(false)}
        />
      )}

      {/* Modale étalonnage */}
      {calibrateSeg && (
        <Modal title="Étalonner l'échelle" onCancel={() => setCalibrateSeg(null)} onConfirm={confirmCalibrate} confirmLabel="Définir l'échelle">
          <p className="mb-3 text-sm text-muted-foreground">Longueur réelle du trait tracé :</p>
          <div className="flex items-center gap-2">
            <input
              autoFocus type="number" inputMode="decimal" step="0.01" value={calibrateVal}
              onChange={(e) => setCalibrateVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmCalibrate() }}
              placeholder={{ m: 'ex. 5.20', cm: 'ex. 520', mm: 'ex. 5200' }[calibrateUnite]}
              // `min-w-0` sans quoi le champ refuse de se réduire sous sa largeur
              // naturelle, et le sélecteur d'unité sort de la fenêtre.
              className="h-11 min-w-0 flex-1 rounded-lg border px-3 text-base outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex shrink-0 rounded-lg bg-muted p-0.5">
              {(['m', 'cm', 'mm'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setCalibrateUnite(u)}
                  className={cn('rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                    calibrateUnite === u ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* À quelles pages l'étalonnage s'applique-t-il ? */}
      {echelleEnAttente != null && (
        <Modal
          large
          title="Appliquer l’échelle"
          onCancel={() => setEchelleEnAttente(null)}
          onConfirm={() => { appliquerEchelle(echelleEnAttente, pagesRetenues); setEchelleEnAttente(null) }}
          confirmLabel={`Appliquer à ${pagesRetenues.length} page${pagesRetenues.length > 1 ? 's' : ''}`}
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Les pages au même tirage partagent cette échelle. Celles d’un autre format sont
            ajustées au prorata ; décochez les pages qui n’ont rien à voir.
          </p>
          <div className="mb-3 flex gap-2 text-xs">
            <button
              onClick={() => setPagesRetenues(Array.from({ length: numPages }, (_, i) => i + 1))}
              className="rounded-lg border px-2.5 py-1.5 hover:bg-muted"
            >Tout cocher</button>
            <button
              onClick={() => setPagesRetenues([pageNum])}
              className="rounded-lg border px-2.5 py-1.5 hover:bg-muted"
            >Cette page seule</button>
          </div>
          {/* Des vignettes qu'on puisse regarder : on choisit les pages d'après ce
              qu'elles montrent, et une coupe de 90 pixels de large ne montre rien. */}
          {/* De la marge dans la zone qui défile : sans elle, la bordure des cartes
              est rognée au bord du cadre, et la colonne de droite passe sous la
              barre de défilement. */}
          <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto py-1 pl-2 pr-3 sm:grid-cols-4">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => {
              const vignette = apercus.pages.find((x) => x.numero === n)
              const coche = pagesRetenues.includes(n)
              return (
                <button
                  key={n}
                  onClick={() => setPagesRetenues((l) => (coche ? l.filter((x) => x !== n) : [...l, n]))}
                  className={cn('overflow-hidden rounded-lg border bg-white transition-colors',
                    coche ? 'border-foreground ring-1 ring-foreground' : 'opacity-60 hover:opacity-100')}
                >
                  {vignette
                    ? <img src={vignette.url} alt="" className="h-40 w-full bg-white object-contain" />
                    : <span className="flex h-40 items-center justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></span>}
                  <span className="flex items-center justify-center gap-1 border-t py-1.5 text-xs tabular-nums">
                    {coche && <Check className="h-3.5 w-3.5" />}Page {n}
                  </span>
                </button>
              )
            })}
          </div>
        </Modal>
      )}

      {analyseOuverte && (
        <FenetreAnalyse
          etat={analyse.etat}
          pageCourante={pageNum}
          nombrePages={isPdf ? numPages : 1}
          estPdf={isPdf}
          onLancer={(pages) => { void lancerAnalyse(pages) }}
          onArreter={analyse.arreter}
          onFermer={() => { setAnalyseOuverte(false); if (analyse.etat.etape === 'erreur' || analyse.etat.etape === 'non-configuree') analyse.oublierErreur() }}
        />
      )}

      {echellesProposees && (
        <ConfirmationEchelles
          echelles={echellesProposees}
          actuelle={(n) => echelleDansTable(echelles, scale, n)}
          onPoser={(choix) => {
            poserEchelles(choix)
            setEchellesProposees(null)
            // L'échelle est posée : l'étalonnage n'a plus rien à faire, la
            // sélection sert à relire et corriger les zones proposées.
            if (tool === 'calibrate') setTool('select')
          }}
          onFermer={() => setEchellesProposees(null)}
        />
      )}

      {/* Modale note */}
      {notePoint && (
        <Modal title={editingNoteId ? 'Modifier la note' : 'Ajouter une note'} onCancel={() => { setNotePoint(null); setEditingNoteId(null) }} onConfirm={confirmNote} confirmLabel={editingNoteId ? 'Enregistrer' : 'Ajouter'}>
          <textarea
            autoFocus value={noteVal} onChange={(e) => setNoteVal(e.target.value)} rows={3}
            placeholder="Votre note…"
            className="w-full px-3 py-2 rounded-lg border text-base outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </Modal>
      )}
    </div>
  )
}

function BoutonOutil({ outil, actif, bloque, onChoisir, compact }: {
  outil: { key: Tool; icon: typeof Ruler; label: string; touche?: string }
  actif: boolean
  /** Outil indisponible tant que la page n'a pas d'échelle. */
  bloque?: boolean
  onChoisir: (k: Tool) => void
  compact?: boolean
}) {
  const Icon = outil.icon
  return (
    <button
      onClick={() => onChoisir(outil.key)}
      data-outil={outil.key}
      disabled={bloque}
      title={bloque ? `${outil.label} (étalonnez d’abord la page)` : outil.touche ? `${outil.label} (${outil.touche})` : outil.label}
      aria-pressed={actif}
      className={cn('flex shrink-0 items-center rounded-lg transition-colors',
        compact ? 'gap-1.5 px-3 py-2' : 'flex-col gap-1 px-1 py-2',
        bloque ? 'cursor-not-allowed text-muted-foreground/40'
          : actif ? 'bg-blue-50 font-semibold text-blue-700'
            : 'text-neutral-600 hover:bg-black/[0.03] hover:text-neutral-900')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn('font-medium', compact ? 'text-xs' : 'text-[10px] leading-tight')}>{outil.label}</span>
    </button>
  )
}

/**
 * La catégorie des repères que pose l'outil Compter.
 *
 * Les mêmes catégories que celles que l'IA compte (base-cfc/comptages.ts) :
 * un repère posé à la main rejoint les siens dans le panneau des quantités,
 * et part avec eux au dossier.
 */
function ChoixCategorie({ haut, choisie, onChoisir }: {
  haut: number
  choisie: CategorieComptee
  onChoisir: (c: CategorieComptee) => void
}) {
  return (
    <div
      data-habillage
      style={{ ['--haut' as string]: `${haut}px` }}
      className="absolute inset-x-3 bottom-3 z-10 rounded-xl border bg-background/95 p-1.5 shadow-lg backdrop-blur sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-[var(--haut)] sm:w-56"
    >
      <p className="px-1.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Compter</p>
      <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-1">
        {CLES_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => onChoisir(c)}
            aria-pressed={choisie === c}
            className={cn('flex items-center gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors pointer-coarse:min-h-11',
              choisie === c ? 'bg-foreground font-semibold text-background' : 'hover:bg-muted')}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/60" style={{ background: COULEURS_CATEGORIE[c] }} aria-hidden />
            <span className="min-w-0 truncate">{CATEGORIE[c].libelle}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Réglages du calque de référence.
 *
 * Deux plans du même bâtiment sortent rarement du même tirage : l'un est à
 * l'échelle 1:50, l'autre recadré. Le calque se déplace au doigt et se
 * redimensionne ici, sans quoi la superposition ne vaut rien.
 */
function PanneauReference({ haut, reference, plans, nomReference, pagesReference, chargement, erreur, onPoser, onMaj, onRetirer }: {
  /** Hauteur dans la scène : le panneau s'ouvre en face de son outil. */
  haut: number
  reference: PlanAnnotation | null
  plans: ApiPlan[]
  nomReference: string | null
  /** Vignettes du document de référence, s'il a plusieurs feuilles. */
  pagesReference: ApercuPage[]
  chargement: boolean
  erreur: boolean
  onPoser: (planId: string) => void
  onMaj: (patch: Partial<PlanAnnotation>) => void
  onRetirer: () => void
}) {
  return (
    <div
      data-habillage
      /* Collé au rail, en face de l'outil qui l'ouvre : un réglage qui apparaît
         loin du bouton qu'on vient de presser se cherche. */
      style={{ ['--haut' as string]: `${haut}px` }}
      className="absolute inset-x-3 bottom-3 z-10 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-[var(--haut)] sm:w-80"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Calque de référence</p>

      {plans.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Ce dossier n’a pas d’autre plan. Ajoutez-en un pour pouvoir comparer deux documents.
        </p>
      ) : !reference ? (
        <>
          <p className="mb-2 mt-0.5 text-sm text-muted-foreground">Choisissez le plan à poser par-dessus.</p>
          <div className="max-h-52 space-y-1 overflow-y-auto">
            {plans.map((x) => (
              <button
                key={x.id}
                onClick={() => onPoser(x.id)}
                className="block w-full truncate rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted"
                title={x.name}
              >
                {x.name}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-medium" title={nomReference ?? ''}>
              {nomReference ?? 'Plan introuvable'}
            </p>
            <button
              onClick={onRetirer}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Retirer le calque"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {chargement && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />Rendu du plan…
            </p>
          )}
          {erreur && <p className="mt-1 text-xs text-destructive">Ce plan n’a pas pu être affiché.</p>}

          {/* Un document de référence peut avoir plusieurs feuilles : on compare
              une coupe précise, pas forcément la première page du fichier. */}
          {pagesReference.length > 1 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-muted-foreground">Page comparée</p>
              {/* De la marge dans la bande qui défile, sinon la première et la
                  dernière vignette sont coupées au bord du cadre. */}
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1">
                {pagesReference.map((pg) => (
                  <button
                    key={pg.numero}
                    onClick={() => onMaj({ planPage: pg.numero })}
                    title={`Page ${pg.numero}`}
                    className={cn('w-12 shrink-0 overflow-hidden rounded-lg border bg-white transition-colors',
                      (reference.planPage ?? 1) === pg.numero ? 'border-foreground ring-1 ring-foreground' : 'hover:border-foreground/40')}
                  >
                    <img src={pg.url} alt="" className="h-14 w-full object-contain" />
                    <span className="block border-t py-0.5 text-[10px] tabular-nums">{pg.numero}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Reglage
            libelle="Transparence"
            valeur={`${Math.round((reference.opacity ?? 0.5) * 100)} %`}
            min={5} max={100} pas={5}
            courant={Math.round((reference.opacity ?? 0.5) * 100)}
            onChange={(v) => onMaj({ opacity: v / 100 })}
          />
          <Reglage
            libelle="Échelle"
            valeur={`${Math.round((reference.scale ?? 1) * 100)} %`}
            min={20} max={300} pas={1}
            courant={Math.round((reference.scale ?? 1) * 100)}
            onChange={(v) => onMaj({ scale: v / 100 })}
          />

          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Teinte</span>
            {TEINTES.map((t) => (
              <button
                key={t.nom}
                onClick={() => onMaj({ tint: t.valeur })}
                title={t.nom}
                className={cn('h-5 w-5 rounded-full border ring-offset-2',
                  (reference.tint ?? null) === t.valeur && 'ring-2 ring-foreground')}
                style={{ backgroundColor: t.valeur ?? 'transparent' }}
              />
            ))}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Glissez sur le plan pour recaler le calque.
          </p>
        </>
      )}
    </div>
  )
}

/** Une réglette, avec sa valeur lue à côté de son intitulé. */
function Reglage({ libelle, valeur, min, max, pas, courant, onChange }: {
  libelle: string; valeur: string; min: number; max: number; pas: number
  courant: number; onChange: (v: number) => void
}) {
  return (
    <label className="mt-2 block">
      <span className="flex items-center justify-between text-xs text-muted-foreground">
        {libelle}<span className="tabular-nums">{valeur}</span>
      </span>
      <input
        type="range" min={min} max={max} step={pas} value={courant}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-foreground"
      />
    </label>
  )
}

/**
 * Ce qui est mesuré sur la page, en liste.
 *
 * Un plan porte vite quinze zones, et retrouver celle qui n'a pas d'ouvrage
 * demandait de cliquer sur chacune. La liste les donne d'un coup, avec leur
 * mesure et leur rattachement, et mène à la forme d'un clic.
 */
function ListeDesZones({ zones, selection, mesure, lie, onChoisir }: {
  zones: PlanAnnotation[]
  selection: string | null
  mesure: (a: PlanAnnotation) => string | null
  lie: (a: PlanAnnotation) => string | null
  onChoisir: (id: string) => void
}) {
  const orphelines = zones.filter((z) => !z.itemId).length
  return (
    <div
      data-habillage
      className="pointer-events-auto hidden min-h-0 w-64 shrink overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur sm:flex sm:flex-col"
    >
      <div className="border-b px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Mesures de la page
        </p>
        <p className="text-xs text-muted-foreground">
          {zones.length} au total
          {orphelines > 0 && <span className="text-amber-600"> · {orphelines} sans ouvrage</span>}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Touchez une ligne pour la rattacher.</p>
      </div>
      <ul className="max-h-[45vh] min-h-0 overflow-y-auto">
        {zones.map((z) => {
          const nom = lie(z)
          return (
            <li key={z.id}>
              <button
                onClick={() => onChoisir(z.id)}
                title={nom ? `Changer l’ouvrage de cette mesure` : 'Rattacher cette mesure à un ouvrage'}
                className={cn('flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted',
                  z.id === selection && 'bg-muted')}
              >
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: z.color ?? '#ef4444' }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium tabular-nums">{mesure(z) ?? 'n.c.'}</span>
                  <span className={cn('block truncate text-xs', nom ? 'text-muted-foreground' : 'text-amber-600')}>
                    {nom ?? 'Rattacher à un ouvrage'}
                  </span>
                </span>
                <Link2 className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Carte de l'annotation sélectionnée.
 *
 * Elle remplace la barrette de couleurs qui flottait en bas à gauche : ce qu'on
 * veut savoir d'une zone, c'est ce qu'elle mesure et à quel ouvrage elle se
 * rapporte. Les couleurs ont rejoint le rail d'outils, où elles valent aussi
 * bien pour le prochain tracé.
 */
function PanneauSelection({ haut, annotation, lie, etalonne, quantite, onLier, onEditerNote, onValider, onSupprimer, onModifier }: {
  /** Hauteur dans la scène : le panneau s'ouvre en face de son outil. */
  haut: number
  annotation: PlanAnnotation
  lie: string | null
  etalonne: boolean
  quantite: string | null
  onLier: () => void
  onEditerNote: () => void
  /** Pour une zone proposée par l'IA : la valider. */
  onValider?: () => void
  onSupprimer: () => void
  /** Renommer une forme validée, ou la ranger dans une autre classification. */
  onModifier?: (patch: Partial<PlanAnnotation>) => void
}) {
  const proposee = annotation.proposition
  const repere = annotation.repere
  const mesurable = !proposee && (annotation.type === 'hatch' || annotation.type === 'measure')
  const [nom, setNom] = useState(annotation.text ?? '')
  const enregistrerNom = () => {
    const t = nom.trim()
    if (t !== (annotation.text ?? '').trim()) onModifier?.({ text: t || undefined })
  }
  return (
    <div
      data-habillage
      style={{ ['--haut' as string]: `${haut}px` }}
      className="absolute inset-x-3 bottom-3 z-10 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-[var(--haut)] sm:w-80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {proposee ? `Zone proposée · ${NOMS_TYPES_ZONE[proposee.type]}`
              : repere ? `${repere.aValider ? 'Repère proposé' : 'Repère'} · ${nomDuRepere(annotation)}`
                : NOMS[annotation.type]}
          </p>
          {proposee && <p className="truncate text-sm font-medium">{proposee.libelle}</p>}
          {quantite
            ? <p className="text-lg font-semibold tabular-nums">{quantite}</p>
            : <p className="truncate text-sm">{annotation.text || 'Sans texte'}</p>}
        </div>
        <button
          onClick={onSupprimer}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Supprimer"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {quantite && !etalonne && (
        <p className="mt-1 text-xs text-amber-600">
          Plan non étalonné : la mesure est en pixels tant que l’échelle n’est pas définie.
        </p>
      )}

      {proposee && (
        <p className="mt-1 text-xs text-muted-foreground">
          {NOMS_CONFIANCE[proposee.confiance]}
          {proposee.aimantee ? ' · aimantée sur le dessin' : ' · non aimantée, placée à l’œil'}
          {proposee.remarque ? ` · ${proposee.remarque}` : ''}
          <span className="mt-0.5 block">Glissez ses poignées pour la corriger, puis validez-la : elle ne compte pas avant.</span>
        </p>
      )}

      {annotation.type === 'note' && (
        <button onClick={onEditerNote} className="mt-2 w-full rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-muted">
          Éditer le texte
        </button>
      )}

      {!!annotation.trous?.length && onModifier && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
          <span className="flex items-center gap-1.5"><Scissors className="h-3.5 w-3.5" />{annotation.trous.length} découpe{annotation.trous.length > 1 ? 's' : ''} retirée{annotation.trous.length > 1 ? 's' : ''}</span>
          <button onClick={() => onModifier({ trous: undefined })} className="font-medium underline-offset-2 hover:underline pointer-coarse:min-h-11">Retirer</button>
        </div>
      )}

      {/* Le nom du local et sa classification : c'est par le nom que la pièce
          trouve sa catégorie SIA 416, par la classification qu'elle se range
          dans le panneau des quantités. */}
      {mesurable && onModifier && (
        <div className="mt-2 grid grid-cols-[1fr_auto] gap-1.5">
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={enregistrerNom}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            maxLength={80}
            placeholder="Nom (séjour, couloir…)"
            aria-label="Nom de la forme"
            className="h-9 min-w-0 rounded-lg border bg-background px-2.5 text-sm outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11"
          />
          <select
            value={annotation.typeZone ?? ''}
            onChange={(e) => {
              const t = (e.target.value || null) as TypeZoneIA | null
              onModifier(t ? { typeZone: t, color: COULEURS_PAR_TYPE[t] } : { typeZone: undefined })
            }}
            aria-label="Classification"
            className="h-9 max-w-[8.5rem] rounded-lg border bg-background px-1.5 text-sm outline-none focus:ring-2 focus:ring-primary pointer-coarse:h-11"
          >
            <option value="">Mesure libre</option>
            {(Object.keys(NOMS_TYPES_ZONE) as TypeZoneIA[]).filter((t) => t !== 'autre').map((t) => (
              <option key={t} value={t}>{NOMS_TYPES_ZONE[t]}</option>
            ))}
          </select>
        </div>
      )}

      {repere && (
        <p className="mt-1 text-xs text-muted-foreground">
          Placé par l’IA là où elle a vu l’élément. Le repère ne compte dans aucun métré : il sert à vérifier le compte.
        </p>
      )}

      {(proposee || repere) && onValider && (
        <button
          onClick={onValider}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Check className="h-4 w-4" />{repere ? 'Valider le repère' : 'Valider la zone'}
        </button>
      )}

      {quantite && (
        <button
          onClick={onLier}
          className={cn('mt-2 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
            lie && 'bg-muted')}
        >
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{lie ?? 'Rattacher à un ouvrage'}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      )}
    </div>
  )
}

function Modal({ title, children, onCancel, onConfirm, confirmLabel, large }: {
  title: string
  children: React.ReactNode
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
  /** Pour ce qui se regarde avant de se décider : des vignettes de pages, par exemple. */
  large?: boolean
}) {
  return (
    // Les marges de l'écran s'ajoutent au cadre : quand la fenêtre est haute
    // (vignettes des pages) ou que le clavier réduit la place, elle s'étire
    // jusqu'au bord, et dans l'app ce bord est sous la barre d'état.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 pb-[calc(var(--safe-bottom)+1rem)] pl-[calc(var(--safe-left)+1rem)] pr-[calc(var(--safe-right)+1rem)] pt-[calc(var(--safe-top)+1rem)]"
      onClick={onCancel}
    >
      <div
        className={cn('w-full rounded-2xl border bg-background p-5 shadow-xl', large ? 'max-w-3xl' : 'max-w-sm')}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-lg font-semibold">{title}</h3>
        {children}
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="h-11 flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-muted">Annuler</button>
          <button onClick={onConfirm} className="h-11 flex-1 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

function Shape({ a, fmtLen, fmtArea, font, strokeW, lie, etiquette, etiquettes = true, nom = null }: {
  a: PlanAnnotation; fmtLen: (px: number) => string; fmtArea: (px2: number, exacte?: boolean) => string
  font: number; strokeW: number; lie: string | null
  /**
   * Mesure à afficher à la place de celle calculée ici : une zone proposée
   * par l'IA, aimantée sur le dessin, s'affiche au centième, comme dans la
   * liste où on la valide.
   */
  etiquette?: string | null
  /** Écrire le nom et la quantité sur la forme ; sans, le plan reste nu. */
  etiquettes?: boolean
  /** Le nom à écrire sur une forme validée : son libellé, sinon son type. */
  nom?: string | null
}) {
  // Le calque de référence est une image posée sous les annotations, pas un tracé.
  if (a.type === 'reference') return null
  const color = a.proposition ? COULEUR_PROPOSITION : (a.color ?? '#ef4444')
  const halo = 3 * strokeW
  // Une zone proposée par l'IA se dessine en pointillé, dans une couleur à
  // part : elle ne se confond pas avec ce qui est validé. Placée à l'œil,
  // faute de dessin vectoriel où s'accrocher, elle passe en tirets courts.
  const tirets = a.proposition
    ? (a.proposition.aimantee ? `${6 * strokeW} ${4 * strokeW}` : `${2 * strokeW} ${3 * strokeW}`)
    : undefined
  if (a.type === 'note') {
    const p = a.points[0]
    return (
      <g>
        <circle cx={p.x} cy={p.y} r={6 * strokeW} fill={color} />
        <text x={p.x + 10 * strokeW} y={p.y + 4 * strokeW} fontSize={font} fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{a.text}</text>
      </g>
    )
  }
  if (a.type === 'repere') {
    // Une pastille numérotée, de la couleur de sa catégorie : pleine une fois
    // validée, cerclée de pointillés tant qu'elle n'est qu'une proposition.
    const p = a.points[0]
    const r = 8 * strokeW
    const aValider = !!a.repere?.aValider
    return (
      <g data-proposition={aValider ? '' : undefined}>
        <circle cx={p.x} cy={p.y} r={r} fill={aValider ? '#ffffff' : color} fillOpacity={aValider ? 0.92 : 1}
          stroke={color} strokeWidth={strokeW * 1.2} strokeDasharray={aValider ? `${2 * strokeW} ${1.5 * strokeW}` : undefined} />
        <text x={p.x} y={p.y + font * 0.33} fontSize={font * 0.85} fontWeight="700" textAnchor="middle" fill={aValider ? color : '#ffffff'}>
          {a.repere?.numero ?? ''}
        </text>
      </g>
    )
  }
  if (a.type === 'draw') {
    return <polyline points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round" strokeLinejoin="round" />
  }
  if (a.type === 'arrow') {
    const [s, e] = a.points
    const ang = Math.atan2(e.y - s.y, e.x - s.x)
    const L = 12 * strokeW
    const p1 = { x: e.x - L * Math.cos(ang - 0.4), y: e.y - L * Math.sin(ang - 0.4) }
    const p2 = { x: e.x - L * Math.cos(ang + 0.4), y: e.y - L * Math.sin(ang + 0.4) }
    return (
      <g>
        <line x1={s.x} y1={s.y} x2={e.x} y2={e.y} stroke={color} strokeWidth={strokeW} />
        <polygon points={`${e.x},${e.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`} fill={color} />
      </g>
    )
  }
  if (a.type === 'measure') {
    // Une cote de deux points, ou une longueur tracée point par point : la
    // mesure s'écrit à mi-longueur, le nom dessous.
    const m = milieuDeLaLigne(a.points)
    return (
      <g data-proposition={a.proposition ? '' : undefined}>
        <polyline points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color} strokeWidth={strokeW} strokeDasharray={tirets} strokeLinejoin="round" />
        {etiquettes && (
          <text x={m.x} y={m.y - 6 * strokeW} fontSize={font} fontWeight="600" textAnchor="middle" fill={color} stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{etiquette ?? fmtLen(longueurPolyligne(a.points))}</text>
        )}
        {etiquettes && (nom || lie) && !a.proposition && (
          <text x={m.x} y={m.y + font * 0.9} fontSize={font * 0.8} textAnchor="middle" fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{[nom, lie].filter(Boolean).join(' · ')}</text>
        )}
      </g>
    )
  }
  // hatch
  const largeurZone = Math.max(...a.points.map((p) => p.x)) - Math.min(...a.points.map((p) => p.x))
  // Les étiquettes s'écrivent au cœur de la zone, pas à la moyenne de ses
  // sommets : celle d'un séjour en L tombe dans la pièce voisine.
  const c = etiquettes ? pointPourEtiquette(a.points) : { x: 0, y: 0 }
  // Un texte ne s'écrit que si la zone est assez large pour le porter : sur
  // une façade aux quinze fenêtres, quinze libellés qui débordent les uns sur
  // les autres ne se lisent plus, et le panneau des quantités les donne.
  const tient = (t: string, taille: number) => t.length * taille * 0.55 <= largeurZone * 1.1
  const mesure = etiquette ?? fmtArea(aireDeLaForme(a), a.mesureExacte)
  const mesureLisible = etiquettes && (!a.proposition || tient(mesure, font)) && tient(mesure, font * 0.7)
  const nomLisible = etiquettes && !a.proposition && !!nom && tient(nom, font * 0.85)
  const lieLisible = etiquettes && !a.proposition && !!lie && tient(lie, font * 0.8)
  return (
    <g data-proposition={a.proposition ? '' : undefined}>
      {/* Un aplat clair plutôt que des hachures : les diagonales se superposaient
          aux traits du plan et on ne lisait plus ni l'un ni l'autre. */}
      {a.trous?.length
        // Les découpes restent vides : un seul chemin, rempli pair-impair.
        ? <path d={[a.points, ...a.trous].map((c) => `M${c.map((p) => `${p.x},${p.y}`).join('L')}Z`).join('')} fillRule="evenodd" fill={color} fillOpacity={0.18} stroke={color} strokeWidth={strokeW} />
        : <polygon points={a.points.map((p) => `${p.x},${p.y}`).join(' ')} fill={color} fillOpacity={a.proposition ? 0.1 : 0.18} stroke={color} strokeWidth={strokeW} strokeDasharray={tirets} />}
      {nomLisible && (
        <text x={c.x} y={c.y - font * 0.55} fontSize={font * 0.85} fontWeight="600" textAnchor="middle" fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{nom}</text>
      )}
      {mesureLisible && (
        <text x={c.x} y={nomLisible ? c.y + font * 0.6 : c.y + font * 0.35} fontSize={font} fontWeight="600" textAnchor="middle" fill={color} stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{mesure}</text>
      )}
      {lieLisible && (
        <text x={c.x} y={c.y + font * (nomLisible ? 1.6 : 1.4)} fontSize={font * 0.8} textAnchor="middle" fill="#111827" stroke="white" strokeWidth={halo} style={{ paintOrder: 'stroke' }}>{lie}</text>
      )}
    </g>
  )
}
