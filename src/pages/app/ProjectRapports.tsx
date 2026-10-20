import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type TouchEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Loader2, AlertCircle, BookOpen, FileDown, FileSpreadsheet, Image, Share2, Copy, Check, ExternalLink, X, Download,
  Leaf, Minus, Plus, Presentation, Receipt, Archive,
} from 'lucide-react'
import { Button, Card, CardContent } from '@/components/ui'
import { ExportDialog } from '@/components/ExportDialog'
import { cn } from '@/lib/utils'
import { api, saveBlob } from '@/lib/api'
import type { ElementState } from '@/lib/api-types'
import type { MarqueDuDossier } from '@/lib/marque'
import { useAuth } from '@/stores/auth'
import { MarqueDuRapport } from '@/components/report/marque-contexte'
import { PersonnaliserLeRapport } from '@/components/report/PersonnaliserLeRapport'
import { RapportComplet, type PartieDuRapport } from '@/components/report/RapportComplet'
import { ConfirmerEnvoi, ControleAvantEnvoi } from '@/components/report/ControleAvantEnvoi'
import { useDevisDuDossier } from '@/components/report/use-devis-du-dossier'
import { RappelDuBureau } from '@/components/RappelDuBureau'
import { ORIGINE_PUBLIQUE } from '@/lib/plateforme'
import { imprimerDiapositives, imprimerLaPage } from '@/lib/impression'
import { pdfDesPages } from '@/lib/pdf-direct'
import { estAppNative } from '@/lib/plateforme'
import { bloquants as lesBloquants, controlerLeRapport } from '@/lib/controles-rapport'
import { archiveDesPhotos, nomDeDossier, nombreDePhotos } from '@/lib/photos-zip'
import { enAttente } from '@/lib/plans/feuilles'
import { telechargerLeClasseur } from '@/lib/plans/telecharger-metre'
import { DIAPO, OPTIONS_PRESENTATION, type OptionsPresentation } from '@/lib/plans/presentation'
import { OptionsDeLaPresentation, PresentationMetres } from '@/components/metres/PresentationMetres'
import { useJeuDuDossier, usePresentation } from '@/components/metres/presentation-donnees'
import { useFicheDepuisPlans } from '@/components/metres/fiche-depuis-plans'

/**
 * Les documents du dossier, et le seul endroit de l'app où on les télécharge.
 *
 * Cinq documents, pas plus : le rapport complet, et quatre extraits qui en
 * reprennent les mêmes données (le devis original, le rapport photo,
 * l'étiquette énergétique), ou les plans de repérage et métrés. Les anciens
 * gabarits (« Rapport », « De l'existant ») comptaient leurs propres totaux et
 * ne disaient pas la même chose que le rapport complet : ils sont retirés.
 * Partout ailleurs (Coûts, Photos, Étiquette énergétique, Métrés), on consulte.
 */
type ReportKind = PartieDuRapport | 'metres'

const DOCUMENTS: [ReportKind, string, typeof BookOpen][] = [
  ['complet', 'Rapport complet', BookOpen],
  ['devis', 'Devis original', Receipt],
  ['photos', 'Rapport photo', Image],
  ['energie', 'Étiquette énergétique', Leaf],
  ['metres', 'Plans de repérage et métrés', Presentation],
]
const TITRES = Object.fromEntries(DOCUMENTS.map(([k, l]) => [k, l])) as Record<ReportKind, string>

/**
 * Imprimer, exporter et partager passent dans la colonne de gauche sur iPad
 * couché et sur les écrans de moins de 1280 px : le document récupère la place
 * de la colonne de droite. Sous 1024 px, les colonnes sont empilées et la
 * question ne se pose pas.
 */
const ACTIONS_A_GAUCHE = 'screen and (min-width: 1024px) and (pointer: coarse), screen and (min-width: 1024px) and (max-width: 1279px)'

function useActionsAGauche() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(ACTIONS_A_GAUCHE)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(ACTIONS_A_GAUCHE).matches,
    () => false,
  )
}

const distanceDesDoigts = (t: TouchEvent['touches']) =>
  Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)

export function ProjectRapports() {
  const { id } = useParams<{ id: string }>()
  const user = useAuth((s) => s.user)
  const auteurDuCompte = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.companyName || ''
  /**
   * L'aperçu de la personnalisation, pendant qu'on la règle : le document le
   * montre aussitôt. null = on affiche ce qui est enregistré.
   */
  const [apercu, setApercu] = useState<MarqueDuDossier | null>(null)
  // Une feuille A4 fait 210 mm, soit environ 800 px : quand la colonne du
  // document est plus étroite, on la réduit à sa largeur.
  const [largeurDoc, setLargeurDoc] = useState<number | null>(null)
  const colonneDoc = useRef<HTMLDivElement | null>(null)
  const mesurerDoc = useCallback((el: HTMLDivElement | null) => {
    colonneDoc.current = el
    if (!el) return
    const o = new ResizeObserver(([e]) => setLargeurDoc(e.contentRect.width))
    o.observe(el)
    return () => o.disconnect()
  }, [])
  const [loupe, setLoupe] = useState(1)
  const [choix, setReport] = useState<ReportKind | null>(null)

  // Le dossier chiffré : un seul calcul pour tous les documents.
  const dossier = useDevisDuDossier(id)
  const { project, diagnostic, devis, base } = dossier
  const items = useMemo(() => dossier.items ?? [], [dossier.items])
  const marqueDuDossier = apercu ?? project?.reportBranding ?? null
  const auteur = marqueDuDossier?.auteur?.trim() || auteurDuCompte

  // Un dossier sans diagnostic n'a que ses métrés à présenter : c'est par eux qu'il s'ouvre.
  const report: ReportKind = choix ?? (diagnostic || dossier.chargement ? 'complet' : 'metres')
  const largeurBase = report === 'metres' ? DIAPO.largeur : 800
  const ajuste = largeurDoc ? Math.min(1, largeurDoc / largeurBase) : 1
  const zoomDe = (l: number) => Math.min(3, Math.max(0.3, ajuste * l))
  const zoom = zoomDe(loupe)
  const zoomFeuille = zoom !== 1 ? ({ '--zoom-feuille': String(zoom) } as CSSProperties) : undefined
  const changerLoupe = (facteur: number) => setLoupe((l) => Math.min(4, Math.max(0.5, l * facteur)))
  // Pendant le pincement, le zoom est posé directement sur la colonne : un
  // rendu de React à chaque mouvement de doigt ferait saccader le document.
  const pincement = useRef<{ distance: number; loupe: number; actuelle: number } | null>(null)
  const debutPincement = (e: TouchEvent) => {
    if (e.touches.length === 2) pincement.current = { distance: distanceDesDoigts(e.touches), loupe, actuelle: loupe }
  }
  const suitePincement = (e: TouchEvent) => {
    const p = pincement.current
    if (!p || e.touches.length !== 2) return
    p.actuelle = Math.min(4, Math.max(0.5, p.loupe * distanceDesDoigts(e.touches) / p.distance))
    colonneDoc.current?.style.setProperty('--zoom-feuille', String(zoomDe(p.actuelle)))
  }
  const finPincement = (e: TouchEvent) => {
    const p = pincement.current
    if (!p || e.touches.length >= 2) return
    pincement.current = null
    setLoupe(p.actuelle)
  }
  const actionsAGauche = useActionsAGauche()
  const [exportOpen, setExportOpen] = useState(false)

  // Variantes du projet : le rapport complet en fait un chapitre.
  const variantsQuery = useQuery({ queryKey: ['variants', id], queryFn: () => api.variants.list(id!), enabled: !!id })
  // L'ancien catalogue porte la description de l'état constaté des relevés d'avant la bascule.
  const catalogQuery = useQuery({ queryKey: ['cfc-items'], queryFn: () => api.cfc.items(), staleTime: 3.6e6 })
  const etatExistant = useMemo(() => {
    const parId = new Map((catalogQuery.data?.items ?? []).map((c) => [c.id, c]))
    return (it: { catalogItemId: number | null; state: ElementState | null }): string | null => {
      if (!it.state || it.catalogItemId == null) return null
      const c = parId.get(it.catalogItemId)
      if (!c) return null
      return it.state === 'TRES_BON' ? c.descTbe : it.state === 'BON' ? c.descBon : it.state === 'MOYEN' ? c.descMoyen : c.descMauvais
    }
  }, [catalogQuery.data])

  // La présentation des métrés : le jeu de plans du dossier, ses quantités, et les relevés quand il y en a.
  const [optionsPresentation, setOptionsPresentation] = useState<OptionsPresentation>(OPTIONS_PRESENTATION)
  const [presentationPrete, setPresentationPrete] = useState(false)
  /** Le PDF en préparation : « 3/12 » pendant que les pages se photographient. */
  const [pdf, setPdf] = useState<string | null>(null)
  const [enCours, setEnCours] = useState<'photos' | 'excel' | null>(null)
  const jeuDuDossier = useJeuDuDossier(id ?? '', project?.floorHeight ?? null)
  const presentation = usePresentation({ ...jeuDuDossier, projet: project, items, options: optionsPresentation })
  // Les métrés validés des plans remplacent les dimensions de la fiche : le devis les lit aussitôt.
  const formesAValider = jeuDuDossier.jeu.reduce((s, x) => s + (x.plan.annotations ?? []).filter(enAttente).length, 0)
  useFicheDepuisPlans(id, project, jeuDuDossier.panneau, jeuDuDossier.sia,
    !jeuDuDossier.chargement && jeuDuDossier.jeu.length > 0 && formesAValider === 0 && jeuDuDossier.panneau.aValider === 0)

  // Le contrôle avant envoi, sur le même devis que le document.
  const controles = useMemo(() => (project && devis
    ? controlerLeRapport({ items, articles: base.articles, etapes: base.etapes, fiche: project, devis })
    : []), [project, devis, items, base])
  const bloquants = useMemo(() => lesBloquants(controles), [controles])
  const [confirmation, setConfirmation] = useState<{ action: string; suite: () => void } | null>(null)
  /** Une sortie vers le client : elle passe par la confirmation tant qu'un point bloque. */
  const avecControle = (action: string, suite: () => void) => {
    if (report !== 'metres' && bloquants.length > 0) setConfirmation({ action, suite })
    else suite()
  }

  if (dossier.chargement && !project) {
    return <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin mr-2" />Chargement…</div>
  }
  if (dossier.erreur || !project) {
    return <Card><CardContent className="py-16 text-center"><AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" /><p className="text-sm text-red-700">Projet introuvable</p></CardContent></Card>
  }

  // Le PDF sort directement des pages affichées : diapositives 16:9 pour la
  // présentation, feuilles A4 pour les rapports (pdf-direct.ts). Dans l'app
  // iPhone et iPad, il passe par le plugin natif, qui l'enregistre ou le partage.
  const presentationVide = report === 'metres' && presentation.diapositives.length === 0
  const telechargerPdf = async () => {
    const nom = report === 'metres' ? presentation.nomDuFichier : `${TITRES[report]} - ${project.name}`
    if (estAppNative) {
      await (report === 'metres' ? imprimerDiapositives(nom) : imprimerLaPage(nom))
      return
    }
    const colonne = colonneDoc.current
    if (!colonne) return
    const pages = report === 'metres'
      ? [...colonne.querySelectorAll<HTMLElement>('.diapos-ecran .diapo')]
      : [...colonne.querySelectorAll<HTMLElement>('.doc-feuille')].filter((el) => !el.closest('.doc-mesure'))
    setPdf(`0/${pages.length}`)
    try {
      await pdfDesPages(pages, { nom, format: report === 'metres' ? 'diapo' : 'a4', onProgres: (faites, total) => setPdf(`${faites}/${total}`) })
    } finally {
      setPdf(null)
    }
  }
  const imprimer = () => avecControle('Télécharger', () => { void telechargerPdf().catch(() => setPdf(null)) })

  const archiverPhotos = async () => {
    setEnCours('photos')
    try {
      saveBlob(await archiveDesPhotos(project.name, items), `${nomDeDossier(project.name)}-photos.zip`)
    } finally {
      setEnCours(null)
    }
  }
  const classeur = async () => {
    setEnCours('excel')
    try {
      await telechargerLeClasseur(id!, project, jeuDuDossier.jeu, jeuDuDossier.panneau, jeuDuDossier.sia)
    } finally {
      setEnCours(null)
    }
  }
  const photos = nombreDePhotos(items)

  const actions = (
    <>
      <Button
        onClick={imprimer}
        disabled={pdf !== null || (report === 'metres' ? presentationVide || !presentationPrete : !diagnostic || !devis)}
        className="w-full justify-start"
      >
        {pdf !== null || (report === 'metres' && !presentationVide && !presentationPrete)
          ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          : <FileDown className="mr-2 h-4 w-4" />}
        {pdf !== null ? `PDF ${pdf}` : 'PDF'}
      </Button>
      {report === 'photos' && photos > 0 && (
        <Button variant="outline" onClick={() => void archiverPhotos()} disabled={enCours !== null} className="w-full justify-start">
          {enCours === 'photos' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
          Photos (ZIP, {photos})
        </Button>
      )}
      {report === 'metres' && presentation.elements.length > 0 && (
        <Button variant="outline" onClick={() => void classeur()} disabled={enCours !== null} className="w-full justify-start">
          {enCours === 'excel' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
          Métré (Excel)
        </Button>
      )}
      {/* L'export et le lien de partage portent sur le diagnostic. */}
      {diagnostic && (
        <Button variant="outline" onClick={() => setExportOpen(true)} className="w-full justify-start">
          <Download className="mr-2 h-4 w-4" />Exporter
        </Button>
      )}
      {diagnostic && (
        <ShareControl
          projectId={id!}
          initialToken={project.shareToken ?? null}
          avantPartage={(suite) => avecControle('Partager', suite)}
        />
      )}
    </>
  )

  return (
    /* Une colonne à gauche, le document à droite.

       À partir de md, AppLayout encastre la page : sa zone principale ne
       défile plus, c'est à la page de le faire. Les trois colonnes ne tiennent
       côte à côte qu'à partir de lg ; entre les deux (iPad à la verticale),
       elles restent empilées comme sur téléphone, et c'est cette enveloppe,
       calée sur la hauteur de la zone, qui défile d'un bloc. */
    <div className="js-print-column flex min-h-0 flex-col gap-4 md:h-full md:max-lg:overflow-y-auto">
    <div className="js-print-hide shrink-0 print:hidden">
      <h1 className="text-xl font-bold md:text-2xl">Rapports</h1>
      <p className="text-sm text-muted-foreground">Les documents remis au client, et le seul endroit où on les télécharge : choisissez-en un, vérifiez-le, puis téléchargez ou partagez-le.</p>
    </div>
    <div className="js-print-column flex min-h-0 flex-col gap-4 max-lg:shrink-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
      {/* À gauche ce qui compose le document : son type, le contrôle avant
          envoi et son apparence. Au milieu le document. À droite ce qui en
          sort. Chaque colonne défile d'elle-même quand elle dépasse. */}
      <aside className="shrink-0 space-y-4 print:hidden max-lg:order-1 lg:h-full lg:w-64 lg:overflow-y-auto lg:pb-3">
        <nav className="space-y-1" aria-label="Document">
          {DOCUMENTS.map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setReport(k)}
              aria-current={report === k ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                report === k ? 'bg-blue-50 text-blue-700' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />{label}
            </button>
          ))}
        </nav>

        {diagnostic && report !== 'metres' && devis && (
          <ControleAvantEnvoi controles={controles} items={items} projectId={id!} diagnosticId={diagnostic.id} />
        )}

        {report === 'metres' && presentation.elements.length > 0 && (
          <OptionsDeLaPresentation
            elements={presentation.elements}
            siaDisponible={presentation.siaDisponible}
            photosDisponibles={presentation.photosDisponibles}
            options={optionsPresentation}
            onOptions={setOptionsPresentation}
          />
        )}

        {actionsAGauche && <div className="space-y-2 border-t pt-4">{actions}</div>}

        <PersonnaliserLeRapport
          projectId={id!}
          dossier={project.reportBranding}
          auteurParDefaut={auteur}
          onApercu={setApercu}
        />
      </aside>

      {/* Tout le document porte la marque du dossier. Il ne dépasse jamais la
          largeur d'une feuille A4, et c'est lui, et non la page, qui défile. La
          présentation 16:9 prend toute la largeur. */}
      <MarqueDuRapport dossier={marqueDuDossier} auteur={auteur}>
      <div className={cn('js-print-column relative min-w-0 flex-1 max-lg:order-3 lg:h-full', !actionsAGauche && report !== 'metres' && 'lg:max-w-[calc(210mm+1rem)]')}>
      <div
        ref={mesurerDoc}
        onTouchStart={debutPincement}
        onTouchMove={suitePincement}
        onTouchEnd={finPincement}
        className="js-print-column h-full space-y-4 overflow-x-auto [touch-action:pan-x_pan-y] print:overflow-visible lg:overflow-auto lg:[scrollbar-width:thin]"
        style={zoomFeuille}
      >
      {/* Au-dessus de la feuille, et non dans les réglages : c'est en voyant
          le document qu'on mesure ce qui lui manque. */}
      <RappelDuBureau />

      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} projectId={id!} />
      {confirmation && (
        <ConfirmerEnvoi
          bloquants={bloquants}
          action={confirmation.action}
          onAnnuler={() => setConfirmation(null)}
          onConfirmer={() => { const suite = confirmation.suite; setConfirmation(null); suite() }}
        />
      )}

      {/* Les rapports se fondent sur le diagnostic ; la présentation des métrés, non. */}
      {!diagnostic && report !== 'metres' && (
        <Card><CardContent className="py-16 text-center">
          <h3 className="mb-1 text-lg font-semibold">Aucun diagnostic</h3>
          <p className="mb-4 text-sm text-muted-foreground">Ce document se base sur le diagnostic. Démarrez-le d'abord, ou présentez les métrés du dossier.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to={`/app/projects/${id}/diagnostic`}><Button>Aller au diagnostic</Button></Link>
            <Button variant="outline" onClick={() => setReport('metres')}>Plans de repérage et métrés</Button>
          </div>
        </CardContent></Card>
      )}

      {/* Plans de repérage et métrés, 16:9 : tirés des formes validées dans les Métrés. */}
      {report === 'metres' && (
        jeuDuDossier.chargement
          ? <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Chargement des plans…</div>
          : presentation.elements.length === 0
            ? (
              <Card><CardContent className="py-16 text-center">
                <h3 className="mb-1 text-lg font-semibold">Aucun métré validé</h3>
                <p className="mx-auto mb-4 max-w-md text-sm text-muted-foreground">
                  La présentation se compose d’elle-même à partir des formes validées dans les Métrés : déposez les plans du bâtiment, analysez-les, validez les formes.
                </p>
                <Link to={`/app/metres/${id}`}><Button>Ouvrir les Métrés</Button></Link>
              </CardContent></Card>
            )
            : presentationVide
              ? <p className="py-24 text-center text-sm text-muted-foreground">Cochez au moins un élément à présenter.</p>
              : (
                <PresentationMetres
                  diapositives={presentation.diapositives}
                  plans={presentation.plans}
                  attenue={optionsPresentation.attenue}
                  batiment={presentation.batiment}
                  adresse={presentation.adresse}
                  onPret={setPresentationPrete}
                />
              )
      )}

      {/* Le rapport complet, ou l'un de ses extraits : mêmes données, même calcul. */}
      {diagnostic && report !== 'metres' && (
        devis
          ? (
            <RapportComplet
              key={report}
              partie={report}
              project={project}
              items={items}
              devis={devis}
              etatExistant={etatExistant}
              base={base}
              catalogItems={catalogQuery.data?.items ?? []}
              variants={variantsQuery.data?.variants ?? []}
              auteur={auteur}
            />
          )
          : <div className="flex items-center justify-center py-32 text-muted-foreground"><Loader2 className="mr-2 h-6 w-6 animate-spin" />Chiffrage du dossier…</div>
      )}
      </div>
      {/* Le zoom, posé sur le document : réduire pour voir la page entière,
          agrandir pour lire un détail. Le pourcentage revient à l'ajustement. */}
      <div className="absolute bottom-3 right-3 z-10 hidden items-center gap-0.5 rounded-full border border-black/[0.06] bg-white/90 p-1 shadow-md backdrop-blur print:hidden md:flex">
        <button type="button" onClick={() => changerLoupe(1 / 1.25)} aria-label="Réduire" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setLoupe(1)} aria-label="Ajuster à la largeur" className="min-w-14 rounded-full px-2 text-xs font-semibold tabular-nums hover:bg-muted">
          {Math.round(zoom * 100)} %
        </button>
        <button type="button" onClick={() => changerLoupe(1.25)} aria-label="Agrandir" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      </div>
      </MarqueDuRapport>

      {/* Ce qui sort du document : à droite, la fin du geste. Sur iPad couché,
          ces actions passent à gauche (useActionsAGauche). */}
      {!actionsAGauche && (
        <aside className="shrink-0 space-y-2 print:hidden max-lg:order-2 lg:h-full lg:w-52 lg:overflow-y-auto">
          {actions}
        </aside>
      )}
    </div>
    </div>
  )
}

/** Bouton + popover pour activer / copier / révoquer le lien de partage client. */
function ShareControl({ projectId, initialToken, avantPartage }: {
  projectId: string
  initialToken: string | null
  /** Passe la main au contrôle avant envoi : il appelle la suite, ou demande confirmation. */
  avantPartage: (suite: () => void) => void
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = token ? `${ORIGINE_PUBLIQUE}/share/${token}` : ''

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
      <Button variant="outline" onClick={() => (token ? setOpen((o) => !o) : avantPartage(() => void enable()))} disabled={loading} className="w-full justify-start">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
        {token ? 'Lien de partage' : 'Partager'}
      </Button>

      {open && token && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* À la largeur de la colonne : plus large, elle débordait de la
              colonne qui défile et s'y faisait couper. */}
          <div className="absolute inset-x-0 mt-2 z-50 rounded-xl border bg-background shadow-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Partager au client</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">Toute personne disposant de ce lien peut consulter le rapport complet en lecture seule, sans connexion.</p>
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
